#!/usr/bin/env python3
"""Genera clips en una carpeta de revisión; nunca los publica directamente."""
import asyncio, json, os, re, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
INBOX=ROOT/"data/clips/entrada"
DATA=ROOT/"data/clips"
OUT=DATA/"revision"
MUSIC=ROOT/"public/flash/musica/paulyudin.mp3"
OUT.mkdir(parents=True,exist_ok=True)
def run(cmd): subprocess.run(cmd,check=True)
def probe(path):
 raw=subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",str(path)],text=True);return float(raw.strip())
def transcribe(path):
 from faster_whisper import WhisperModel
 model=WhisperModel(os.getenv("WHISPER_MODEL","small"),device="cpu",compute_type="int8")
 segments,_=model.transcribe(str(path),language="es",vad_filter=True,word_timestamps=True)
 return [{"start":s.start,"end":s.end,"text":s.text.strip()} for s in segments if s.text.strip()]
def choose_windows(segments,duration,limit=3):
 candidates=[]
 for s in segments:
  start=max(0,s["start"]-1.5);end=min(duration,s["start"]+48);chosen=[x for x in segments if x["start"]>=start and x["end"]<=end];text=" ".join(x["text"] for x in chosen).strip();secs=end-start
  if secs<18 or len(text.split())<28:continue
  words=len(text.split());emph=len(re.findall(r"\b[A-ZÁÉÍÓÚÑ]{4,}\b",text));score=min(words,115)+emph*2+(5 if re.search(r"[.!?]$",text) else 0);candidates.append((score,start,end,text))
 selected=[]
 for item in sorted(candidates,reverse=True):
  if all(item[2]<old[1]-8 or item[1]>old[2]+8 for old in selected):selected.append(item)
  if len(selected)>=limit:break
 return sorted(selected,key=lambda x:x[1])
async def voice(text,path):
 import edge_tts
 await edge_tts.Communicate(text,voice="es-AR-TomasNeural",rate="+3%").save(str(path))
def make_clip(source,item,idx,title,music):
 score,start,end,transcript=item;slug=re.sub(r"[^a-z0-9]+","-",title.lower()).strip("-")[:48] or "clip";stem=f"{slug}-{idx:02d}"
 with tempfile.TemporaryDirectory() as td:
  td=Path(td);mp3=td/"voz.mp3";srt=td/"sub.srt";asyncio.run(voice(transcript,mp3))
  words=transcript.split();duration=end-start;rows=[]
  def stamp(v):
   ms=int(v*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);sec,ms=divmod(ms,1000);return f"{h:02}:{m:02}:{sec:02},{ms:03}"
  for j in range(0,len(words),7):
   phrase=" ".join(words[j:j+7]);a=duration*j/len(words);b=duration*min(j+7,len(words))/len(words);rows.append(f"{len(rows)+1}\n{stamp(a)} --> {stamp(b)}\n{phrase}\n")
  srt.write_text("\n".join(rows),encoding="utf-8")
  vf=f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,subtitles={str(srt)}:force_style='FontName=Arial,FontSize=18,Bold=1,Outline=2,Shadow=1,Alignment=2,MarginV=190'"
  args=["ffmpeg","-y","-ss",str(start),"-i",str(source),"-i",str(mp3)]
  if music.exists():args+=["-stream_loop","-1","-i",str(music)]
  args+=["-t",str(end-start),"-filter_complex"]
  if music.exists():args += [f"[0:v]{vf}[v];[1:a]volume=1.0[voice];[2:a]volume=0.12[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[a]"]
  else:args += [f"[0:v]{vf}[v];[1:a]volume=1.0[a]"]
  target=OUT/f"{stem}.mp4";args += ["-map","[v]","-map","[a]","-c:v","libx264","-preset","veryfast","-crf","23","-c:a","aac","-b:a","160k","-movflags","+faststart",str(target)];run(args)
 return {"id":stem,"titulo":transcript[:105].rsplit(" ",1)[0],"archivo":f"data/clips/revision/{stem}.mp4","duracion":round(end-start)}
def main():
 configs=list((DATA/"trabajos").glob("*.json"));manifest_path=DATA/"revision.json";previous=json.loads(manifest_path.read_text()) if manifest_path.exists() else [];byid={x["id"]:x for x in previous}
 for cfg in configs:
  job=json.loads(cfg.read_text(encoding="utf-8"))
  if job.get("estado") not in ("pendiente","procesando"):continue
  job["estado"]="procesando";cfg.write_text(json.dumps(job,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
  source=INBOX/job["archivo"]
  if not source.exists():
   parts=sorted(INBOX.glob(job["archivo"]+".part*"))
   if parts:
    with source.open("wb") as out:
     for part in parts:out.write(part.read_bytes())
  if not source.exists():raise FileNotFoundError(f"No se encontró el video fuente: {job['archivo']}")
  segments=transcribe(source);windows=choose_windows(segments,probe(source),int(job.get("cantidad",3)))
  if not windows:raise RuntimeError("No se encontraron fragmentos con suficiente contenido hablado.")
  clips=[make_clip(source,w,i+1,job.get("titulo","Diario Federal"),MUSIC) for i,w in enumerate(windows)]
  byid.update({c["id"]:c for c in clips});job.update({"estado":"revision","clips":[c["id"] for c in clips]});cfg.write_text(json.dumps(job,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 manifest_path.write_text(json.dumps(list(byid.values()),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
if __name__=="__main__":main()
