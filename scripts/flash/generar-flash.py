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

# Diseño "noticiero": tipografías completas (incluyen č, ć, ş, ł…)
_cache_ttf = {}
def _ttf(nombre, tam):
    k = (nombre, tam)
    if k not in _cache_ttf:
        _cache_ttf[k] = ImageFont.truetype(str(FUENTES / f"{nombre}.ttf"), tam)
    return _cache_ttf[k]
ss = lambda w, s: _ttf(f"source-serif-4-{w}-completa", s)
it = lambda w, s: _ttf(f"inter-{w}-completa", s)
ROJO_N = (200, 16, 46); NEGRO_N = (17, 17, 17)


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


def fondo_tema(kicker):
    """Diseño noticiero sin foto: el país o tema en grande, sobrio."""
    im = Image.new("RGB", (W, H), (28, 28, 28))
    d = ImageDraw.Draw(im)
    palabra = (str(kicker or "").split("·")[0].strip() or "Diario Federal")
    for tam in (450, 380, 320, 260, 200):
        f = ss(700, tam)
        if d.textlength(palabra, font=f) < W * 1.05: break
    d.text((-18, 225), palabra, font=f, fill=(38, 38, 38))
    d.rectangle([90, 180, 420, 189], fill=(46, 46, 46))
    return im


def preparar_medio(b, dur, tmp, idx, pw=PW, ph=PH, nuevo=False):
    m = b.get("media") or {}
    ruta = reunir(m.get("archivo"), tmp)
    if not ruta:
        fondo = fondo_tema(b.get("kicker", "")) if nuevo else panel_marca(b.get("kicker", ""))
        return lambda t: fondo
    es_video = m.get("tipo") == "video" or ruta.suffix.lower() in (".mp4", ".mov", ".webm", ".m4v")
    if not es_video:
        img = Image.open(ruta).convert("RGB")
        foco = tuple(m.get("foco") or (0.5, 0.4))
        if nuevo:
            # zoom lento: se escala una vez y en cada cuadro sólo se recorta
            Z = 1.07
            big = cover(img, int(pw * Z), int(ph * Z), foco)
            def f(t, big=big):
                z = 1 + (Z - 1) * min(1.0, t / max(dur, 0.1))
                cw, ch = big.width / z, big.height / z
                x, y = (big.width - cw) / 2, (big.height - ch) / 2
                return big.resize((pw, ph), Image.BILINEAR, box=(x, y, x + cw, y + ch))
            return f
        def f(t, img=img):
            z = 1 + 0.06 * (t / max(dur, 0.1))
            big = cover(img, int(pw * z), int(ph * z), foco)
            x, y = (big.width - pw) // 2, (big.height - ph) // 2
            return big.crop((x, y, x + pw, y + ph))
        return f
    raw = Path(tmp) / f"medio{idx}.rgb"
    n = int(dur * FPS) + 2
    # el video se decodifica a un tamaño menor y se agranda al dibujar (ocupa menos disco)
    rw, rh = (pw, ph) if not nuevo else (pw * 2 // 3 // 2 * 2, ph * 2 // 3 // 2 * 2)
    vf = (f"[0:v]fps={FPS},split[a][b];[a]scale={rw}:{rh}:force_original_aspect_ratio=increase,crop={rw}:{rh},"
          f"boxblur=25:2,eq=brightness=-0.25[bg];[b]scale={rw}:{rh}:force_original_aspect_ratio=decrease[fg];"
          f"[bg][fg]overlay=(W-w)/2:(H-h)/2")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-stream_loop", "-1", "-ss", str(float(m.get("inicio") or 0)),
                    "-i", str(ruta), "-filter_complex", vf, "-frames:v", str(n), "-an",
                    "-f", "rawvideo", "-pix_fmt", "rgb24", str(raw)], check=True)
    mm = np.memmap(raw, dtype=np.uint8, mode="r").reshape(-1, rh, rw, 3)
    if (rw, rh) == (pw, ph):
        return lambda t: Image.fromarray(np.array(mm[min(int(t * FPS), len(mm) - 1)]))
    return lambda t: Image.fromarray(np.array(mm[min(int(t * FPS), len(mm) - 1)])).resize((pw, ph), Image.BILINEAR)


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


# ── Diseño "noticiero": foto a pantalla completa, zócalo y subtítulos ──────────

M_N = 72  # margen lateral


def espaciado(d, xy, txt, font, fill, esp, anchor_y="m"):
    """Texto con espacio entre letras (para rótulos en mayúscula). Devuelve el ancho."""
    x, y = xy
    for ch in txt:
        d.text((x, y), ch, font=font, fill=fill, anchor="l" + anchor_y)
        x += d.textlength(ch, font=font) + esp
    return x - xy[0] - esp


def ancho_esp(d, txt, font, esp):
    return sum(d.textlength(ch, font=font) for ch in txt) + esp * max(0, len(txt) - 1)


def partir_n(d, texto, font, ancho):
    words, lines, cur = str(texto or "").split(), [], ""
    for wd in words:
        test = (cur + " " + wd).strip()
        if cur and d.textlength(test, font=font) > ancho:
            lines.append(cur); cur = wd
        else:
            cur = test
    if cur: lines.append(cur)
    return lines


def recortar(d, texto, font, ancho):
    texto = str(texto or "")
    if d.textlength(texto, font=font) <= ancho: return texto
    while texto and d.textlength(texto + "…", font=font) > ancho: texto = texto[:-1]
    return texto.rstrip() + "…"


def fecha_corta(flash):
    try: f = dt.date.fromisoformat(str(flash.get("fecha"))[:10])
    except Exception: f = dt.date.today()
    return f"{f.day:02d}.{f.month:02d}.{f.year}"


def tiempos_palabras(texto, habladas, dur_voz):
    """Reparte las palabras que se ven en pantalla sobre los tiempos de la voz.
    Si la voz informó sus palabras, se usan esos tiempos; si no, se reparte por largo."""
    vis = str(texto or "").split()
    if not vis: return []
    hab = [h for h in habladas if str(h[2]).strip()]
    if len(hab) >= 2:
        n, out = len(hab), []
        for i, w in enumerate(vis):
            j0 = min(n - 1, int(i * n / len(vis)))
            j1 = min(n - 1, max(j0, int((i + 1) * n / len(vis)) - 1))
            out.append((w, hab[j0][0], hab[j1][1]))
        return out
    ini, fin = 0.15, max(0.65, dur_voz - 0.1)
    pesos = [len(w) + 1.5 for w in vis]; tot = sum(pesos); a = ini; out = []
    for w, p in zip(vis, pesos):
        b = a + (fin - ini) * p / tot; out.append((w, a, b)); a = b
    return out


def armar_trozos(palabras, maximo=7):
    """Agrupa en renglones de hasta 7 palabras, cortando en los puntos."""
    oraciones, cur = [], []
    for p in palabras:
        cur.append(p)
        if re.search(r"[.!?:;]$", p[0]): oraciones.append(cur); cur = []
    if cur: oraciones.append(cur)
    trozos = []
    for o in oraciones:
        k = max(1, -(-len(o) // maximo)); tam = -(-len(o) // k)
        trozos += [o[i:i + tam] for i in range(0, len(o), tam)]
    return trozos


def subtitulo_en(trozos, t):
    """Renglón y palabra resaltada en el segundo t (relativo al inicio de la voz)."""
    actual, hi = None, -1
    for tr in trozos:
        for j, (w, a, b) in enumerate(tr):
            if a <= t:
                actual, hi = tr, (j if t <= b + 0.08 else -1)
    if actual and hi == -1 and t > actual[-1][2] + 0.6:
        # silencio largo después del renglón: se mantiene salvo al final del bloque
        if actual is trozos[-1]: return None, -1
    return actual, hi


def placa_bloque_nuevo(b, t, dur, idx, n, medio, flash, trozos, t_voz, prog):
    im = medio(t).copy()
    if im.size != (W, H): im = im.resize((W, H), Image.BILINEAR)
    d = ImageDraw.Draw(im, "RGBA")
    urgente = flash.get("tipo") == "ultimo"
    M = M_N

    # barra superior: marca, FLASH y fecha
    fn = ss(700, 39); nom = "Diario Federal"; wn = d.textlength(nom, font=fn)
    d.rectangle([M, 54, M + wn + 42, 129], fill=NEGRO_N + (220,))
    d.text((M + 21, 91), nom, font=fn, fill=WHITE, anchor="lm")
    tag = "ÚLTIMO MOMENTO" if urgente else "FLASH"; ft = it(700, 21)
    wt = ancho_esp(d, tag, ft, 3.5)
    x0 = M + wn + 42 + 18
    d.rectangle([x0, 66, x0 + wt + 36, 117], fill=ROJO_N)
    if urgente and int(t * 2) % 2 == 0:
        d.ellipse([x0 + wt + 46, 84, x0 + wt + 60, 98], fill=ROJO_N)
    espaciado(d, (x0 + 18, 92), tag, ft, WHITE, 3.5)
    der = fecha_corta(flash) + ("" if urgente or n < 2 else f"   |   Tema {idx + 1} de {n}")
    fr = it(500, 21); wd = d.textlength(der, font=fr)
    d.rectangle([W - M - wd - 42, 66, W - M, 117], fill=NEGRO_N + (220,))
    d.text((W - M - 21, 92), der, font=fr, fill=(230, 230, 230), anchor="rm")

    # de abajo hacia arriba: progreso, subtítulos, franja negra, antetítulo, crédito
    sube = int(60 * (1 - ease(t / 0.5)))
    y = H - 9
    d.rectangle([0, y, W, H], fill=(255, 255, 255, 46))
    d.rectangle([0, y, int(W * prog), H], fill=ROJO_N)
    subs = flash.get("subtitulos", True) is not False
    if subs:
        y -= 104
        d.rectangle([0, y, W, y + 104], fill=(0, 0, 0, 150))
        tr, hi = subtitulo_en(trozos, t - t_voz)
        if tr:
            fs = it(600, 42); esp = d.textlength(" ", font=fs)
            ws = [w for w, a, bb in tr]
            total_w = sum(d.textlength(w, font=fs) for w in ws) + esp * (len(ws) - 1)
            while total_w > W - 160 and fs.size > 28:
                fs = it(600, fs.size - 2); esp = d.textlength(" ", font=fs)
                total_w = sum(d.textlength(w, font=fs) for w in ws) + esp * (len(ws) - 1)
            x = (W - total_w) / 2; cy = y + 52
            for j, w in enumerate(ws):
                ww = d.textlength(w, font=fs)
                if j == hi:
                    d.rectangle([x - 9, cy - fs.size * 0.72, x + ww + 9, cy + fs.size * 0.62], fill=ROJO_N)
                else:
                    d.text((x + 2, cy + 3), w, font=fs, fill=(0, 0, 0, 160), anchor="lm")
                d.text((x, cy), w, font=fs, fill=WHITE, anchor="lm")
                x += ww + esp
    else:
        y -= 30

    # franja con título y bajada
    ancho_t = W - 2 * M - 72
    for tam in (60, 54, 48, 42):
        tf = ss(700, tam); lineas = partir_n(d, b.get("titulo", ""), tf, ancho_t)
        if len(lineas) <= 2: break
    lineas = lineas[:2]
    alto = 27 + len(lineas) * int(tam * 1.14) + (44 if (b.get("dato") or b.get("bajada")) else 0) + 27
    yb = y - alto + sube
    d.rectangle([M, yb, W - M, y + sube if not subs else y + sube], fill=NEGRO_N)
    ty = yb + 27
    for ln in lineas:
        d.text((M + 36, ty), ln, font=tf, fill=WHITE); ty += int(tam * 1.14)
    if b.get("dato") or b.get("bajada"):
        x = M + 36; ty += 6
        if b.get("dato"):
            fd = it(700, 27)
            d.text((x, ty), b["dato"], font=fd, fill=(255, 92, 102)); x += d.textlength(b["dato"], font=fd) + 22
        if b.get("bajada"):
            fb = it(500, 25)
            d.text((x, ty + 2), recortar(d, b["bajada"], fb, W - M - 36 - x), font=fb, fill=(195, 195, 195))

    # antetítulo en rojo, pegado a la franja
    if b.get("kicker"):
        fk = it(700, 22); k = str(b["kicker"]).upper(); wk = ancho_esp(d, k, fk, 3)
        d.rectangle([M, yb - 52, M + wk + 48, yb], fill=ROJO_N)
        espaciado(d, (M + 24, yb - 26), k, fk, WHITE, 3)
    # crédito de la foto o el video
    cred = " · ".join(x for x in (b.get("epigrafe"), b.get("fuente")) if x)
    if cred:
        fc = it(500, 19); cred = recortar(d, cred, fc, W / 2)
        wc = d.textlength(cred, font=fc)
        d.rectangle([W - M - wc - 24, yb - 50, W - M, yb - 14], fill=NEGRO_N + (190,))
        d.text((W - M - 12, yb - 32), cred, font=fc, fill=(232, 232, 232), anchor="rm")
    return im


def placa_intro_nueva(t, flash, bloques):
    im = Image.new("RGB", (W, H), NEGRO_N)
    urgente = flash.get("tipo") == "ultimo"
    rot = "ÚLTIMO MOMENTO" if urgente else "FLASH SEMANAL"
    def izq(d, a):
        espaciado(d, (210, 400), rot, it(700, 22), (230, 230, 230, a), 4.5)
        d.text((120, 440), "Diario Federal", font=ss(700, 104), fill=WHITE + (a,))
        d.text((120, 600), flash["rotulo"].capitalize() if not urgente else fecha_corta(flash), font=it(500, 24), fill=(168, 168, 168, a))
    d = ImageDraw.Draw(im)
    d.rectangle([120, 396, 120 + int(72 * ease(t / 0.5)), 405], fill=ROJO_N)
    con_alfa(im, izq, ease((t - 0.1) / 0.5))
    x = 1010; y0 = 330
    if urgente:
        b0 = bloques[0] if bloques else {}
        con_alfa(im, lambda d, a: espaciado(d, (x, y0), str(b0.get("kicker", "")).upper(), it(700, 20), (255, 92, 102, a), 3), ease((t - 0.4) / 0.5))
        for i, ln in enumerate(partir_n(ImageDraw.Draw(im), b0.get("titulo", ""), ss(700, 64), 790)[:3]):
            con_alfa(im, lambda d, a, i=i, ln=ln: d.text((x, y0 + 40 + i * 74), ln, font=ss(700, 64), fill=WHITE + (a,)), ease((t - 0.6) / 0.5))
    else:
        con_alfa(im, lambda d, a: (espaciado(d, (x, y0), "EN ESTE FLASH", it(700, 20), (168, 168, 168, a), 3.5),
                                   d.line([x, y0 + 34, W - 120, y0 + 34], fill=(58, 58, 58, a), width=2)), ease((t - 0.3) / 0.4))
        lista = bloques[:6]; paso = 104 if len(lista) <= 4 else 80
        for i, b in enumerate(lista):
            yy = y0 + 34 + i * paso
            def fila(d, a, i=i, b=b, yy=yy):
                tf = ss(600, 40 if len(lista) <= 4 else 34)
                d.text((x, yy + paso / 2), str(i + 1), font=ss(700, 42), fill=(255, 90, 95, a), anchor="lm")
                d.text((x + 84, yy + paso / 2), recortar(d, b.get("titulo", ""), tf, W - 120 - x - 84), font=tf, fill=WHITE + (a,), anchor="lm")
                d.line([x, yy + paso, W - 120, yy + paso], fill=(58, 58, 58, a), width=2)
            con_alfa(im, fila, ease((t - 0.5 - i * 0.18) / 0.4))
    ImageDraw.Draw(im).rectangle([0, H - 9, W, H], fill=ROJO_N)
    return im


def placa_cierre_nueva(t):
    im = Image.new("RGB", (W, H), NEGRO_N)
    d = ImageDraw.Draw(im)
    d.rectangle([W / 2 - 48, 300, W / 2 - 48 + int(96 * ease(t / 0.5)), 309], fill=ROJO_N)
    con_alfa(im, lambda d, a: d.text((W / 2, 420), "Diario Federal", font=ss(700, 144), fill=WHITE + (a,), anchor="mm"), ease(t / 0.6))
    con_alfa(im, lambda d, a: (d.text((W / 2, 545), "Periodistas, escritores y pensadores", font=it(500, 33), fill=(207, 207, 207, a), anchor="mm"),
                               d.text((W / 2, 593), "de todo el país", font=it(500, 33), fill=(207, 207, 207, a), anchor="mm")), ease((t - 0.3) / 0.5))
    def boton(d, a):
        f1, f2 = it(700, 22), it(600, 33)
        w1 = ancho_esp(d, "SEGUÍ LEYENDO", f1, 3.2) + 48; w2 = d.textlength("diariofederal.com.ar", font=f2) + 60
        x = (W - w1 - w2) / 2; y = 660
        d.rectangle([x, y, x + w1, y + 64], fill=ROJO_N + (a,))
        espaciado(d, (x + 24, y + 32), "SEGUÍ LEYENDO", f1, WHITE + (a,), 3.2)
        d.rectangle([x + w1, y, x + w1 + w2, y + 64], fill=WHITE + (a,))
        d.text((x + w1 + 30, y + 32), "diariofederal.com.ar", font=f2, fill=NEGRO_N + (a,), anchor="lm")
    con_alfa(im, boton, ease((t - 0.6) / 0.5))
    ImageDraw.Draw(im).rectangle([0, H - 9, W, H], fill=ROJO_N)
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
    try:
        com = edge_tts.Communicate(texto, voz, rate=rate, boundary="WordBoundary")
    except TypeError:
        com = edge_tts.Communicate(texto, voz, rate=rate)
    palabras = []
    with open(destino, "wb") as fh:
        async for ch in com.stream():
            if ch["type"] == "audio":
                fh.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                a = ch["offset"] / 1e7
                palabras.append((a, a + ch["duration"] / 1e7, ch.get("text", "")))
    return palabras


def sintetizar(texto, voz, vel, destino_wav, tmp):
    """Devuelve los tiempos de cada palabra dicha (inicio, fin, palabra), si la voz los informa."""
    palabras = []
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
                palabras = asyncio.run(_edge(texto, voz, vel, str(mp3))) or []; break
            except Exception:
                if intento == 2: raise
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-ar", "24000", "-ac", "1", destino_wav], check=True)
    # recorta el silencio del final y deja 0,15 s de aire al principio
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", destino_wav, "-af",
                    "areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=150",
                    "-ar", "24000", "-ac", "1", destino_wav + ".t.wav"], check=True)
    os.replace(destino_wav + ".t.wav", destino_wav)
    return [(a + 0.15, b + 0.15, w) for a, b, w in palabras]


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
        voces, habladas = {}, {}
        for k, txt in segs:
            p = str(Path(tmp) / f"{k}.wav")
            habladas[k] = sintetizar(pronunciar(txt, dicc), voz, vel, p, tmp) or []
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

        nuevo = flash.get("estilo", "noticiero") != "clasico"
        medios = {}
        if not nuevo:
            for i, b in enumerate(bloques):
                dur = next(d for k, s, d, v in linea if k == f"b{i}")
                medios[i] = preparar_medio(b, dur, tmp, i)
        trozos = {}
        if nuevo:
            for i, b in enumerate(bloques):
                pal = tiempos_palabras(b["texto"], habladas.get(f"b{i}", []), dur_wav(voces[f"b{i}"]))
                trozos[i] = armar_trozos(pal)

        def medio_de(i):
            # diseño noticiero: cada medio se prepara al llegar a su bloque y se libera el anterior
            if i not in medios:
                for j in list(medios):
                    medios.pop(j)
                    for r in Path(tmp).glob(f"medio{j}.rgb"): r.unlink(missing_ok=True)
                dur = next(d for k, s, d, v in linea if k == f"b{i}")
                medios[i] = preparar_medio(bloques[i], dur, tmp, i, W, H, nuevo=True)
            return medios[i]

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
            if nuevo:
                if k == "intro": im = placa_intro_nueva(lt, flash, bloques)
                elif k == "cierre": im = placa_cierre_nueva(lt)
                else:
                    i = int(k[1:])
                    im = placa_bloque_nuevo(bloques[i], lt, dur, i, len(bloques), medio_de(i), flash,
                                            trozos[i], vs - st, tt / total)
            elif k == "intro": im = placa_intro(lt, flash)
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
