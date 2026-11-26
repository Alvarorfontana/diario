"""Pronunciación de nombres, siglas y lugares para las voces del diario (flash y notas en audio).

Junta dos listas:
  - data/flash/pronunciacion-base.json: la lista base (dirigentes, siglas, lugares, medios, empresas).
  - data/flash/pronunciacion.json: la que se edita en /admin/flash. Manda si repite una palabra.

Se escribe en pantalla como siempre; la voz lee lo que dice la lista.
"""
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
BASE = RAIZ / "data" / "flash" / "pronunciacion-base.json"
PROPIA = RAIZ / "data" / "flash" / "pronunciacion.json"


def _leer(ruta):
    try:
        d = json.loads(ruta.read_text(encoding="utf-8"))
        return {k: v for k, v in d.items() if isinstance(v, str) and not k.startswith("_")} if isinstance(d, dict) else {}
    except Exception:
        return {}


def cargar():
    dicc = _leer(BASE)
    dicc.update(_leer(PROPIA))
    return dicc


def aplicar(texto, dicc=None):
    """Reemplaza cada palabra o frase de la lista por cómo se dice, en una sola pasada
    (respeta mayúsculas y palabras enteras; lo ya reemplazado no se vuelve a tocar)."""
    dicc = cargar() if dicc is None else dicc
    pares = {k.strip(): v.strip() for k, v in dicc.items() if k.strip() and v.strip()}
    if not pares:
        return texto
    claves = sorted(pares, key=len, reverse=True)
    patron = re.compile(r"(?<!\w)(?:" + "|".join(re.escape(k) for k in claves) + r")(?!\w)")
    return patron.sub(lambda m: pares[m.group(0)], texto)
