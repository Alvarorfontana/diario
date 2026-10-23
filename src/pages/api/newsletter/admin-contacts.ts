import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/auth';
import { getRuntimeEnv } from '../../../lib/runtimeEnv';
export const prerender = false;
const response = (data: unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
export const GET: APIRoute = async ({request,locals})=>{
 const env=getRuntimeEnv(locals);
 if(!await isAdmin(request,env))return response({error:'No autorizado'},401);
 if(!env.BREVO_API_KEY)return response({error:'Falta configurar BREVO_API_KEY en Vercel'},503);
 const r=await fetch('https://api.brevo.com/v3/contacts/lists?limit=50&offset=0',{headers:{'api-key':env.BREVO_API_KEY,accept:'application/json'}});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)return response({error:'Brevo no respondió correctamente'},502);
 return response({lists:(data.lists||[]).map((l:any)=>({id:l.id,name:l.name,totalSubscribers:l.totalSubscribers}))});
};
export const POST: APIRoute = async ({request,locals})=>{
 const env=getRuntimeEnv(locals);
 if(!await isAdmin(request,env))return response({error:'No autorizado'},401);
 if(!env.BREVO_API_KEY)return response({error:'Falta configurar BREVO_API_KEY en Vercel'},503);
 const b=await request.json().catch(()=>({}));
 const email=String(b.email||'').trim().toLowerCase(),listId=Number(b.listId);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Number.isSafeInteger(listId)||listId<=0)return response({error:'Correo o lista inválidos'},400);
 // Revalidar que la lista pertenece a la cuenta.
 const lists=await fetch('https://api.brevo.com/v3/contacts/lists?limit=50&offset=0',{headers:{'api-key':env.BREVO_API_KEY,accept:'application/json'}});
 const listData=await lists.json().catch(()=>({}));
 if(!lists.ok||!(listData.lists||[]).some((l:any)=>l.id===listId))return response({error:'La lista no está disponible'},400);
 if(!env.BREVO_DOI_TEMPLATE_ID)return response({error:'Falta BREVO_DOI_TEMPLATE_ID para solicitar la confirmación del correo'},503);
 const r=await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation',{method:'POST',headers:{'api-key':env.BREVO_API_KEY,'content-type':'application/json'},body:JSON.stringify({email,includeListIds:[listId],templateId:Number(env.BREVO_DOI_TEMPLATE_ID),redirectionUrl:env.BREVO_REDIRECT_URL||'https://www.diariofederal.com.ar/'})});
 if(!r.ok)return response({error:'Brevo rechazó la solicitud de confirmación'},502);
 return response({ok:true,message:'Se solicitó la confirmación por correo. El contacto no se considera suscripto hasta que confirme.'});
};