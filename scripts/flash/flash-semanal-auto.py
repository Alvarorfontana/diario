#!/usr/bin/env python3
"""
Arma solo el borrador del flash semanal con las notas publicadas en los últimos 7 días.

Lo corre .github/workflows/flash-semanal-auto.yml los domingos. Elige hasta 5 notas
(primero las de tapa, después las más recientes, sólo las que tienen foto), carga cada
noticia (antetítulo, título corto, bajada, texto para la voz, foto con epígrafe y fuente)
y guarda data/flash/<fecha>-semanal-auto.json con estado «borrador» y diseño OpenFilm.
No genera ni publica nada: Álvaro lo revisa en /admin/flash y toca «Generar».

Uso: python scripts/flash/flash-semanal-auto.py [AAAA-MM-DD]   (fecha de referencia; por defecto hoy)
"""
import datetime as dt
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import yaml

RAIZ = Path(__file__).resolve().parent.parent.parent
NOTAS = RAIZ / "src" / "content" / "articulos"
FLASH = RAIZ / "data" / "flash"
SECCIONES = {"argentina": "Argentina", "internacional": "Internacional", "economia": "Economía", "opinion": "Opinión",
             "deportes": "Deportes", "cultura": "Cultura", "tecnologia": "Tecnología"}
MAX_NOTAS = 5


def leer(p):
    t = p.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", t, re.S)
    if not m: return None, ""
    try: fm = yaml.safe_load(m.group(1)) or {}
    except Exception: return None, ""
    return fm, m.group(2)


def limpio(t):
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t or "")           # imágenes
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)              # enlaces
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"[*_`>#]+", "", t)
    return " ".join(t.split())


def cortar(t, n):
    t = " ".join(str(t or "").split())
    if len(t) <= n: return t
    c = t[:n]
    k = max(c.rfind(". "), c.rfind("? "), c.rfind("! "))
    return c[:k + 1] if k > n * 0.55 else c.rsplit(" ", 1)[0].rstrip(",;:") + "…"


def titulo_corto(t):
    t = " ".join(str(t or "").split())
    if ":" in t and 12 <= len(t.split(":")[0]) <= 55: return t.split(":")[0].strip()
    return cortar(t, 55)


def primer_parrafo(cuerpo):
    for bloque in re.split(r"\n\s*\n", cuerpo):
        b = bloque.strip()
        if not b or b.startswith(("#", "!", "<", ">", "|", "-", "*")): continue
        return limpio(b)
    return ""


def foto_y_credito(fm):
    foto = str(fm.get("heroImage") or "").strip()
    if not (foto.startswith("https://") or foto.startswith(("/uploads/", "/images/", "/media/"))): return None, "", ""
    cap = " ".join(str(fm.get("imageCaption") or "").split())
    m = re.search(r"\b(Fotograf[ií]a|Foto|Imagen|Video)\s*:\s*(.+?)\.?$", cap)
    epigrafe = cap[:m.start()].strip(" .,-–—") if m else cap
    fuente = f"Foto: {re.split(r'\.\s*(Ep[ií]grafe|Edici[oó]n)\b', m.group(2))[0].strip()}" if m else ""
    if not fuente and foto.startswith("https://"):
        fuente = "Foto: " + urlparse(foto).hostname.replace("www.", "")
    return foto, cortar(epigrafe, 60).rstrip("…"), cortar(fuente, 80)


def main():
    hoy = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.date.today()
    desde = hoy - dt.timedelta(days=7)
    destino = FLASH / f"{hoy.isoformat()}-semanal-auto.json"
    if destino.exists():
        print(f"Ya existe {destino.name}; no se pisa."); return

    candidatas = []
    for p in NOTAS.glob("*.md"):
        fm, cuerpo = leer(p)
        if not fm or fm.get("draft"): continue
        try: fecha = dt.date.fromisoformat(str(fm.get("pubDate"))[:10])
        except Exception: continue
        if not (desde < fecha <= hoy): continue
        foto, epigrafe, fuente = foto_y_credito(fm)
        if not foto: continue
        candidatas.append((bool(fm.get("tapa")), fecha, fm, cuerpo, foto, epigrafe, fuente))
    candidatas.sort(key=lambda c: (c[0], c[1]), reverse=True)
    # variedad: no más de dos notas del mismo tema (primera etiqueta)
    elegidas, por_tema = [], {}
    for c in candidatas:
        tema = str((c[2].get("tags") or [""])[0]).lower().replace("papa ", "")
        if por_tema.get(tema, 0) >= 2: continue
        por_tema[tema] = por_tema.get(tema, 0) + 1
        elegidas.append(c)
        if len(elegidas) == MAX_NOTAS: break
    if len(elegidas) < 2:
        print(f"Sólo hay {len(elegidas)} nota(s) con foto en la semana: no se arma el flash."); return

    bloques = []
    for _, fecha, fm, cuerpo, foto, epigrafe, fuente in elegidas:
        seccion = SECCIONES.get(str(fm.get("section") or "").lower(), "")
        tags = fm.get("tags") or []
        tema = str(tags[0]) if tags else ""
        kicker = " · ".join(x for x in (seccion, tema) if x)
        bajada = fm.get("description") or fm.get("volanta") or ""
        voz = cortar(f"{limpio(bajada)} {primer_parrafo(cuerpo)}", 560)
        bloques.append({
            "kicker": cortar(kicker, 30).rstrip("…"),
            "titulo": titulo_corto(fm.get("title")),
            "dato": "",
            "bajada": cortar(limpio(bajada), 110),
            "texto": voz,
            "epigrafe": epigrafe,
            "fuente": fuente,
            "media": {"tipo": "foto", "archivo": foto, "foco": [0.5, 0.4]},
        })

    flash = {
        "id": destino.stem, "tipo": "semanal", "titulo": "; ".join(b["titulo"] for b in bloques)[:140],
        "fecha": hoy.isoformat(), "voz": "es-AR-TomasNeural", "velocidad": 15, "musica": "/flash/musica/paulyudin.mp3",
        "volumenMusica": -17, "estilo": "openfilm", "subtitulos": True, "bloques": bloques,
        "estado": "borrador", "publicado": False, "automatico": True,
    }
    FLASH.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(flash, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Borrador listo: {destino.name} con {len(bloques)} noticias:")
    for b in bloques: print("  ·", b["titulo"])


if __name__ == "__main__":
    main()
