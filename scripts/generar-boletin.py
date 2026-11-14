#!/usr/bin/env python3
"""Genera el boletín de Diario Federal con locución ágil y cortina original."""
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
RATE = "+22%"
SAMPLE_RATE = 24000
MUSIC = ROOT / "public/flash/musica/starostin.mp3"


def clean(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"[#*_\x60]", "", s)
    s = re.sub(r"https?://\S+", "", s)
    s = s.replace("/", " ").replace("%", " por ciento ").replace("&", " y ")
    return re.sub(r"\s+", " ", s).strip()


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
    points = [clean(str(p)) for p in (data.get("puntosClave") or []) if str(p).strip()]
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


def concise_text(text, max_words=30):
    text = clean(text)
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chosen = []
    count = 0
    for sentence in sentences:
        n = len(sentence.split())
        if not sentence:
            continue
        if count + n > max_words:
            break
        chosen.append(sentence)
        count += n
    if not chosen:
        chosen = [" ".join(text.split()[:max_words])]
    result = " ".join(chosen).strip()
    if result and result[-1] not in ".!?":
        result += "."
    return result


def build_script(items):
    """Guion de flash: titulares encadenados, sin enumeración ni rótulos mecánicos."""
    parts = [
        "Diario Federal. Flash informativo.",
        "Las noticias más importantes, en un instante.",
    ]
    transitions = [
        "Vamos con la información.",
        "En el plano económico.",
        "Por otra parte, en la Argentina.",
        "En el escenario internacional.",
        "Y atención a este tema.",
        "Además, durante la jornada.",
    ]
    for i, item in enumerate(items):
        section = item["section"].lower().replace("-", " ").strip()
        if i == 0:
            lead = "Comenzamos con"
        else:
            lead = transitions[min(i, len(transitions) - 1)]
        title = item["title"].rstrip(".")
        summary = concise_text(item["description"], 34) if item["description"] else ""
        if not summary and item["points"]:
            summary = concise_text(item["points"][0], 30)
        if section in ("economia", "economía") and i > 0:
            lead = "En economía,"
        elif section in ("argentina", "política", "politica") and i > 0:
            lead = "En la Argentina,"
        elif section in ("mundo", "internacional") and i > 0:
            lead = "En el plano internacional,"
        if i == 0:
            parts.append(f"{lead}: {title}.")
        else:
            parts.append(f"{lead} {title}.")
        if summary and summary.rstrip(".") != title:
            parts.append(summary)
    parts.append(
        "Este fue el flash informativo de Diario Federal. "
        "La información sigue en diariofederal punto com punto ar."
    )
    return " ... ".join(parts)


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
    script = build_script(items)
    digest = hashlib.sha256((script + RATE).encode()).hexdigest()[:12]
    name = f"boletin-principal-{today:%Y-%m-%d}-{digest}.mp3"
    target = OUT / name

    with tempfile.TemporaryDirectory() as tmp:
        voice_file = Path(tmp) / "voz.mp3"
        await edge_tts.Communicate(script, VOICE, rate=RATE, volume="+0%").save(str(voice_file))
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(voice_file)],
            capture_output=True, text=True, check=True
        )
        voice_duration = float(probe.stdout.strip())
        if not MUSIC.exists():
            raise SystemExit(f"No se encuentra la cortina oficial del flash: {MUSIC}")
        total_duration = voice_duration + 1.5
        # Se usa la misma música del flash noticiero de Diario Federal.
        # Arranca sola, sostiene el ritmo y baja automáticamente debajo de la locución.
        subprocess.run([
            "ffmpeg", "-y", "-v", "error",
            "-i", str(MUSIC), "-i", str(voice_file),
            "-filter_complex",
            "[0:a]aloop=loop=-1:size=2e9,atrim=0:" + str(total_duration) + ",aresample=24000,"
            "volume=0.42,afade=t=out:st=" + str(max(0, total_duration - 2.2)) + ":d=2.2[bg];"
            "[1:a]adelay=1500|1500,loudnorm=I=-16:TP=-1.5:LRA=7[v];"
            "[bg][v]sidechaincompress=threshold=0.025:ratio=8:attack=25:release=500:makeup=1[duck];"
            "[duck][v]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95,"
            "loudnorm=I=-16:TP=-1.5:LRA=9[out]",
            "-map", "[out]", "-ac", "2", "-ar", str(SAMPLE_RATE), "-b:a", "128k", str(target)
        ], check=True)
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(target)],
            capture_output=True, text=True, check=True
        )
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
        "intro": "Diario Federal. La información, en primer plano.",
        "outro": "Más información durante toda la jornada en diariofederal.com.ar.",
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generado {target} ({seconds}s), seis noticias, cortina oficial del flash Diario Federal, voz {VOICE}, ritmo {RATE}.")


if __name__ == "__main__":
    asyncio.run(main())
