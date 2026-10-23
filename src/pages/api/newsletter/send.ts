import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/auth';
import { getRuntimeEnv } from '../../../lib/runtimeEnv';

export const prerender = false;
const json = (data:unknown,status=200) => Response.json(data,{status,headers:{'cache-control':'no-store'}});
export const POST: APIRoute = async ({request,locals}) => {
 const env=getRuntimeEnv(locals);
 if(!(await isAdmin(request,env))) return json({error:'No autorizado'},401);
 if(!env.BREVO_API_KEY) return json({error:'Brevo no configurado'},503);
 const body=await request.json().catch(()=>null);
 const id=Number(body?.campaignId);
 const listId=Number(body?.listId);
 const allowed=[Number(env.BREVO_LIST_ID||3),Number(env.BREVO_PRESS_LIST_ID||4)];
 if(!allowed.includes(listId))return json({error:'Lista no permitida'},400);
 if(!Number.isSafeInteger(id)||id<=0||body?.confirmation!=='ENVIAR' || body?.consentConfirmed!==true) return json({error:'Falta confirmación expresa y verificación de consentimiento'},400);
 const headers={'api-key':env.BREVO_API_KEY,accept:'application/json'};
 const campaignRes=await fetch('https://api.brevo.com/v3/emailCampaigns/'+id,{headers});
 const campaign=await campaignRes.json().catch(()=>({}));
 if(!campaignRes.ok) return json({error:'No se pudo verificar el borrador',detail:campaign?.message},502);
 const lists=campaign?.recipients?.listIds;
 if(!String(campaign?.name||'').startsWith('Borrador Diario Federal · ') ||
    campaign?.status!=='draft' ||
    !Array.isArray(lists)||lists.length!==1||Number(lists[0])!==listId ||
    String(campaign?.sender?.email||'').toLowerCase()!==String(env.BREVO_SENDER_EMAIL||'boletin@diariofederal.com.ar').toLowerCase())
   return json({error:'La campaña no coincide con un borrador válido de Diario Federal para la lista seleccionada'},400);
 const res=await fetch('https://api.brevo.com/v3/emailCampaigns/'+id+'/sendNow',{method:'POST',headers});
 const data=await res.json().catch(()=>({}));
 if(!res.ok) return json({error:'Brevo no pudo iniciar el envío',detail:data?.message||res.status},502);
 return json({ok:true,id,status:'sent_requested'});
};
