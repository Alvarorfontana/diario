#!/usr/bin/env python3
"""Genera el boletín de Diario Federal con locución ágil y cortina original."""
import asyncio
import datetime as dt
import hashlib
import json
import math
import re
import struct
import subprocess
import tempfile
import wave
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
    parts = [
        "Diario Federal. La información, en primer plano.",
        "Estos son los principales títulos.",
    ]
    for i, item in enumerate(items, 1):
        parts.append(f"Titular {i}. {item['title']}.")
    parts.append("Ahora, las noticias.")
    for i, item in enumerate(items, 1):
        section = item["section"].replace("-", " ")
        parts.append(f"En {section}.")
        summary = concise_text(item["description"], 30) if item["description"] else ""
        if not summary and item["points"]:
            summary = concise_text(item["points"][0], 26)
        if summary:
            parts.append(summary)
    parts.append(
        "Hasta aquí el boletín de Diario Federal. "
        "Más información, durante toda la jornada, en diariofederal punto com punto ar."
    )
    return " ".join(parts)


def make_music(path, duration):
    """Cortina musical original: acordes cálidos, bajo pulsante y acentos rítmicos."""
    sr = SAMPLE_RATE
    total = int(sr * duration)
    chords = [
        (261.63, 329.63, 392.00),  # Do
        (220.00, 261.63, 329.63),  # La menor
        (174.61, 220.00, 261.63),  # Fa
        (196.00, 246.94, 293.66),  # Sol
    ]
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sr)
        frames = bytearray()
        for start in range(0, total, 2048):
            block = min(2048, total - start)
            for j in range(block):
                n = start + j
                t = n / sr
                chord = chords[int(t // 3.0) % len(chords)]
                # Pad armónico suave, con movimiento para evitar un tono plano.
                pad = sum(math.sin(2 * math.pi * f * t) for f in chord) / 3
                shimmer = 0.22 * math.sin(2 * math.pi * chord[2] * 2 * t)
                # Bajo marcado cada medio segundo y pequeño acento tipo pulso radial.
                beat_phase = t % 0.545
                beat = math.sin(2 * math.pi * 65.41 * t) * math.exp(-beat_phase * 9) if beat_phase < 0.24 else 0
                tick_phase = t % 1.09
                tick = math.sin(2 * math.pi * 1046.5 * t) * math.exp(-tick_phase * 30) if tick_phase < 0.055 else 0
                fade_in = min(1.0, t / 1.2)
                fade_out = min(1.0, max(0.0, (duration - t) / 1.8))
                sample = (0.46 * pad + 0.08 * shimmer + 0.20 * beat + 0.035 * tick) * fade_in * fade_out
                sample = max(-0.85, min(0.85, sample))
                frames.extend(struct.pack("<h", int(sample * 32767)))
            wav.writeframesraw(frames)
            frames.clear()


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
        music_file = Path(tmp) / "cortina.wav"
        await edge_tts.Communicate(script, VOICE, rate=RATE, volume="+0%").save(str(voice_file))
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(voice_file)],
            capture_output=True, text=True, check=True
        )
        voice_duration = float(probe.stdout.strip())
        make_music(music_file, voice_duration + 2.0)
        # Dos segundos de identificación musical; luego la voz entra sobre la cortina.
        subprocess.run([
            "ffmpeg", "-y", "-v", "error",
            "-i", str(voice_file), "-i", str(music_file),
            "-filter_complex",
            "[0:a]adelay=1600|1600,loudnorm=I=-16:TP=-1.5:LRA=7[v];"
            "[1:a]volume=0.34,afade=t=out:st=" + str(max(0, voice_duration - 1)) + ":d=2[m];"
            "[m][v]amix=inputs=2:duration=longest:dropout_transition=1,"
            "loudnorm=I=-16:TP=-1.5:LRA=7[out]",
            "-map", "[out]", "-ac", "1", "-ar", str(SAMPLE_RATE), "-b:a", "96k", str(target)
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
    print(f"Generado {target} ({seconds}s), seis noticias, voz {VOICE}, ritmo {RATE}.")


if __name__ == "__main__":
    asyncio.run(main())
