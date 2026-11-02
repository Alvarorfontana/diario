export const prerender = false;
import { getRuntimeEnv } from '../../../lib/runtimeEnv';
import { isAdmin } from '../../../lib/auth';
import { ghConfig, getFile, listDir, putBase64, putFile } from '../../../lib/github';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const safe=(s:string)=>/^[a-z0-9][a-z0-9-]{2,55}$/.test(s);
async function guard(request:Request,locals:any){
 const env=getRuntimeEnv(locals);
 if(!(await isAdmin(request,env))) return {error:json({ok:false,error:'No autorizado'},401)};
 const cfg=ghConfig(env);
 if(!cfg) return {error:json({ok:false,error:'Falta GITHUB_PAT'},500)};
 return {cfg};
}
export const GET=async({request,locals}:any)=>{
 const g=await guard(request,locals); if(g.error)return g.error;
 try{
  const url=new URL(request.url), video=url.searchParams.get('video');
  if(video){
   if(!/^data\/clips\/revision\/[a-z0-9-]+\.mp4$/.test(video))return json({ok:false,error:'Archivo inválido'},400);
   const raw=await fetch(`https://api.github.com/repos/${g.cfg!.repo}/contents/${video.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(g.cfg!.branch)}`,{headers:{Authorization:`Bearer ${g.cfg!.token}`,Accept:'application/vnd.github.raw', 'User-Agent':'diario-federal-admin'},cache:'no-store'});
   if(!raw.ok)return json({ok:false,error:'No se pudo recuperar el clip'},raw.status);
   return new Response(raw.body,{headers:{'content-type':'video/mp4','cache-control':'private, no-store','content-disposition':'inline'}});
  }
  const file=await getFile(g.cfg!,'data/clips/revision.json');
  return json({ok:true,clips:file?JSON.parse(file.text):[]});
 }catch(e:any){return json({ok:false,error:e.message},500);}
};
export const POST=async({request,locals}:any)=>{
 const g=await guard(request,locals); if(g.error)return g.error;
 try{
  const ct=request.headers.get('content-type')||'';
  if(ct.includes('multipart/form-data')){
   const fd=await request.formData();
   const id=String(fd.get('id')||''), name=String(fd.get('nombre')||''), part=Number(fd.get('parte')||0), file=fd.get('file');
   if(!safe(id)||!/^[a-z0-9][a-z0-9._-]{1,90}$/i.test(name)||!Number.isInteger(part)||part<0||part>59||!(file instanceof File)||file.size>3200000)
    return json({ok:false,error:'Parte o nombre de archivo inválido'},400);
   const bytes=new Uint8Array(await file.arrayBuffer()); let bin='';
   for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
   await putBase64(g.cfg!,'data/clips/entrada/'+id+'/'+name+'.part'+String(part).padStart(3,'0'),btoa(bin),'[sin-deploy] Clips: cargar '+id+' parte '+(part+1));
   return json({ok:true,parte:part});
  }
  const body=await request.json();
  if(body.action==='aprobar'){
   const id=String(body.id||'');
   if(!safe(id))return json({ok:false,error:'Clip inválido'},400);
   const manifest=await getFile(g.cfg!,'data/clips/revision.json');
   const clips=manifest?JSON.parse(manifest.text):[];
   const clip=clips.find((c:any)=>c.id===id);
   if(!clip||typeof clip.archivo!=='string'||!clip.archivo.startsWith('data/clips/revision/'))return json({ok:false,error:'El clip no está pendiente de revisión'},404);
   const approval={id,archivo:clip.archivo,titulo:clip.titulo,aprobado:new Date().toISOString()};
   await putFile(g.cfg!,'data/clips/aprobaciones/'+id+'.json',JSON.stringify(approval,null,2)+'\n','Clips: aprobación manual '+id);
   return json({ok:true,mensaje:'Aprobación registrada. Se publicará en Canal al finalizar el despliegue.'});
  }
  if(body.action!=='crear'||!safe(body.id)||typeof body.nombre!=='string'||!(/^[a-z0-9][a-z0-9._-]{1,90}$/i.test(body.nombre)))return json({ok:false,error:'Trabajo inválido'},400);
  const job={id:body.id,titulo:String(body.titulo||'Video Diario Federal').slice(0,140),archivo:body.id+'/'+body.nombre,cantidad:Math.max(1,Math.min(5,Number(body.cantidad)||3)),estado:'pendiente',creado:new Date().toISOString()};
  await putFile(g.cfg!,'data/clips/trabajos/'+body.id+'.json',JSON.stringify(job,null,2)+'\n','Clips: procesar '+body.id);
  return json({ok:true,trabajo:job});
 }catch(e:any){return json({ok:false,error:e.message},500);}
};
