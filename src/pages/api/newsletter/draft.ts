import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/auth';
import { getRuntimeEnv } from '../../../lib/runtimeEnv';
import { getArticulos } from '../../../lib/articles';

export const prerender = false;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const origin = 'https://www.diariofederal.com.ar';
const safeImage = (value: string) => {
  try { const url = new URL(value, origin); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
};
export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);
  if (!(await isAdmin(request, env))) return new Response(JSON.stringify({error:'No autorizado'}),{status:401});
  if (!env.BREVO_API_KEY) return new Response(JSON.stringify({error:'Falta BREVO_API_KEY en Vercel'}),{status:503});
  const body = await request.json().catch(() => null);
  const ids = body?.ids;
  const subject = String(body?.subject || '').trim();
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 6 || ids.some((id: unknown)=>typeof id !== 'string') || !subject || subject.length > 180) {
    return new Response(JSON.stringify({error:'Seleccioná entre una y seis noticias y un asunto válido'}),{status:400});
  }
  if (new Set(ids).size !== ids.length) return new Response(JSON.stringify({error:'Noticias duplicadas'}),{status:400});
  const articles = await getArticulos();
  const selected = ids.map((id: string) => articles.find(a=>a.slug === id));
  if (selected.some(a=>!a)) return new Response(JSON.stringify({error:'Una noticia no está publicada'}),{status:400});
  const stories = selected.map((a,i)=>{
    if (!a) return '';
    const link = origin+'/articulo/'+encodeURIComponent(a.slug)+'/';
    const image = safeImage(a.image_url || '');
    return '<tr><td style="padding:24px 30px;border-bottom:1px solid #ddd">'+
      (a.volanta ? '<p style="font:700 12px Arial;color:#a31b25">'+esc(a.volanta)+'</p>' : '')+
      (image ? '<a href="'+esc(link)+'"><img src="'+esc(image)+'" alt="'+esc(a.title)+'" width="600" style="display:block;width:100%;height:auto"></a>' : '')+
      (image && a.imageCaption ? '<p style="font:11px Arial;color:#666">'+esc(a.imageCaption)+'</p>' : '')+
      '<h2 style="font:bold '+(i===0?'34':'25')+'px Georgia,serif"><a href="'+esc(link)+'" style="color:#222;text-decoration:none">'+esc(a.title)+'</a></h2>'+
      '<p style="font:16px/1.5 Georgia,serif">'+esc(a.excerpt)+'</p>'+
      '<p style="font:12px Arial;color:#666">'+esc(a.author)+' · '+esc(a.section)+'</p>'+
      '<a href="'+esc(link)+'" style="font:bold 13px Arial;color:#a31b25">Leer nota completa →</a></td></tr>';
  }).join('');
  const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f1eee9"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;background:#fff"><tr><td style="padding:28px;text-align:center;background:#9c1821;color:white;font:bold 38px Georgia,serif">DIARIO FEDERAL</td></tr><tr><td style="padding:15px 30px;font:12px Arial;border-bottom:3px double #333">EDICIÓN DIGITAL · '+esc(new Date().toLocaleDateString('es-AR'))+'</td></tr>'+stories+'<tr><td style="padding:28px;text-align:center;background:#f6f4ef;font:12px Arial"><a href="'+origin+'">Diario Federal</a><p>Recibís este correo porque te suscribiste al boletín.</p><a href="{{ unsubscribe }}">Cancelar suscripción</a></td></tr></table></td></tr></table></body></html>';
  const listId = Number(body?.listId || env.BREVO_LIST_ID || 3);
  const allowed = [Number(env.BREVO_LIST_ID || 3), Number(env.BREVO_PRESS_LIST_ID || 4)];
  if (!allowed.includes(listId)) return new Response(JSON.stringify({error:'Lista no permitida'}),{status:400});
  // Solo crear borrador, nunca enviar ni programar.
  const senderEmail = env.BREVO_SENDER_EMAIL || 'boletin@diariofederal.com.ar';
  const senderName = env.BREVO_SENDER_NAME || 'Diario Federal';
  const response = await fetch('https://api.brevo.com/v3/emailCampaigns',{
    method:'POST',
    headers:{'api-key':env.BREVO_API_KEY,'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({name:'Borrador Diario Federal · '+new Date().toISOString().slice(0,10),subject,sender:{name:senderName,email:senderEmail},htmlContent:html,recipients:{listIds:[listId]},type:'classic'})
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) return new Response(JSON.stringify({error:'Brevo rechazó el borrador',detail:data?.message || response.status}),{status:502});
  return new Response(JSON.stringify({ok:true,id:data.id,status:'draft'}),{headers:{'content-type':'application/json'}});
};