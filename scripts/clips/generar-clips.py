#!/usr/bin/env python3
"""Extrae clips verticales de videos largos, con transcripción, locución y música."""
import asyncio, json, os, re, subprocess, sys, tempfile, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INBOX = ROOT / "data/clips/entrada"
OUT = ROOT / "public/clips"
DATA = ROOT / "data/clips"
MUSIC = ROOT / "public/flash/musica/paulyudin.mp3"
OUT.mkdir(parents=True, exist_ok=True)

def run(cmd):
    subprocess.run(cmd, check=True)

def probe(path):
    raw = subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",str(path)], text=True)
    return float(raw.strip())

def transcribe(path):
    from faster_whisper import WhisperModel
    model = WhisperModel(os.getenv("WHISPER_MODEL","small"), device="cpu", compute_type="int8")
    segments, _ = model.transcribe(str(path), language="es", vad_filter=True, word_timestamps=True)
    return [{"start":s.start,"end":s.end,"text":s.text.strip()} for s in segments if s.text.strip()]

def choose_windows(segments, duration, limit=3):
    # Ventanas de 35–55 s. Puntúa densidad verbal, énfasis y cierre de oración.
    candidates=[]
    for s in segments:
        start=max(0,s["start"]-1.5); end=min(duration,s["start"]+48)
        chosen=[x for x in segments if x["start"]>=start and x["end"]<=end]
        text=" ".join(x["text"] for x in chosen).strip()
        secs=end-start
        if secs<18 or len(text.split())<28: continue
        words=len(text.split()); emph=sum(1 for w in re.findall(r"\b[A-ZÁÉÍÓÚÑ]{4,}\b",text) if w)
        score=min(words,115)+emph*2+(5 if re.search(r"[.!?]$",text) else 0)
        candidates.append((score,start,end,text))
    selected=[]
    for item in sorted(candidates, reverse=True):
        if all(item[2] < old[1]-8 or item[1] > old[2]+8 for old in selected):
            selected.append(item)
        if len(selected)>=limit: break
    return sorted(selected,key=lambda x:x[1])

async def voice(text, path):
    import edge_tts
    tts=edge_tts.Communicate(text, voice="es-AR-TomasNeural", rate="+3%")
    await tts.save(str(path))

def make_clip(source, item, idx, title, music):
    score,start,end,text=item
    slug=re.sub(r"[^a-z0-9]+","-",title.lower()).strip("-")[:48] or "clip"
    stem=f"{slug}-{idx:02d}"
    with tempfile.TemporaryDirectory() as td:
        td=Path(td); mp3=td/"voz.mp3"; srt=td/"sub.srt"
        asyncio.run(voice(text,mp3))
        # Subtítulos temporizados aproximados a partir de la transcripción.
        rows=[]
        words=text.split(); duration=end-start
        chunk=7; cursor=0
        for j in range(0,len(words),chunk):
            phrase=" ".join(words[j:j+chunk])
            a=duration*j/len(words); b=duration*min(j+chunk,len(words))/len(words)
            def stamp(v):
                ms=int(v*1000); h,ms=divmod(ms,3600000); m,ms=divmod(ms,60000); sec,ms=divmod(ms,1000)
                return f"{h:02}:{m:02}:{sec:02},{ms:03}"
            rows.append(f"{cursor+1}\n{stamp(a)} --> {stamp(b)}\n{phrase}\n"); cursor+=1
        srt.write_text("\n".join(rows),encoding="utf-8")
        # Video original sin sonido; la locución neural conduce el clip y la música queda de fondo.
        vf=f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,subtitles={str(srt).replace(':','\\\\:')}:force_style='FontName=Arial,FontSize=18,Bold=1,Outline=2,Shadow=1,Alignment=2,MarginV=190'"
        args=["ffmpeg","-y","-ss",str(start),"-i",str(source),"-i",str(mp3)]
        if music.exists(): args += ["-stream_loop","-1","-i",str(music)]
        args += ["-t",str(end-start),"-filter_complex"]
        if music.exists():
            args += [f"[0:v]{vf}[v];[1:a]volume=1.0[voice];[2:a]volume=0.12[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[a]"]
        else:
            args += [f"[0:v]{vf}[v];[1:a]volume=1.0[a]"]
        args += ["-map","[v]","-map","[a]","-c:v","libx264","-preset","veryfast","-crf","23","-c:a","aac","-b:a","160k","-movflags","+faststart",str(OUT/f"{stem}.mp4")]
        run(args)
    return {"id":stem,"titulo":text[:105].rsplit(" ",1)[0],"archivo":f"/clips/{stem}.mp4","duracion":round(end-start)}

def main():
    ids=sys.argv[1:]
    configs=[DATA/f"{x}.json" for x in ids] if ids else list(DATA.glob("*.json"))
    configs=[p for p in configs if p.name!="publicados.json" and p.exists()]
    manifest=[]
    for cfg in configs:
        job=json.loads(cfg.read_text(encoding="utf-8"))
        job["estado"]="procesando"; cfg.write_text(json.dumps(job,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        source=INBOX/job["archivo"]
        if not source.exists():
            parts=sorted(INBOX.glob(job["archivo"]+".part*"))
            if parts:
                with source.open("wb") as out:
                    for part in parts: out.write(part.read_bytes())
        if not source.exists(): raise FileNotFoundError(f"No se encontró el video fuente: {job['archivo']}")
        duration=probe(source); segments=transcribe(source)
        windows=choose_windows(segments,duration,int(job.get("cantidad",3)))
        if not windows: raise RuntimeError("No se encontraron fragmentos con suficiente contenido hablado.")
        clips=[make_clip(source,w,i+1,job.get("titulo","Diario Federal"),MUSIC) for i,w in enumerate(windows)]
        manifest.extend(clips)
        job.update({"estado":"publicado","clips":clips})
        cfg.write_text(json.dumps(job,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    published=DATA/"publicados.json"
    previous=json.loads(published.read_text()) if published.exists() else []
    byid={x["id"]:x for x in previous}
    for c in manifest: byid[c["id"]]=c
    published.write_text(json.dumps(list(byid.values()),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
if __name__=="__main__": main()
