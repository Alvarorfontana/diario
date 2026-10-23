import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/auth';
import { getRuntimeEnv } from '../../../lib/runtimeEnv';
export const prerender = false;
const response = (data: unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
export const GET: APIRoute = async ({request,locals})=>{
 const env=getRuntimeEnv(locals);
 if(!await isAdmin(request,env))return response({error:'No autorizado'},401);
 if(!env.BREVO_API_KEY)return response({error:'Falta configurar BREVO_API_KEY en Vercel'},503);
 const headers={'api-key':env.BREVO_API_KEY,accept:'application/json'};
 const r=await fetch('https://api.brevo.com/v3/contacts/lists?limit=50&offset=0',{headers});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)return response({error:'Brevo rechazó la consulta de listas',detail:data?.message||r.status},502);
 const lists=await Promise.all((data.lists||[]).map(async(l:any)=>{
   const id=Number(l.id);
   if(!Number.isSafeInteger(id)||id<=0)return null;
   const detailRes=await fetch('https://api.brevo.com/v3/contacts/lists/'+id,{headers});
   const detail=detailRes.ok?await detailRes.json().catch(()=>({})):{};
   const count=typeof detail.totalSubscribers==='number'?detail.totalSubscribers:typeof l.totalSubscribers==='number'?l.totalSubscribers:null;
   return {id,name:String(l.name||detail.name||'Lista '+id),totalSubscribers:count,verified:detailRes.ok};
 }));
 return response({lists:lists.filter(Boolean)});

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