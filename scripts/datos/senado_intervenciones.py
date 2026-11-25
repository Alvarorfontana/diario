"""
Monitor del Congreso: intervenciones en el recinto del Senado.

Lee las versiones taquigráficas que publica el Senado (senado.gob.ar, sección Sesiones)
desde que asumió Javier Milei (10/12/2023) y cuenta, por senador, cuántas veces habló
y cuántas palabras dijo. Guarda el resultado en data/laboratorio/senado-intervenciones.json.

Modo "descubrir": no guarda nada, solo muestra cómo está armada la página de búsqueda
(sirve para ajustar el lector si el Senado cambia su sitio).

Sin dependencias externas salvo pdftotext (paquete poppler-utils), que instala el workflow.
Pide las páginas de a una, con pausa, para no cargar el sitio.
"""

import html
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date

BASE = "https://www.senado.gob.ar"
BUSQUEDA = BASE + "/parlamentario/sesiones/busquedaTac"
DESDE = date(2023, 12, 10)
SALIDA = "data/laboratorio/senado-intervenciones.json"
PAUSA = 2.0
UA = "DiarioFederal-Laboratorio/1.0 (monitor del Congreso; datos publicos)"


def pedir(url, datos=None, binario=False):
    cuerpo = urllib.parse.urlencode(datos).encode() if datos else None
    req = urllib.request.Request(url, data=cuerpo, headers={"User-Agent": UA})
    for intento in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                b = r.read()
                time.sleep(PAUSA)
                return b if binario else b.decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            print(f"  aviso: {url} -> {e}", flush=True)
            time.sleep(5 * (intento + 1))
    raise RuntimeError(f"No se pudo leer {url}")


def norm(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    return re.sub(r"\s+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip().lower()


def descubrir():
    h = pedir(BUSQUEDA)
    print("== largo de la página:", len(h))
    for f in re.findall(r"<form[\s\S]*?</form>", h, re.I)[:3]:
        print("== FORM:", re.findall(r"<form[^>]*>", f, re.I)[0])
        for i in re.findall(r"<(?:input|select)[^>]*>", f, re.I)[:30]:
            print("   ", i[:200])
        for o in re.findall(r"<option[^>]*>[^<]*", f, re.I)[:12]:
            print("    opt", o[:120])
    hrefs = re.findall(r'href="([^"]+)"', h)
    print("== enlaces con tac / pdf / version / diario:")
    for x in [x for x in hrefs if re.search(r"tac|pdf|version|diario|download", x, re.I)][:60]:
        print("   ", x)
    filas = re.findall(r"<tr[\s\S]*?</tr>", h, re.I)
    print("== filas de tabla:", len(filas))
    for f in filas[1:4]:
        print("   ", re.sub(r"\s+", " ", f)[:900])


def sesiones():
    """Lista de sesiones con su enlace a la versión taquigráfica (la página de búsqueda trae todas)."""
    h = pedir(BUSQUEDA)
    vistos, out = set(), []
    for fila in re.findall(r"<tr[\s\S]*?</tr>", h, re.I):
        m = re.search(r"(\d{2})-(\d{2})-(\d{4})", fila)
        enl = [x for x in re.findall(r'href="([^"]+)"', fila) if "downloadTac" in x]
        if not m or not enl:
            continue
        f = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        u = urllib.parse.urljoin(BASE, html.unescape(enl[0]))
        if f < DESDE or u in vistos:
            continue
        vistos.add(u)
        celdas = [re.sub(r"<[^>]+>|\s+", " ", c).strip() for c in re.findall(r"<td[^>]*>([\s\S]*?)</td>", fila, re.I)]
        out.append({"fecha": f.isoformat(), "tipo": (celdas[1] if len(celdas) > 1 else "").title(), "url": u})
    out.sort(key=lambda s: s["fecha"])
    return out


def texto_de(url):
    b = pedir(url, binario=True)
    if b[:4] == b"%PDF":
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as t:
            t.write(b)
        try:
            return subprocess.run(["pdftotext", "-layout", t.name, "-"], capture_output=True, text=True, timeout=180).stdout
        finally:
            os.unlink(t.name)
    h = b.decode("utf-8", "replace")
    h = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", h, flags=re.I)
    h = re.sub(r"<br\s*/?>|</p>", "\n", h, flags=re.I)
    return html.unescape(re.sub(r"<[^>]+>", " ", h))


# Quien habla: "Sr. Presidente (Abad).-", "Sra. Bullrich.-", "Sr. Mayans. –"
ORADOR = re.compile(r"^\s*(Sr\.|Sra\.|SR\.|SRA\.)\s+([A-ZÁÉÍÓÚÑÜa-záéíóúñü' \-]+?)(?:\s*\(([^)]+)\))?\s*\.?\s*[-–—]\s*", re.M)


def intervenciones(texto):
    """Devuelve [(apellido, palabras)] de cada intervención; la Presidencia se cuenta aparte."""
    marcas = list(ORADOR.finditer(texto))
    res = []
    for i, m in enumerate(marcas):
        fin = marcas[i + 1].start() if i + 1 < len(marcas) else len(texto)
        nombre = m.group(2).strip()
        entre = (m.group(3) or "").strip()
        if norm(nombre).startswith(("presidente", "presidenta", "secretario", "secretaria", "prosecretario")):
            nombre = "Presidencia" + (f" ({entre})" if entre else "")
        palabras = len(re.findall(r"\w+", texto[m.end():fin]))
        res.append((nombre, palabras))
    return res


def correr():
    with open("data/laboratorio/congreso.json", encoding="utf-8") as f:
        cong = json.load(f)
    senadores = [x for x in cong["filas"] if x["c"] == "S"]
    por_apellido = defaultdict(list)
    for s in senadores:
        ap = norm(s["n"].split(",")[0])
        por_apellido[ap].append(s)

    ses = sesiones()
    print(f"Sesiones encontradas desde {DESDE}: {len(ses)}", flush=True)
    if not ses:
        raise SystemExit("No encontré sesiones: el sitio cambió. Correr en modo descubrir.")
    tot = defaultdict(lambda: {"intervenciones": 0, "palabras": 0, "sesiones": set()})
    sin_match = defaultdict(int)
    leidas = []
    for s in ses:
        try:
            t = texto_de(s["url"])
        except Exception as e:  # noqa: BLE001
            print("  no se pudo leer", s["fecha"], e)
            continue
        iv = intervenciones(t)
        leidas.append({**s, "intervenciones": len(iv)})
        print(f"  {s['fecha']} {s['tipo']}: {len(iv)} intervenciones", flush=True)
        for nombre, pal in iv:
            if nombre.startswith("Presidencia"):
                continue
            cand = por_apellido.get(norm(nombre))
            if not cand:
                cand = [x for k, v in por_apellido.items() if norm(nombre).endswith(k) or k.endswith(norm(nombre)) for x in v]
            if len(cand) != 1:
                sin_match[nombre] += 1
                continue
            k = cand[0]["id"]
            tot[k]["intervenciones"] += 1
            tot[k]["palabras"] += pal
            tot[k]["sesiones"].add(s["fecha"])

    filas = []
    for s in senadores:
        t = tot.get(s["id"])
        filas.append({"id": s["id"], "n": s["n"], "b": s["b"], "p": s["p"],
                      "intervenciones": t["intervenciones"] if t else 0,
                      "palabras": t["palabras"] if t else 0,
                      "sesiones_con_intervencion": len(t["sesiones"]) if t else 0})
    filas.sort(key=lambda x: -x["palabras"])
    salida = {
        "fecha": date.today().isoformat(),
        "periodo": {"desde": DESDE.isoformat(), "hasta": leidas[-1]["fecha"] if leidas else None},
        "sesiones_leidas": len(leidas),
        "fuente": "Versiones taquigráficas del Senado de la Nación",
        "aviso": "Cuenta las intervenciones identificadas por apellido. No incluye a la Presidencia de la sesión. Hablar mucho no es lo mismo que trabajar mucho.",
        "sin_identificar": dict(sorted(sin_match.items(), key=lambda kv: -kv[1])[:40]),
        "sesiones": leidas,
        "filas": filas,
    }
    if len(leidas) < 5:
        raise SystemExit("Se leyeron muy pocas sesiones; no se guarda nada.")
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    sumar_al_monitor(salida)
    print(f"Listo: {len(leidas)} sesiones, {sum(x['intervenciones'] for x in filas)} intervenciones identificadas, "
          f"{len(sin_match)} nombres sin identificar.")


def sumar_al_monitor(salida, archivo="data/laboratorio/congreso.json"):
    """Pasa intervenciones (iv) y palabras (pw) a las filas del Senado en congreso.json, para que la página las muestre."""
    with open(archivo, encoding="utf-8") as f:
        cong = json.load(f)
    por_id = {x["id"]: x for x in salida["filas"]}
    for fila in cong["filas"]:
        if fila["c"] == "S" and fila["id"] in por_id:
            fila["iv"] = por_id[fila["id"]]["intervenciones"]
            fila["pw"] = por_id[fila["id"]]["palabras"]
    per = f"{salida['periodo']['desde']} a {salida['periodo']['hasta']}"
    for v in cong["variables"]:
        if v["id"] == "intervenciones":
            v.update({"campo": "iv", "estado": "piloto", "fuente": "Versiones taquigráficas del Senado", "frecuencia": "Semanal",
                      "mide": f"Veces que hizo uso de la palabra en el recinto (Senado, {per})"})
    if not any(v["id"] == "palabras_recinto" for v in cong["variables"]):
        i = next((k for k, v in enumerate(cong["variables"]) if v["id"] == "intervenciones"), len(cong["variables"]) - 1)
        cong["variables"].insert(i + 1, {"grupo": "Presencia", "id": "palabras_recinto", "nombre": "Palabras en el recinto",
                                          "mide": f"Cuánto habló en las sesiones (Senado, {per})", "fuente": "Versiones taquigráficas del Senado",
                                          "frecuencia": "Semanal", "modelo": "TheyWorkForYou", "estado": "piloto", "campo": "pw"})
    cong["periodoIntervenciones"] = salida["periodo"] | {"sesiones": salida["sesiones_leidas"]}
    with open(archivo, "w", encoding="utf-8") as f:
        json.dump(cong, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    descubrir() if (sys.argv[1:] or ["correr"])[0] == "descubrir" else correr()
