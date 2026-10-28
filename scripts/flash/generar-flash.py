#!/usr/bin/env python3
"""
Genera los videos "Flash" del diario (semanal o de último momento).

Lo corre GitHub Actions (.github/workflows/flash.yml) cada vez que el panel
/admin/flash guarda un flash con estado "generar". Para cada uno:
  1. arma la voz de cada bloque con una voz neural (Microsoft Edge TTS, gratis),
     aplicando la lista de pronunciación (data/flash/pronunciacion.json);
  2. dibuja las placas con la marca del diario (titular, dato, bajada) y la foto
     o el video de cada noticia con su epígrafe y su fuente;
  3. mezcla la música elegida por debajo de la voz;
  4. guarda el video en public/flash/<id>.mp4 y anota en el JSON la duración
     real de cada bloque (eso afina el contador de duración del panel).

Uso local:  python scripts/flash/generar-flash.py [id ...]
Sin ids, procesa todos los flashes con estado "generar".
Variable MOTOR=kokoro: usa una voz local (solo para pruebas sin internet).
"""

import asyncio
import datetime as dt
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent.parent
DATOS = RAIZ / "data" / "flash"
SALIDA = RAIZ / "public" / "flash"
FUENTES = Path(__file__).resolve().parent / "fuentes"
PRONUNCIACION = DATOS / "pronunciacion.json"
CALIBRACION = DATOS / "calibracion.json"

W, H, FPS = 1920, 1080, 30
INK = (22, 22, 26); RED = (208, 2, 27); WHITE = (255, 255, 255); GREY = (170, 170, 176)
PX, PY, PW, PH = 1000, 180, 820, 740
MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO",
         "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]

_cache = {}
def fuente(nombre, tam):
    k = (nombre, tam)
    if k not in _cache:
        _cache[k] = ImageFont.truetype(str(FUENTES / f"{nombre}.woff"), tam)
    return _cache[k]
man = lambda w, s: fuente(f"manrope-latin-{w}-normal", s)
inter = lambda w, s: fuente(f"inter-latin-{w}-normal", s)
serif = lambda s: fuente("newsreader-latin-700-normal", s)
serif_it = lambda s: fuente("newsreader-latin-400-italic", s)


def pantalla(txt):
    """Las tipografías cubren el alfabeto latino básico: č, ć, ş… se muestran sin el signo."""
    out = []
    for ch in str(txt or ""):
        if ord(ch) < 0x250 and (ord(ch) < 0x100 or ch in "ŒœŠšŽžŸ"):
            out.append(ch)
        else:
            out.append(unicodedata.normalize("NFKD", ch)[0])
    return "".join(out)


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def partir(texto, font, ancho):
    words, lines, cur = pantalla(texto).split(), [], ""
    medir = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    for wd in words:
        test = (cur + " " + wd).strip()
        if cur and medir.textlength(test, font=font) > ancho:
            lines.append(cur); cur = wd
        else:
            cur = test
    if cur: lines.append(cur)
    return lines


def con_alfa(im, dibujar, alfa):
    """Dibuja con transparencia sólo mientras dura el fundido (después, directo y rápido)."""
    if alfa <= 0: return
    if alfa >= 1:
        dibujar(ImageDraw.Draw(im), 255); return
    capa = Image.new("RGBA", im.size, (0, 0, 0, 0))
    dibujar(ImageDraw.Draw(capa), int(255 * alfa))
    im.paste(capa, (0, 0), capa)


def logo(d, x, y, s=1.0, a=255):
    q = int(34 * s)
    d.rounded_rectangle([x, y, x + q, y + q], radius=int(8 * s), fill=RED + (a,))
    d.text((x + q + int(18 * s), y + q / 2), "DIARIO FEDERAL", font=man(800, int(44 * s)), fill=WHITE + (a,), anchor="lm")


# ── Medios (fotos y videos) ─────────────────────────────────────────────────

def reunir(ruta_rel, tmp):
    """Los archivos grandes se suben en partes (.part000, .part001…): acá se vuelven a unir."""
    if not ruta_rel: return None
    ruta = RAIZ / ruta_rel.lstrip("/")
    if ruta_rel.startswith("/flash/") or ruta_rel.startswith("/uploads/"):
        ruta = RAIZ / "public" / ruta_rel.lstrip("/")
    if ruta.exists(): return ruta
    partes = sorted(ruta.parent.glob(ruta.name + ".part*"))
    if not partes: return None
    destino = Path(tmp) / ruta.name
    with open(destino, "wb") as out:
        for p in partes: out.write(p.read_bytes())
    return destino


def cover(img, w, h, foco=(0.5, 0.5)):
    s = max(w / img.width, h / img.height)
    img = img.resize((int(img.width * s) + 1, int(img.height * s) + 1), Image.LANCZOS)
    x = int((img.width - w) * foco[0]); y = int((img.height - h) * foco[1])
    return img.crop((x, y, x + w, y + h))


def panel_marca(kicker):
    im = Image.new("RGB", (PW, PH), (32, 32, 38))
    d = ImageDraw.Draw(im)
    for i in range(0, PW + PH, 46):
        d.line([(i, 0), (i - PH, PH)], fill=(38, 38, 45), width=14)
    d.rounded_rectangle([PW / 2 - 60, PH / 2 - 100, PW / 2 + 60, PH / 2 + 20], radius=26, fill=RED)
    d.text((PW / 2, PH / 2 + 80), pantalla(kicker), font=man(800, 40), fill=WHITE, anchor="mm")
    return im


def preparar_medio(b, dur, tmp, idx):
    m = b.get("media") or {}
    ruta = reunir(m.get("archivo"), tmp)
    if not ruta:
        fondo = panel_marca(b.get("kicker", ""))
        return lambda t: fondo
    es_video = m.get("tipo") == "video" or ruta.suffix.lower() in (".mp4", ".mov", ".webm", ".m4v")
    if not es_video:
        img = Image.open(ruta).convert("RGB")
        foco = tuple(m.get("foco") or (0.5, 0.4))
        def f(t, img=img):
            z = 1 + 0.06 * (t / max(dur, 0.1))
            big = cover(img, int(PW * z), int(PH * z), foco)
            x, y = (big.width - PW) // 2, (big.height - PH) // 2
            return big.crop((x, y, x + PW, y + PH))
        return f
    raw = Path(tmp) / f"medio{idx}.rgb"
    n = int(dur * FPS) + 2
    vf = (f"[0:v]fps={FPS},split[a][b];[a]scale={PW}:{PH}:force_original_aspect_ratio=increase,crop={PW}:{PH},"
          f"boxblur=25:2,eq=brightness=-0.25[bg];[b]scale={PW}:{PH}:force_original_aspect_ratio=decrease[fg];"
          f"[bg][fg]overlay=(W-w)/2:(H-h)/2")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-stream_loop", "-1", "-ss", str(float(m.get("inicio") or 0)),
                    "-i", str(ruta), "-filter_complex", vf, "-frames:v", str(n), "-an",
                    "-f", "rawvideo", "-pix_fmt", "rgb24", str(raw)], check=True)
    mm = np.memmap(raw, dtype=np.uint8, mode="r").reshape(-1, PH, PW, 3)
    return lambda t: Image.fromarray(np.array(mm[min(int(t * FPS), len(mm) - 1)]))


# ── Placas ──────────────────────────────────────────────────────────────────

def placa_intro(t, flash):
    im = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(im)
    urgente = flash.get("tipo") == "ultimo"
    d.rectangle([0, 470, int(W * ease(t / 0.8)), 610], fill=RED)
    rotulo = "ÚLTIMO MOMENTO" if urgente else "FLASH SEMANAL"
    con_alfa(im, lambda d, a: d.text((W / 2, 540), rotulo, font=man(800, 96), fill=WHITE + (a,), anchor="mm"), ease((t - 0.3) / 0.5))
    con_alfa(im, lambda d, a: logo(d, 700, 330, 1.2, a), ease(t / 0.6))
    con_alfa(im, lambda d, a: d.text((W / 2, 700), pantalla(flash["rotulo"]), font=inter(600, 34), fill=GREY + (a,), anchor="mm"), ease((t - 0.6) / 0.5))
    if urgente and int(t * 2) % 2 == 0:
        d = ImageDraw.Draw(im); d.ellipse([W / 2 - 330, 650 + 120, W / 2 - 306, 674 + 120], fill=RED)
    return im


def placa_bloque(b, t, dur, idx, n, medio, flash):
    im = Image.new("RGB", (W, H), INK)
    fl = medio(t).copy()
    if b.get("epigrafe") or b.get("fuente"):
        grad = Image.new("L", (1, 170)); grad.putdata([int(225 * (i / 169) ** 1.4) for i in range(170)])
        fl.paste(Image.new("RGB", (PW, 170), (0, 0, 0)), (0, PH - 170), grad.resize((PW, 170)))
        gd = ImageDraw.Draw(fl)
        gd.text((28, PH - 80), pantalla(b.get("epigrafe", ""))[:60], font=inter(600, 28), fill=WHITE)
        gd.text((28, PH - 42), pantalla(b.get("fuente", ""))[:80], font=inter(500, 22), fill=(205, 205, 210))
    mask = Image.new("L", (PW, PH), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, PW, PH], radius=18, fill=int(255 * ease(t / 0.5)))
    im.paste(fl, (PX + int(60 * (1 - ease(t / 0.6))), PY), mask)
    d = ImageDraw.Draw(im)
    logo(d, 100, 70, 0.8)
    d.text((W - 100, 87), pantalla(flash["rotulo"]), font=inter(600, 24), fill=GREY, anchor="rm")
    d.line([100, 140, W - 100, 140], fill=(60, 60, 66), width=2)
    dx = int(-40 * (1 - ease(t / 0.5)))
    d.rectangle([100, 262, 100 + int(14 * ease(t / 0.3)), 300], fill=RED)
    con_alfa(im, lambda d, a: d.text((130 + dx, 262), pantalla(b.get("kicker", "")).upper(), font=man(800, 34), fill=RED + (a,)), ease(t / 0.4))
    # titular: achica la letra si no entra en dos renglones
    for tam in (92, 80, 68, 60):
        tf = serif(tam); lineas = partir(b.get("titulo", ""), tf, 840)
        if len(lineas) <= 2: break
    lineas = lineas[:3]
    y = 330
    for ln in lineas:
        con_alfa(im, lambda d, a, y=y, ln=ln: d.text((100 + dx, y), ln, font=tf, fill=WHITE + (a,)), ease((t - 0.15) / 0.5))
        y += int(tam * 1.13)
    y += 30
    if b.get("dato"):
        for tam_d in (78, 66, 56):
            df = man(800, tam_d)
            if ImageDraw.Draw(im).textlength(pantalla(b["dato"]), font=df) <= 850: break
        con_alfa(im, lambda d, a, y=y: d.text((100 + dx, y), pantalla(b["dato"]), font=df, fill=WHITE + (a,)), ease((t - 0.5) / 0.5))
        y += int(tam_d * 1.4)
    for ln in partir(b.get("bajada", ""), inter(500, 36), 860)[:3]:
        con_alfa(im, lambda d, a, y=y, ln=ln: d.text((100 + dx, y), ln, font=inter(500, 36), fill=GREY + (a,)), ease((t - 0.8) / 0.5))
        y += 50
    d = ImageDraw.Draw(im)
    d.rectangle([0, H - 120, W, H], fill=(14, 14, 17))
    seg = (W - 200) / n
    for i in range(n):
        x0 = 100 + i * seg + 6; x1 = 100 + (i + 1) * seg - 6
        d.rectangle([x0, H - 48, x1, H - 40], fill=(60, 60, 66))
        lleno = 1 if i < idx else (t / dur if i == idx else 0)
        if lleno > 0: d.rectangle([x0, H - 48, x0 + (x1 - x0) * lleno, H - 40], fill=RED)
    etiqueta = "ÚLTIMO MOMENTO" if flash.get("tipo") == "ultimo" else f"{idx + 1:02d} / {n:02d}"
    d.text((100, H - 92), etiqueta, font=man(800, 22), fill=RED if flash.get("tipo") == "ultimo" else WHITE)
    d.text((W - 100, H - 92), "diariofederal.com.ar", font=man(700, 22), fill=GREY, anchor="ra")
    return im


def placa_cierre(t):
    im = Image.new("RGB", (W, H), INK)
    con_alfa(im, lambda d, a: logo(d, 640, 440, 1.5, a), ease(t / 0.6))
    con_alfa(im, lambda d, a: d.text((W / 2, 620), "diariofederal.com.ar", font=man(700, 44), fill=WHITE + (a,), anchor="mm"), ease((t - 0.4) / 0.5))
    con_alfa(im, lambda d, a: d.text((W / 2, 690), "Periodismo con mirada federal", font=serif_it(38), fill=GREY + (a,), anchor="mm"), ease((t - 0.7) / 0.5))
    return im


# ── Voz ─────────────────────────────────────────────────────────────────────

def cargar_json(ruta, defecto):
    try: return json.loads(Path(ruta).read_text(encoding="utf-8"))
    except Exception: return defecto


def pronunciar(texto, dicc):
    for escrito, dicho in sorted(dicc.items(), key=lambda kv: -len(kv[0])):
        if escrito.strip() and dicho.strip():
            texto = re.sub(r"(?<!\w)" + re.escape(escrito.strip()) + r"(?!\w)", dicho.strip(), texto)
    return texto


async def _edge(texto, voz, vel, destino):
    import edge_tts
    rate = f"{'+' if vel >= 0 else ''}{int(vel)}%"
    await edge_tts.Communicate(texto, voz, rate=rate).save(destino)


def sintetizar(texto, voz, vel, destino_wav, tmp):
    if os.environ.get("MOTOR") == "kokoro":
        from kokoro_onnx import Kokoro
        k = Kokoro(os.environ["KOKORO_MODELO"], os.environ["KOKORO_VOCES"])
        import soundfile as sf
        a, sr = k.create(texto, voice="em_alex", speed=1 + vel / 100, lang="es")
        sf.write(destino_wav, a, sr, subtype="PCM_16")
    else:
        mp3 = Path(tmp) / (Path(destino_wav).stem + ".mp3")
        for intento in range(3):
            try:
                asyncio.run(_edge(texto, voz, vel, str(mp3))); break
            except Exception:
                if intento == 2: raise
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-ar", "24000", "-ac", "1", destino_wav], check=True)
    # recorta el silencio del final y deja 0,15 s de aire al principio
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", destino_wav, "-af",
                    "areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=150",
                    "-ar", "24000", "-ac", "1", destino_wav + ".t.wav"], check=True)
    os.replace(destino_wav + ".t.wav", destino_wav)


def dur_wav(p):
    with wave.open(str(p)) as w: return w.getnframes() / w.getframerate()


# ── Armado ──────────────────────────────────────────────────────────────────

def rotulo_de(flash):
    try: f = dt.date.fromisoformat(str(flash.get("fecha"))[:10])
    except Exception: f = dt.date.today()
    fecha = f"{f.day} DE {MESES[f.month - 1]} DE {f.year}"
    return f"SEMANA DEL {fecha}" if flash.get("tipo") != "ultimo" else fecha


def generar(flash):
    dicc = cargar_json(PRONUNCIACION, {})
    voz = flash.get("voz") or "es-AR-TomasNeural"
    vel = float(flash.get("velocidad", 8) or 0)
    flash["rotulo"] = rotulo_de(flash)
    bloques = [b for b in flash.get("bloques", []) if (b.get("texto") or "").strip()]
    if not bloques: raise ValueError("El flash no tiene ningún bloque con texto")
    urgente = flash.get("tipo") == "ultimo"
    intro = flash.get("intro") or ("Diario Federal. Último momento." if urgente else "Diario Federal. El flash de la semana.")
    cierre = flash.get("cierre") or "Esto fue el flash de Diario Federal. Más noticias en diariofederal punto com punto ar."

    with tempfile.TemporaryDirectory() as tmp:
        segs = [("intro", intro)] + [(f"b{i}", b["texto"]) for i, b in enumerate(bloques)] + [("cierre", cierre)]
        voces = {}
        for k, txt in segs:
            p = str(Path(tmp) / f"{k}.wav")
            sintetizar(pronunciar(txt, dicc), voz, vel, p, tmp)
            voces[k] = p
            print(f"  voz {k}: {dur_wav(p):.1f} s", flush=True)

        INTRO_PRE, GAP, LEAD = 2.0, 0.9, 0.3
        linea, t = [], 0.0
        for k, _ in segs:
            vd = dur_wav(voces[k])
            if k == "intro": dur, vs = INTRO_PRE + vd + GAP, t + INTRO_PRE
            elif k == "cierre": dur, vs = LEAD + vd + 3.0, t + LEAD
            else: dur, vs = LEAD + vd + GAP, t + LEAD
            linea.append((k, t, dur, vs)); t += dur
        total = t

        sr = 24000
        pista = np.zeros(int(total * sr) + sr, dtype=np.float32)
        for k, st, dur, vs in linea:
            with wave.open(voces[k]) as w:
                a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
            i = int(vs * sr); pista[i:i + len(a)] += a[:len(pista) - i]
        voz_wav = Path(tmp) / "voz.wav"
        with wave.open(str(voz_wav), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
            w.writeframes((np.clip(pista[:int(total * sr)], -1, 1) * 32767).astype(np.int16).tobytes())

        medios = {}
        for i, b in enumerate(bloques):
            dur = next(d for k, s, d, v in linea if k == f"b{i}")
            medios[i] = preparar_medio(b, dur, tmp, i)

        mudo = Path(tmp) / "mudo.mp4"
        ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                               "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast",
                               "-crf", "24", "-pix_fmt", "yuv420p", str(mudo)], stdin=subprocess.PIPE)
        negro = Image.new("RGB", (W, H), INK)
        for f in range(int(total * FPS)):
            tt = f / FPS
            for k, st, dur, vs in linea:
                if st <= tt < st + dur: break
            lt = tt - st
            if k == "intro": im = placa_intro(lt, flash)
            elif k == "cierre": im = placa_cierre(lt)
            else:
                i = int(k[1:]); im = placa_bloque(bloques[i], lt, dur, i, len(bloques), medios[i], flash)
            fade = min(1, lt / 0.25, (dur - lt) / 0.25)
            if fade < 1: im = Image.blend(negro, im, max(0, fade))
            ff.stdin.write(im.tobytes())
        ff.stdin.close(); ff.wait()

        SALIDA.mkdir(parents=True, exist_ok=True)
        destino = SALIDA / f"{flash['id']}.mp4"
        musica = reunir(flash.get("musica") or "/flash/musica/paulyudin.mp3", tmp)
        vi = linea[0][3]; ve = linea[-1][3] + dur_wav(voces["cierre"])
        db = float(flash.get("volumenMusica", -17))
        vol = f"if(lt(t,{vi:.2f}),1,if(gt(t,{ve:.2f}),1,{10 ** (db / 20):.3f}))"
        if musica:
            flt = (f"[1:a]aloop=loop=-1:size=2e9,atrim=0:{total:.2f},volume='{vol}':eval=frame,"
                   f"afade=t=out:st={total - 2.5:.2f}:d=2.5,volume=0.55[m];"
                   f"[2:a]aresample=44100,volume=1.6[v];[m][v]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]")
            cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(mudo), "-i", str(musica), "-i", str(voz_wav),
                   "-filter_complex", flt, "-map", "0:v", "-map", "[a]"]
        else:
            cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(mudo), "-i", str(voz_wav), "-map", "0:v", "-map", "1:a",
                   "-af", "volume=1.6,alimiter=limit=0.95"]
        subprocess.run(cmd + ["-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
                              "-shortest", str(destino)], check=True)
        # miniatura para la página y para compartir
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{linea[1][1] + 2.5:.2f}", "-i", str(destino),
                        "-frames:v", "1", "-vf", "scale=1200:-2", "-q:v", "4", str(SALIDA / f"{flash['id']}.jpg")], check=True)

        caracteres = sum(len(txt) for k, txt in segs if k.startswith("b"))
        segundos = sum(dur_wav(voces[k]) for k, _ in segs if k.startswith("b"))
        flash["duracion"] = round(total, 1)
        flash["duraciones"] = [round(dur_wav(voces[f"b{i}"]), 1) for i in range(len(bloques))]
        flash["video"] = f"/flash/{flash['id']}.mp4"
        flash["miniatura"] = f"/flash/{flash['id']}.jpg"
        flash["version"] = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d%H%M%S")
        flash["generado"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        return caracteres, segundos, voz, vel


def main():
    ids = sys.argv[1:]
    archivos = [DATOS / f"{i}.json" for i in ids] if ids else sorted(DATOS.glob("*.json"))
    calib = cargar_json(CALIBRACION, {})
    hubo_error = False
    for ruta in archivos:
        if ruta.name in ("pronunciacion.json", "calibracion.json") or not ruta.exists(): continue
        flash = cargar_json(ruta, None)
        if not flash or (not ids and flash.get("estado") != "generar"): continue
        print(f"Generando {flash.get('id')}…", flush=True)
        try:
            car, seg, voz, vel = generar(flash)
            flash["estado"] = "listo"; flash.pop("error", None)
            clave = f"{voz}|{int(vel)}"
            c = calib.get(clave, {"caracteres": 0, "segundos": 0})
            c["caracteres"] += car; c["segundos"] += seg
            c["porSegundo"] = round(c["caracteres"] / max(c["segundos"], 1), 2)
            calib[clave] = c
        except Exception as e:
            hubo_error = True
            flash["estado"] = "error"; flash["error"] = str(e)[:300]
            print(f"  ERROR: {e}", flush=True)
        ruta.write_text(json.dumps(flash, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    CALIBRACION.write_text(json.dumps(calib, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sys.exit(1 if hubo_error and ids else 0)


if __name__ == "__main__":
    main()
