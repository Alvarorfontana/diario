#!/usr/bin/env python3
"""Genera el boletín diario de Diario Federal desde las seis notas publicadas más recientes.

Requisitos gratuitos: edge-tts, PyYAML y ffmpeg. No usa API keys ni créditos.
Ejecución manual o automática desde GitHub Actions para publicar la edición diaria.
Solo toma artículos con draft=false; nunca lee borradores.
"""
import asyncio
import datetime as dt
import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path

import yaml
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
ARTICLES = ROOT / "src/content/articulos"
OUT = ROOT / "public/boletines"
MANIFEST = ROOT / "data/boletines/latest.json"
VOICE = "es-AR-TomasNeural"
MAX_ITEMS = 6

def read_article(path):
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", raw, re.S)
    if not m:
        return None
    data = yaml.safe_load(m.group(1)) or {}
    if data.get("draft") is True:
        return None
    date = data.get("pubDate")
    if isinstance(date, (dt.datetime, dt.date)):
        date = date.isoformat()
    date = str(date or path.stem[:10])
    description = clean(str(data.get("description") or ""))
    points = data.get("puntosClave") or []
    points = [clean(str(p)) for p in points if str(p).strip()]
    if not description and not points:
        return None
    return {
        "slug": path.stem,
        "title": clean(str(data.get("title") or path.stem)),
        "section": clean(str(data.get("section") or "Actualidad")),
        "date": date,
        "description": description,
        "points": points[:2],
        "url": "/articulo/" + path.stem + "/",
    }

def clean(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"[#*_\x60]", "", s)
    s = re.sub(r"https?://\S+", "", s)
    return re.sub(r"\s+", " ", s).strip()

def build_script(items, date_label):
    parts = [
        "Diario Federal. Boletín informativo.",
        "La información argentina y del mundo, en una mirada nacional y federal.",
        "Estas son las seis noticias principales de la edición de hoy."
    ]
    for i, item in enumerate(items, 1):
        parts.append(f"Noticia {i}. {item['section']}. {item['title']}.")
        if item["description"]:
            parts.append(item["description"])
        if item["points"]:
            parts.append(item["points"][0])
    parts.append("Hasta aquí el boletín informativo de Diario Federal. La información continúa en diariofederal punto com punto ar. Diario Federal. Periodismo con mirada nacional y federal.")
    return "\n\n".join(parts)

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    items = [x for p in ARTICLES.glob("*.md") if (x := read_article(p))]
    items.sort(key=lambda x: x["date"], reverse=True)
    items = items[:MAX_ITEMS]
    if len(items) < MAX_ITEMS:
        raise SystemExit(f"Se necesitan seis artículos publicados; encontrados: {len(items)}")
    today = dt.datetime.now(dt.timezone.utc).astimezone(dt.timezone(dt.timedelta(hours=-3)))
    date_label = today.strftime("%d/%m/%Y")
    script = build_script(items, date_label)
    digest = hashlib.sha256(script.encode()).hexdigest()[:12]
    name = "boletin-principal-" + today.strftime("%Y-%m-%d") + ".mp3"
    target = OUT / name
    with tempfile.TemporaryDirectory() as tmp:
        voice_file = Path(tmp) / "voz.mp3"
        await edge_tts.Communicate(script, VOICE, rate="-3%", volume="+0%").save(str(voice_file))
        # Cortina instrumental ambiental original, sintetizada localmente con FFmpeg.
        # No se descarga música ni se incorporan grabaciones con derechos de terceros.
        probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                "-of", "default=nw=1:nk=1", str(voice_file)],
                               capture_output=True, text=True, check=True)
        duration = float(probe.stdout.strip())
        bed = Path(tmp) / "cortina.wav"
        tone = "0.012*sin(2*PI*220*t)+0.010*sin(2*PI*261.63*t)+0.009*sin(2*PI*329.63*t)+0.006*sin(2*PI*392*t)"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
                        f"aevalsrc='{tone}':s=24000:d={duration:.3f}",
                        "-af", "lowpass=f=900,afade=t=in:st=0:d=2,afade=t=out:st=" + str(max(0,duration-3)) + ":d=3",
                        str(bed)], check=True)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(voice_file), "-i", str(bed),
                        "-filter_complex", "[0:a]volume=1.0[v];[1:a]volume=0.22[m];[v][m]amix=inputs=2:duration=first:dropout_transition=2",
                        "-ac", "1", "-ar", "24000", "-b:a", "64k", str(target)], check=True)
        probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                "-of", "default=nw=1:nk=1", str(target)],
                               capture_output=True, text=True, check=True)
        seconds = round(float(probe.stdout.strip()))
    manifest = {
        "title": "Boletín informativo principal",
        "date": today.date().isoformat(),
        "dateLabel": date_label,
        "archivo": "/boletines/" + name,
        "duracion": seconds,
        "voz": VOICE,
        "hash": digest,
        "items": [{"slug": x["slug"], "title": x["title"], "section": x["section"], "url": x["url"]} for x in items],
        "intro": "Diario Federal. Boletín informativo.",
        "outro": "La información continúa en diariofederal.com.ar.",
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generado {target} ({seconds}s), seis notas, voz {VOICE}.")

if __name__ == "__main__":
    asyncio.run(main())
