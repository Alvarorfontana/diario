export const prerender = false;
import { isAdmin } from '../../../lib/auth';
import { getRuntimeEnv } from '../../../lib/runtimeEnv';

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export const POST=async({request,locals}:any)=>{
 const env=getRuntimeEnv(locals);
 if(!(await isAdmin(request,env)))return json({ok:false,error:'No autorizado'},401);
 const key=env.GEMINI_API_KEY;
 if(!key)return json({ok:false,error:'Falta configurar GEMINI_API_KEY como secreto del entorno. No pegues la clave en el código.'},503);
 try{
  const body=await request.json();
  const titulo=String(body.titulo||'').trim().slice(0,180);
  const texto=String(body.texto||'').trim().slice(0,12000);
  const formato=String(body.formato||'clip breve de 8 segundos').slice(0,100);
  if(!titulo||!texto)return json({ok:false,error:'Faltan el título y el texto de base.'},400);
  const prompt=[
   'Actuá como asistente de producción audiovisual de un medio periodístico argentino.',
   'No inventes hechos, cifras, declaraciones, imágenes documentales ni fuentes. Trabajá únicamente con la información suministrada.',
   'Si falta información, señalalo como [DATO A VERIFICAR]. No presentes recreaciones como imágenes reales.',
   'Prepará una propuesta en español rioplatense con: enfoque, locución, secuencia de escenas con duración, texto en pantalla y sugerencias de imágenes/B-roll.',
   'Mantené tono periodístico sobrio. No agregues música comercial ni logotipos no suministrados.',
   'Formato solicitado: '+formato,
   'Título: '+titulo,
   'Material de base:\n'+texto
  ].join('\n\n');
  const model=env.GEMINI_MODEL||'gemini-2.5-flash';
  const upstream=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
   method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},
   body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.35,maxOutputTokens:1800}})
  });
  const data:any=await upstream.json();
  if(!upstream.ok)return json({ok:false,error:data?.error?.message||'Gemini no pudo completar la solicitud.'},502);
  const guion=(data?.candidates?.[0]?.content?.parts||[]).map((p:any)=>p.text||'').join('\n').trim();
  if(!guion)return json({ok:false,error:'Gemini no devolvió un guion. Revisá la cuota y el modelo habilitado.'},502);
  return json({ok:true,guion,model});
 }catch(error:any){return json({ok:false,error:error?.message||'Error interno al preparar el guion.'},500);}
};