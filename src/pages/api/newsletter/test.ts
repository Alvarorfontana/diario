import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/auth';
import { getRuntimeEnv } from '../../../lib/runtimeEnv';
import { getArticulos } from '../../../lib/articles';

export const prerender = false;
const origin = 'https://www.diariofederal.com.ar';
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);
  if (!(await isAdmin(request, env))) return Response.json({error:'No autorizado'},{status:401});
  if (!env.BREVO_API_KEY) return Response.json({error:'Falta configurar Brevo'},{status:503});
  const body = await request.json().catch(()=>null);
  const ids: unknown = body?.ids;
  const subject = String(body?.subject || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 6 || ids.some(id=>typeof id!=='string') || new Set(ids).size!==ids.length || !subject || subject.length>180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({error:'Seleccioná noticias, asunto y correo válido'},{status:400});
  const articles = await getArticulos();
  const selected = ids.map((id:string)=>articles.find(a=>a.slug===id));
  if(selected.some(a=>!a)) return Response.json({error:'Noticia no encontrada'},{status:400});
  const stories = selected.map((a,i)=>{
    if(!a) return '';
    const link=origin+'/articulo/'+encodeURIComponent(a.slug)+'/';
    let img='';try{const u=new URL(a.image_url||'',origin);if(u.protocol==='https:')img=u.href;}catch{}
    return '<tr><td style="padding:22px 30px;border-bottom:1px solid #ddd">'+
      (a.volanta?'<p style="font:700 12px Arial;color:#9c1821">'+esc(a.volanta)+'</p>':'')+
      (img?'<a href="'+esc(link)+'"><img src="'+esc(img)+'" width="600" alt="'+esc(a.title)+'" style="display:block;width:100%;height:auto"></a>':'')+
      (img&&a.imageCaption?'<p style="font:11px Arial;color:#777">'+esc(a.imageCaption)+'</p>':'')+
      '<h2 style="font:bold '+(i===0?'34':'25')+'px Georgia,serif"><a href="'+esc(link)+'" style="color:#222;text-decoration:none">'+esc(a.title)+'</a></h2>'+
      '<p style="font:16px/1.5 Georgia,serif">'+esc(a.excerpt)+'</p><p style="font:12px Arial;color:#777">'+esc(a.author)+'</p>'+
      '<a href="'+esc(link)+'" style="color:#9c1821">Leer en Diario Federal →</a></td></tr>';
  }).join('');
  const html='<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body style="margin:0;background:#f1eee9"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;background:white"><tr><td style="background:#9c1821;color:white;text-align:center;padding:28px;font:bold 38px Georgia,serif">DIARIO FEDERAL</td></tr><tr><td style="padding:16px 30px;border-bottom:3px double #333;font:12px Arial">EDICIÓN DIGITAL</td></tr>'+stories+'<tr><td style="padding:24px;text-align:center;font:12px Arial;background:#f6f4ef"><a href="'+origin+'">Diario Federal</a><p>Este es un correo de prueba editorial. No es una suscripción.</p></td></tr></table></td></tr></table></body></html>';
  const result=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.BREVO_API_KEY,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({sender:{name:env.BREVO_SENDER_NAME||'Diario Federal',email:env.BREVO_SENDER_EMAIL||'boletin@diariofederal.com.ar'},to:[{email}],subject:'[PRUEBA] '+subject,htmlContent:html})});
  const data=await result.json().catch(()=>({}));
  if(!result.ok) return Response.json({error:'Brevo rechazó la prueba',detail:data?.message||result.status},{status:502});
  return Response.json({ok:true,messageId:data.messageId});
};
