#!/usr/bin/env python3
"""
Genera la versión en audio de las notas ("Escuchá esta nota").

Lo corre GitHub Actions (.github/workflows/audio-notas.yml) cada vez que se
publica o edita una nota. Para cada nota:
  1. arma el texto a leer (título, bajada y cuerpo, sin Markdown ni HTML),
  2. si el texto cambió desde la última vez, genera un MP3 con una voz neural
     argentina (Microsoft Edge TTS, gratis, sin clave),
  3. lo guarda en public/audio/<slug>.mp3 y lo anota en data/audios.json.

Las notas que no cambiaron no se regeneran. Si una nota se borra o pasa a
borrador, su audio se elimina.

Variables opcionales:
  VOZ   voz de Edge TTS (por defecto es-AR-TomasNeural; otra: es-AR-ElenaNeural)
  DIAS  solo genera audios nuevos para notas de los últimos N días (por defecto 7)
  TODAS si vale "1", genera para todas las notas, sin importar la fecha
"""

import asyncio
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parent.parent
NOTAS = RAIZ / "src" / "content" / "articulos"
CARPETA_AUDIO = RAIZ / "public" / "audio"
MANIFIESTO = RAIZ / "data" / "audios.json"

VOZ = os.environ.get("VOZ", "es-AR-TomasNeural")
DIAS = int(os.environ.get("DIAS", "7") or "7")
TODAS = os.environ.get("TODAS", "") in ("1", "true", "si", "sí")
BITRATE = "32k"  # voz mono: suena bien y pesa poco (~240 KB por minuto)


# ── Lectura de las notas ─────────────────────────────────────────────────────

def leer_nota(ruta: Path):
    crudo = ruta.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", crudo, re.S)
    if not m:
        return None, crudo
    try:
        datos = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        datos = {}
    return datos, m.group(2)


def fecha_de(datos) -> dt.date | None:
    v = datos.get("pubDate")
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    if isinstance(v, str):
        try:
            return dt.date.fromisoformat(v[:10])
        except ValueError:
            return None
    return None


# ── Del Markdown al texto que se lee en voz alta ─────────────────────────────

SUFIJOS = r"(?:\s(?:mil millones|millones|millón|billones|mil))?"


def _moneda(m: re.Match, nombre: str) -> str:
    cifra = m.group(1)
    tiene_sufijo = bool(re.search(r"\s(mil millones|millones|millón|billones)$", cifra))
    return f"{cifra} {'de ' if tiene_sufijo else ''}{nombre}"


def texto_para_leer(datos, cuerpo: str) -> str:
    t = cuerpo

    # MDX: imports/exports y componentes (<NotaRelacionada ... />)
    t = re.sub(r"^\s*(import|export)\s.*$", "", t, flags=re.M)
    t = re.sub(r"<([A-Z]\w*)[^>]*?/>", "", t, flags=re.S)
    t = re.sub(r"<([A-Z]\w*)[^>]*>.*?</\1>", "", t, flags=re.S)

    # HTML que no se lee: scripts, estilos, videos incrustados, fotos con epígrafe
    for tag in ("script", "style", "iframe", "figure", "video", "audio", "table"):
        t = re.sub(rf"<{tag}\b.*?</{tag}>", "", t, flags=re.S | re.I)
    t = re.sub(r"<br\s*/?>", "\n", t, flags=re.I)
    t = re.sub(r"</(p|div|h\d|li|blockquote)>", "\n\n", t, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)

    # Markdown
    t = re.sub(r"```.*?```", "", t, flags=re.S)
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)            # imágenes
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)        # links: queda el texto
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)   # títulos
    t = re.sub(r"^\s*>\s?", "", t, flags=re.M)            # citas
    t = re.sub(r"^\s*[-*+]\s+", "", t, flags=re.M)        # viñetas
    t = re.sub(r"^\s*\d+\.\s+", "", t, flags=re.M)        # listas numeradas
    t = re.sub(r"^\s*(-{3,}|\*{3,}|_{3,})\s*$", "", t, flags=re.M)
    t = re.sub(r"(\*\*|__|\*|_|`)", "", t)
    t = re.sub(r"https?://\S+", "", t)

    # Entidades HTML comunes
    for a, b in (("&nbsp;", " "), ("&amp;", "y"), ("&quot;", '"'), ("&#39;", "'"), ("&lt;", ""), ("&gt;", "")):
        t = t.replace(a, b)

    # La lista de fuentes del final no se lee
    t = re.split(r"\n\s*(?:#{1,6}\s*)?(?:\*\*)?Fuentes?(?:\*\*)?:?\s*\n", t, maxsplit=1)[0]

    # Párrafos limpios: cada uno termina en punto para que la voz haga la pausa
    parrafos = []
    for p in re.split(r"\n\s*\n", t):
        p = re.sub(r"\s+", " ", p).strip()
        if not p:
            continue
        if p[-1] not in ".!?…:;\"»”)":
            p += "."
        parrafos.append(p)

    def con_punto(s: str) -> str:
        s = re.sub(r"\s+", " ", str(s or "")).strip()
        return s if not s or s[-1] in ".!?…" else s + "."

    inicio = [con_punto(datos.get("title")), con_punto(datos.get("description"))]
    cierre = ["Escuchaste una nota de Diario Federal."]
    return normalizar("\n\n".join([x for x in inicio if x] + parrafos + cierre))


def normalizar(t: str) -> str:
    """Ajustes para que la voz lea bien."""
    # "US$ 1.023 millones" -> "1.023 millones de dólares"; "$ 5.000" -> "5.000 pesos"
    t = re.sub(rf"(?:US\$|U\$S|USD)\s?([\d.,]+{SUFIJOS})", lambda m: _moneda(m, "dólares"), t)
    t = re.sub(rf"(?<![A-Za-z])\$\s?([\d.,]+{SUFIJOS})", lambda m: _moneda(m, "pesos"), t)
    # "BUENOS AIRES.— El presidente" -> "BUENOS AIRES. El presidente"
    t = re.sub(r"([.:])\s*[—–]\s*", r"\1 ", t)
    t = t.replace("—", ", ").replace("–", ", ")
    t = re.sub(r"[ \t]+,", ",", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    return t


# ── Generación del audio ─────────────────────────────────────────────────────

def nombre_archivo(slug: str) -> str:
    limpio = re.sub(r"[^a-z0-9-]+", "-", slug.lower()).strip("-")
    return f"{limpio or 'nota'}.mp3"


async def sintetizar(texto: str, destino: Path) -> None:
    import edge_tts

    with tempfile.TemporaryDirectory() as tmp:
        crudo = Path(tmp) / "voz.mp3"
        ultimo_error = None
        for intento in range(3):
            try:
                # Límite por intento: si la conexión se cuelga, se corta y se reintenta
                await asyncio.wait_for(edge_tts.Communicate(texto, VOZ).save(str(crudo)), timeout=240)
                if crudo.exists() and crudo.stat().st_size > 1000:
                    break
            except Exception as e:  # la conexión a veces se corta: reintentar
                ultimo_error = e
            await asyncio.sleep(3 * (intento + 1))
        else:
            raise RuntimeError(f"no se pudo generar la voz: {ultimo_error}")

        # Achicar: mono, 32 kbps
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(crudo),
             "-ac", "1", "-b:a", BITRATE, "-ar", "24000", str(destino)],
            check=True,
        )


def duracion(ruta: Path) -> int:
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(ruta)],
            capture_output=True, text=True, check=True,
        )
        return int(round(float(r.stdout.strip())))
    except Exception:
        return 0


# ── Programa ─────────────────────────────────────────────────────────────────

def guardar(manifiesto: dict) -> None:
    MANIFIESTO.write_text(json.dumps(dict(sorted(manifiesto.items())), ensure_ascii=False, indent=2) + "\n", "utf-8")


def main() -> int:
    CARPETA_AUDIO.mkdir(parents=True, exist_ok=True)
    manifiesto = json.loads(MANIFIESTO.read_text("utf-8")) if MANIFIESTO.exists() else {}
    hoy = dt.date.today()
    vigentes = set()
    generados = errores = 0

    for ruta in sorted(list(NOTAS.glob("*.md")) + list(NOTAS.glob("*.mdx"))):
        slug = ruta.stem
        datos, cuerpo = leer_nota(ruta)
        if not datos or datos.get("draft") is True:
            continue
        vigentes.add(slug)

        texto = texto_para_leer(datos, cuerpo)
        huella = hashlib.sha256(f"{VOZ}|{BITRATE}|{texto}".encode()).hexdigest()[:16]
        previo = manifiesto.get(slug)
        archivo = CARPETA_AUDIO / nombre_archivo(slug)

        if previo and previo.get("hash") == huella and archivo.exists():
            continue  # ya está al día

        fecha = fecha_de(datos)
        reciente = fecha is None or (hoy - fecha).days <= DIAS
        if not (TODAS or reciente or previo):
            continue  # nota vieja sin audio: solo con TODAS=1

        print(f"→ {slug} ({len(texto.split())} palabras)")
        try:
            asyncio.run(sintetizar(texto, archivo))
        except Exception as e:
            errores += 1
            print(f"  ✗ {e}", file=sys.stderr)
            continue
        manifiesto[slug] = {
            "archivo": f"/audio/{archivo.name}",
            "duracion": duracion(archivo),
            "hash": huella,
            "voz": VOZ,
        }
        generados += 1
        guardar(manifiesto)  # se guarda nota por nota: si el proceso se corta, no se pierde lo hecho
        print(f"  ✓ {archivo.name} · {manifiesto[slug]['duracion']} s · {archivo.stat().st_size // 1024} KB")

    # Notas borradas o pasadas a borrador: se va su audio
    for slug in [s for s in manifiesto if s not in vigentes]:
        viejo = RAIZ / "public" / manifiesto[slug]["archivo"].lstrip("/")
        if viejo.exists():
            viejo.unlink()
        del manifiesto[slug]
        print(f"− {slug} (audio eliminado)")

    guardar(manifiesto)
    print(f"Listo: {generados} audio(s) nuevos, {errores} error(es), {len(manifiesto)} en total.")
    return 1 if errores and not generados else 0


if __name__ == "__main__":
    sys.exit(main())
