#!/usr/bin/env python3
"""Flash informativo de Diario Federal.

Lee flash.json, genera la voz, busca fotos y arma el video con música.
Uso: python render.py flash.json salida.mp4 [--vertical]
"""
import json, math, os, subprocess, sys, tempfile, shutil, wave, urllib.request, urllib.parse
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
FPS = 25
SR = 24000
VERTICAL = "--vertical" in sys.argv
W, H = (1080, 1920) if VERTICAL else (1920, 1080)
S = W / 1920 if not VERTICAL else 1080 / 1080 * 0.75  # escala de textos

ROJO = (200, 30, 40)
GRIS = (34, 36, 40)
BLANCO = (255, 255, 255)


def fuente(nombre, tam):
    rutas = {
        "sans": ["fonts/Inter-ExtraBold.otf", "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"],
        "sansm": ["fonts/Inter-Medium.otf", "/usr/share/fonts/opentype/inter/Inter-Medium.otf"],
        "serif": ["fonts/DejaVuSerif-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"],
    }[nombre]
    for r in rutas:
        p = r if r.startswith("/") else os.path.join(BASE, r)
        if os.path.exists(p):
            return ImageFont.truetype(p, int(tam * S))
    return ImageFont.load_default()


# ---------------------------------------------------------------- voz
def voz(texto, salida_wav):
    """Voz neural argentina (edge-tts) y, si no hay red, voz local piper."""
    mp3 = salida_wav + ".mp3"
    try:
        subprocess.run(["edge-tts", "--voice", os.environ.get("FLASH_VOZ", "es-AR-TomasNeural"),
                        "--rate", os.environ.get("FLASH_VELOCIDAD", "+14%"),
                        "--text", texto, "--write-media", mp3],
                       check=True, capture_output=True, timeout=60)
        if os.path.getsize(mp3) < 1000:
            raise RuntimeError("audio vacío")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp3, "-ar", str(SR), "-ac", "1", salida_wav], check=True)
        return
    except Exception:
        pass
    modelo = os.environ.get("PIPER_MODELO", os.path.join(BASE, "voz", "es-mls_10246-low.onnx"))
    tmp = salida_wav + ".raw.wav"
    subprocess.run([sys.executable, "-m", "piper", "-m", modelo, "-f", tmp, "--length-scale", "0.85",
                    "--sentence-silence", "0.15"], input=texto.encode(), check=True, capture_output=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-ar", str(SR), "-ac", "1", salida_wav], check=True)


def leer_wav(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768


# ---------------------------------------------------------------- imágenes
def buscar_commons(consulta, destino):
    """Busca una foto libre en Wikimedia Commons. Devuelve (ruta, crédito) o (None, None)."""
    try:
        q = urllib.parse.urlencode({
            "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6,
            "gsrsearch": consulta + " filetype:bitmap", "gsrlimit": 8,
            "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": 2000})
        req = urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + q,
                                     headers={"User-Agent": "DiarioFederalFlash/1.0 (diariofederal.com.ar)"})
        datos = json.load(urllib.request.urlopen(req, timeout=20))
        paginas = sorted(datos.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
        for p in paginas:
            ii = p.get("imageinfo", [{}])[0]
            if ii.get("width", 0) < 1200 or ii.get("width", 0) < ii.get("height", 1):
                continue
            url = ii.get("thumburl") or ii.get("url")
            meta = ii.get("extmetadata", {})
            autor = meta.get("Artist", {}).get("value", "")
            import re
            autor = " ".join(re.sub("<[^>]+>", " ", autor).split())[:60]
            lic = meta.get("LicenseShortName", {}).get("value", "")
            req = urllib.request.Request(url, headers={"User-Agent": "DiarioFederalFlash/1.0"})
            with open(destino, "wb") as f:
                f.write(urllib.request.urlopen(req, timeout=30).read())
            return destino, f"Foto: {autor or 'Wikimedia Commons'} / {lic} vía Wikimedia Commons"
    except Exception as e:
        print("  sin foto de Commons:", e)
    return None, None


def placa_generada(nota, idx):
    """Fondo propio cuando no hay foto: degradé con la palabra clave gigante."""
    c = tuple(int(nota.get("color", "#28406e")[i:i + 2], 16) for i in (1, 3, 5))
    w, h = int(W * 1.25), int(H * 1.25)
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]
    base = np.array(c, dtype=np.float32)
    mezcla = (0.55 + 0.45 * (1 - y)) * (0.8 + 0.2 * np.cos(x * 3 + idx))
    arr = (base[None, None, :] * mezcla[..., None]).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    # grilla de puntos tipo mapa
    paso = int(36 * S) or 20
    for yy in range(0, h, paso):
        for xx in range(0, w, paso):
            if math.sin(xx * 0.004 + idx) * math.cos(yy * 0.006) > 0.15:
                d.ellipse([xx, yy, xx + 4, yy + 4], fill=(255, 255, 255, 40) if False else tuple(min(255, v + 35) for v in c))
    palabra = nota.get("volanta", "")
    f = fuente("sans", 420 if len(palabra) < 9 else 300)
    bb = d.textbbox((0, 0), palabra, font=f)
    capa = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(capa).text(((w - bb[2]) / 2, h * 0.28), palabra, font=f, fill=(255, 255, 255, 38))
    img = Image.alpha_composite(img.convert("RGBA"), capa).convert("RGB")
    return img


def preparar_fondo(nota, idx, tmpdir):
    img, credito = None, nota.get("credito") or (("Foto: " + nota["fuente"]) if nota.get("fuente") else None)
    if nota.get("imagen"):
        p = nota["imagen"]
        if p.startswith("http"):
            dst = os.path.join(tmpdir, f"img{idx}.jpg")
            req = urllib.request.Request(p, headers={"User-Agent": "DiarioFederalFlash/1.0"})
            try:
                open(dst, "wb").write(urllib.request.urlopen(req, timeout=30).read()); p = dst
            except Exception as e:
                print("  no pude bajar la imagen:", e); p = None
        else:
            p = os.path.join(BASE, "..", "..", p.lstrip("/"))
            if not os.path.exists(p):
                p = os.path.join(BASE, "..", "..", "public", nota["imagen"].lstrip("/"))
        if p and os.path.exists(p):
            img = Image.open(p).convert("RGB")
    if img is None and nota.get("buscar"):
        p, cred = buscar_commons(nota["buscar"], os.path.join(tmpdir, f"img{idx}.jpg"))
        if p:
            img = Image.open(p).convert("RGB"); credito = credito or cred
    if img is None:
        img = placa_generada(nota, idx)
    # recorte a la proporción del video, 25% más grande para el zoom
    tw, th = int(W * 1.25), int(H * 1.25)
    r = max(tw / img.width, th / img.height)
    img = img.resize((int(img.width * r) + 1, int(img.height * r) + 1), Image.LANCZOS)
    l, t = (img.width - tw) // 2, (img.height - th) // 2
    return img.crop((l, t, l + tw, t + th)), credito


# ---------------------------------------------------------------- gráfica
def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def logo(d, cx, cy, escala=1.0, alfa=255):
    f1 = fuente("serif", 120 * escala)
    f2 = fuente("sansm", 34 * escala)
    t1 = "DIARIO FEDERAL"
    bb = d.textbbox((0, 0), t1, font=f1)
    x = cx - bb[2] / 2
    d.text((x, cy - bb[3]), t1, font=f1, fill=(255, 255, 255, alfa))
    r = int(16 * S * escala)
    d.ellipse([x - r * 3.2, cy - bb[3] * 0.62 - r, x - r * 1.2, cy - bb[3] * 0.62 + r], fill=ROJO + (alfa,))
    return bb


def cuadro_apertura(t, dur, datos):
    img = Image.new("RGB", (W, H), (18, 19, 22))
    d = ImageDraw.Draw(img, "RGBA")
    # barrido de franjas
    for i in range(6):
        p = ease((t - i * 0.08) / 0.7)
        y = H * (0.08 + i * 0.16)
        d.rectangle([W * (1 - p) - W * 0.2, y, W * (1 - p) + W * 1.2 * p, y + 3 * S], fill=(60, 62, 68, 120))
    p = ease((t - 0.3) / 0.6)
    d.rectangle([0, H / 2 + 30 * S, W * p, H / 2 + 38 * S], fill=ROJO)
    a = int(255 * ease((t - 0.5) / 0.5))
    logo(d, W / 2, H / 2, 1.0, a)
    f = fuente("sans", 46)
    st = datos.get("titulo", "Flash informativo").upper()
    bb = d.textbbox((0, 0), st, font=f)
    a2 = int(255 * ease((t - 0.9) / 0.4))
    d.text(((W - bb[2]) / 2, H / 2 + 70 * S), st, font=f, fill=(255, 255, 255, a2))
    f3 = fuente("sansm", 30)
    fe = datos.get("fecha", "")
    bb = d.textbbox((0, 0), fe, font=f3)
    d.text(((W - bb[2]) / 2, H / 2 + 140 * S), fe, font=f3, fill=(190, 190, 195, a2))
    if t > dur - 0.25:  # destello de salida
        k = (t - (dur - 0.25)) / 0.25
        img = Image.blend(img, Image.new("RGB", (W, H), BLANCO), k * 0.9)
    return img


def envolver(texto, f, ancho, d):
    palabras, lineas, act = texto.split(), [], ""
    for p in palabras:
        prueba = (act + " " + p).strip()
        if d.textbbox((0, 0), prueba, font=f)[2] > ancho and act:
            lineas.append(act); act = p
        else:
            act = prueba
    lineas.append(act)
    return lineas


_SOMBRA = []


def sombra():
    if not _SOMBRA:
        y = np.linspace(0, 1, H)[:, None]
        a = np.clip((y - 0.45) / 0.55, 0, 1) ** 1.4 * 215 + np.clip((0.18 - y) / 0.18, 0, 1) * 90
        _SOMBRA.append(Image.fromarray(np.repeat(a, W, 1).astype(np.uint8), "L"))
    return _SOMBRA[0]


def cuadro_nota(t, dur, fondo, nota, credito, n, total):
    # Ken Burns: zoom lento y paneo suave
    z = 1.0 + 0.12 * (t / dur)
    fw, fh = fondo.size
    cw, ch = int(W * 1.25 / z / 1.0 * 0.8), int(H * 1.25 / z / 1.0 * 0.8)
    dx = (n % 2 * 2 - 1) * (fw - cw) * 0.25 * (t / dur)
    l = int((fw - cw) / 2 + dx); tp = int((fh - ch) / 2)
    img = fondo.crop((l, tp, l + cw, tp + ch)).resize((W, H), Image.BILINEAR)
    d = ImageDraw.Draw(img, "RGBA")
    # degradé inferior para leer los zócalos
    img.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), sombra())
    d = ImageDraw.Draw(img, "RGBA")
    # mosca arriba a la izquierda
    m = int(48 * S)
    fm = fuente("sans", 30)
    d.rectangle([m, m, m + 14 * S, m + 44 * S], fill=ROJO)
    d.text((m + 28 * S, m + 2 * S), "DIARIO FEDERAL", font=fm, fill=BLANCO)
    fm2 = fuente("sansm", 22)
    d.text((m + 28 * S, m + 40 * S), "FLASH INFORMATIVO", font=fm2, fill=(220, 220, 220))
    # contador
    fc = fuente("sans", 28)
    tx = f"{n + 1}/{total}"
    bb = d.textbbox((0, 0), tx, font=fc)
    d.text((W - m - bb[2], m + 6 * S), tx, font=fc, fill=(255, 255, 255, 200))
    # zócalo
    p = ease((t - 0.25) / 0.45)
    p2 = ease((t - 0.45) / 0.5)
    fv = fuente("sans", 34)
    ft = fuente("sans", 64 if not VERTICAL else 58)
    ancho = W - 2 * m - 40 * S
    lineas = envolver(nota["titulo"], ft, ancho, d)[:3]
    alto_l = 80 * S
    y0 = H - m - 40 * S - alto_l * len(lineas)
    vol = nota.get("volanta", "").upper()
    bbv = d.textbbox((0, 0), vol, font=fv)
    vx = m - (1 - p) * (bbv[2] + 80 * S)
    d.rectangle([vx, y0 - 70 * S, vx + bbv[2] + 40 * S, y0 - 14 * S], fill=ROJO)
    d.text((vx + 20 * S, y0 - 64 * S), vol, font=fv, fill=BLANCO)
    for i, ln in enumerate(lineas):
        bb = d.textbbox((0, 0), ln, font=ft)
        xx = m - (1 - p2) * (W * 0.6)
        yy = y0 + i * alto_l
        d.rectangle([xx, yy, xx + bb[2] + 40 * S, yy + alto_l - 6 * S], fill=(255, 255, 255, int(240 * p2)))
        d.text((xx + 20 * S, yy + 2 * S), ln, font=ft, fill=GRIS + (int(255 * p2),))
    if credito:
        fcr = fuente("sansm", 18)
        bb = d.textbbox((0, 0), credito, font=fcr)
        d.text((W - m - bb[2], H - m + 8 * S), credito, font=fcr, fill=(230, 230, 230, 200))
    # barra de progreso
    d.rectangle([0, H - 6 * S, W * (t / dur), H], fill=ROJO)
    # transiciones
    if t < 0.2:
        img = Image.blend(Image.new("RGB", (W, H), BLANCO), img, t / 0.2)
    return img


def cuadro_cierre(t, dur, datos):
    img = Image.new("RGB", (W, H), (18, 19, 22))
    d = ImageDraw.Draw(img, "RGBA")
    p = ease(t / 0.6)
    d.rectangle([0, 0, W, H * 0.5 * p], fill=(26, 27, 31))
    logo(d, W / 2, H / 2 - 20 * S, 1.0, int(255 * ease(t / 0.5)))
    d.rectangle([W / 2 - 300 * S * p, H / 2 + 10 * S, W / 2 + 300 * S * p, H / 2 + 16 * S], fill=ROJO)
    f = fuente("sansm", 40)
    tx = "diariofederal.com.ar"
    bb = d.textbbox((0, 0), tx, font=f)
    d.text(((W - bb[2]) / 2, H / 2 + 50 * S), tx, font=f, fill=(230, 230, 230, int(255 * ease((t - 0.6) / 0.5))))
    if t > dur - 1.0:
        k = (t - (dur - 1.0)) / 1.0
        img = Image.blend(img, Image.new("RGB", (W, H), (0, 0, 0)), k)
    return img


# ---------------------------------------------------------------- armado
def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    entrada = args[0] if args else os.path.join(BASE, "flash.json")
    salida = args[1] if len(args) > 1 else os.path.join(BASE, "flash.mp4")
    datos = json.load(open(entrada, encoding="utf-8"))
    # música: nombre de un archivo de scripts/flash/musica/ (o "azar" para elegir una cualquiera)
    elegida = datos.get("musica", "breaking-news.mp3")
    carpeta = os.path.join(BASE, "musica")
    if elegida == "azar":
        import random
        elegida = random.choice(sorted(f for f in os.listdir(carpeta) if f.endswith(".mp3")))
    musica = os.path.join(carpeta, elegida)
    print("Música:", elegida)
    if datos.get("voz"):
        os.environ["FLASH_VOZ"] = datos["voz"]
    if os.environ.get("FLASH_VOZ_MANUAL"):
        os.environ["FLASH_VOZ"] = os.environ["FLASH_VOZ_MANUAL"]
    if datos.get("velocidad"):
        os.environ["FLASH_VELOCIDAD"] = datos["velocidad"]
    tmp = tempfile.mkdtemp()

    print("Generando voces…")
    bloques = []  # (tipo, duración, audio, extra)
    a = os.path.join(tmp, "v_ap.wav"); voz(datos["apertura"], a)
    va = leer_wav(a)
    bloques.append(("apertura", max(4.5, 1.6 + len(va) / SR + 0.4), va, 1.6))
    for i, nota in enumerate(datos["notas"]):
        p = os.path.join(tmp, f"v{i}.wav"); voz(nota["texto"], p)
        v = leer_wav(p)
        print(f"  nota {i + 1}: {len(v) / SR:.1f} s")
        bloques.append(("nota", len(v) / SR + 0.9, v, 0.35))
    c = os.path.join(tmp, "v_ci.wav"); voz(datos["cierre"], c)
    vc = leer_wav(c)
    bloques.append(("cierre", len(vc) / SR + 3.5, vc, 0.3))
    total = sum(b[1] for b in bloques)
    print(f"Duración total: {total:.1f} s")

    # ---- audio: voz + música con colchón
    n = int(total * SR) + SR
    pista_voz = np.zeros(n, np.float32)
    env = np.ones(n, np.float32)
    t0 = 0.0
    for tipo, dur, v, off in bloques:
        ini = int((t0 + off) * SR)
        pista_voz[ini:ini + len(v)] += v
        t0 += dur
    # envolvente: música fuerte en apertura, baja bajo la voz, sube en el cierre
    hay_voz = np.convolve((np.abs(pista_voz) > 0.01).astype(np.float32), np.ones(int(0.35 * SR)), "same") > 0
    objetivo = np.where(hay_voz, 0.16, 0.42).astype(np.float32)
    objetivo[: int(1.4 * SR)] = 1.0
    ini_cierre = int((total - bloques[-1][1] + 0.3 + len(vc) / SR) * SR)
    objetivo[ini_cierre:] = 1.0
    # suavizado de la envolvente (subidas y bajadas de ~0.4 s)
    k = int(0.4 * SR)
    env = np.convolve(np.pad(objetivo, (k, k), mode="edge"), np.ones(k) / k, "same")[k:-k]
    mus_wav = os.path.join(tmp, "mus.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", musica, "-ar", str(SR), "-ac", "1", "-t", str(total + 1), mus_wav], check=True)
    mus = leer_wav(mus_wav)
    if len(mus) < n:
        mus = np.tile(mus, n // len(mus) + 1)
    mus = mus[:n] * env * 0.75
    fin = int(total * SR)
    fade = int(2.0 * SR)
    mus[fin - fade:fin] *= np.linspace(1, 0, fade)
    mus[fin:] = 0
    mezcla = pista_voz * 1.15 + mus
    mezcla = mezcla[:fin] / max(1.0, np.abs(mezcla).max() / 0.95)
    audio = os.path.join(tmp, "mezcla.wav")
    with wave.open(audio, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mezcla * 32767).astype(np.int16).tobytes())

    # ---- video
    print("Preparando imágenes…")
    fondos = [preparar_fondo(nota, i, tmp) for i, nota in enumerate(datos["notas"])]
    print("Renderizando cuadros…")
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", audio,
                           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
                           "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", salida],
                          stdin=subprocess.PIPE)
    k_nota = 0
    for tipo, dur, v, off in bloques:
        for f in range(int(round(dur * FPS))):
            t = f / FPS
            if tipo == "apertura":
                im = cuadro_apertura(t, dur, datos)
            elif tipo == "cierre":
                im = cuadro_cierre(t, dur, datos)
            else:
                fondo, cred = fondos[k_nota]
                im = cuadro_nota(t, dur, fondo, datos["notas"][k_nota], cred, k_nota, len(datos["notas"]))
            ff.stdin.write(im.tobytes())
        if tipo == "nota":
            k_nota += 1
    ff.stdin.close(); ff.wait()
    shutil.rmtree(tmp, ignore_errors=True)
    print("Listo:", salida)


if __name__ == "__main__":
    main()
