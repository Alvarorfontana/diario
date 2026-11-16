"""
Diseño «OpenFilm» del video flash.

Arma un proyecto de OpenFilm (https://github.com/openfilm, licencia MIT): cada
escena es una página web animada con la marca del diario (apertura, una placa por
noticia y cierre), las fotos y videos de cada bloque van en una tarjeta con fondo
desenfocado, y los subtítulos palabra por palabra usan los tiempos reales de la voz.
OpenFilm lo convierte en un MP4 mudo; la voz y la música se mezclan después, igual
que en los otros diseños (generar-flash.py).
"""
import json
import shutil
import subprocess
from pathlib import Path

VERSION = "0.3.2"  # versión fija de OpenFilm, para que el diseño no cambie solo
AQUI = Path(__file__).resolve().parent
LIB = AQUI / "openfilm" / "lib"
CARD = "left: 96px; top: 205px; width: 1110px; height: 620px"
FULL = "left: 0px; top: 0px; width: 1920px; height: 1080px"


def _dur_medio(ruta):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ruta)],
                             capture_output=True, text=True, check=True).stdout.strip()
        return float(out)
    except Exception:
        return 0.0


def _corto(txt, n=34):
    txt = " ".join(str(txt or "").split())
    return txt if len(txt) <= n else txt[:n - 1].rstrip() + "…"


def _pagina(nombre, modulo, funcion, datos):
    return (f'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="lib/estilo.css"></head><body>\n'
            f'<script type="module">import {{ {funcion} }} from "./lib/{modulo}"; {funcion}({json.dumps(datos, ensure_ascii=False)});</script>'
            f'</body></html>\n')


def renderizar(flash, bloques, linea, trozos, tmp, reunir, destino_mudo):
    proj = Path(tmp) / "openfilm-flash"
    if proj.exists(): shutil.rmtree(proj)
    (proj / "assets").mkdir(parents=True)
    shutil.copytree(LIB, proj / "lib")

    urgente = flash.get("tipo") == "ultimo"
    rotulo = str(flash.get("rotulo") or "")
    fecha = rotulo.capitalize() if rotulo.upper().startswith("SEMANA") else rotulo.lower()
    temas = [_corto(b.get("titulo") or b.get("kicker") or f"Noticia {i + 1}") for i, b in enumerate(bloques)]
    total = sum(d for _, _, d, _ in linea)
    con_subs = bool(flash.get("subtitulos", True))

    paginas, tarjetas, fondos = [], [], []
    (proj / "base.html").write_text(
        '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="lib/estilo.css"></head>'
        '<body style="background:radial-gradient(ellipse at 30% 30%,#2a2a30,#16161a 70%)">'
        '<script type="module">window.film={frame(){}};</script></body></html>\n', encoding="utf-8")

    for k, st, dur, vs in linea:
        if k == "intro":
            (proj / "intro.html").write_text(_pagina("intro", "portada.js", "apertura",
                {"dur": round(dur, 3), "pill": "Último momento" if urgente else "Flash semanal", "fecha": fecha, "temas": temas}), encoding="utf-8")
            paginas.append(f'<iframe src="intro.html" at="{st:.3f}"></iframe>')
            continue
        if k == "cierre":
            (proj / "cierre.html").write_text(_pagina("cierre", "portada.js", "cierre", {"dur": round(dur, 3)}), encoding="utf-8")
            paginas.append(f'<iframe src="cierre.html" at="{st:.3f}"></iframe>')
            continue
        i = int(k[1:]); b = bloques[i]
        tz = [[[w, round(a, 3), round(bb, 3)] for w, a, bb in z] for z in (trozos.get(i) or [])] if con_subs else []
        datos = {"n": i + 1, "dur": round(dur, 3), "offVoz": round(vs - st, 3), "pill": "Último momento" if urgente else "Flash",
                 "fecha": fecha, "temas": temas, "kicker": b.get("kicker", ""), "titulo": b.get("titulo", "") or temas[i],
                 "dato": b.get("dato", ""), "bajada": b.get("bajada", ""), "epigrafe": b.get("epigrafe", ""),
                 "fuente": b.get("fuente", ""), "trozos": tz}
        (proj / f"b{i + 1}.html").write_text(_pagina(f"b{i + 1}", "placa.js", "placa", datos), encoding="utf-8")
        paginas.append(f'<iframe src="b{i + 1}.html" at="{st:.3f}"></iframe>')

        m = b.get("media") or {}
        ruta = reunir(m.get("archivo"), tmp)
        if not ruta: continue
        es_video = m.get("tipo") == "video" or Path(ruta).suffix.lower() in (".mp4", ".mov", ".webm", ".m4v")
        ext = Path(ruta).suffix.lower() or (".mp4" if es_video else ".jpg")
        nombre = f"assets/m{i + 1}{ext}"
        shutil.copy(ruta, proj / nombre)
        anim_t = "animation: acerca var(--clip-length) linear both"
        anim_f = "animation: deriva var(--clip-length) linear both"
        if not es_video:
            foco = m.get("foco") or [0.5, 0.4]
            pos = f"object-position: {float(foco[0]) * 100:.0f}% {float(foco[1]) * 100:.0f}%"
            tarjetas.append(f'<img id="t{i + 1}" src="{nombre}#t=0,{dur:.3f}" at="{st:.3f}" class="tarjeta" style="{CARD}; {pos}; {anim_t}">')
            fondos.append(f'<img id="f{i + 1}" src="{nombre}#t=0,{dur:.3f}" at="{st:.3f}" class="fondo" style="{FULL}; {anim_f}">')
            continue
        # un video más corto que la noticia se repite desde su punto de inicio hasta cubrirla
        ini = float(m.get("inicio") or 0); largo = max(0.5, _dur_medio(proj / nombre) - ini)
        t, j = st, 0
        while t < st + dur - 0.05:
            tramo = min(largo, st + dur - t)
            for pista, clase, estilo, pref in ((tarjetas, "tarjeta", CARD, "t"), (fondos, "fondo", FULL, "f")):
                pista.append(f'<video id="{pref}{i + 1}-{j}" src="{nombre}#t={ini:.3f},{ini + tramo:.3f}" at="{t:.3f}" muted '
                             f'class="{clase}" style="{estilo}; {anim_t if clase == "tarjeta" else anim_f}"></video>')
            t += tramo; j += 1

    film = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1920, height=1080">
<style>
  .tarjeta {{ object-fit: cover; border-radius: 20px; box-shadow: 0 30px 80px rgba(0,0,0,.55); }}
  .fondo {{ object-fit: cover; filter: blur(42px) brightness(.38) saturate(1.2); }}
  @keyframes acerca {{ from {{ scale: 1 }} to {{ scale: 1.06 }} }}
  @keyframes deriva {{ from {{ scale: 1.25 }} to {{ scale: 1.35 }} }}
</style>
</head>
<body>
<section>
  {chr(10).join('  ' + p for p in paginas).strip()}
</section>
{'<section>' + chr(10) + chr(10).join('  ' + x for x in tarjetas) + chr(10) + '</section>' if tarjetas else ''}
{'<section>' + chr(10) + chr(10).join('  ' + x for x in fondos) + chr(10) + '</section>' if fondos else ''}
<section>
  <iframe id="base" src="base.html#t=0,{total:.3f}" at="0"></iframe>
</section>
</body>
</html>
"""
    (proj / "film.html").write_text(film, encoding="utf-8")
    print(f"  OpenFilm: {len(paginas)} escenas, {len(tarjetas)} medios; renderizando…", flush=True)
    subprocess.run(["npx", "-y", f"openfilm@{VERSION}", "render", "--out", str(destino_mudo), "--workers", "2"],
                   cwd=proj, check=True)
    if not Path(destino_mudo).exists():
        raise RuntimeError("OpenFilm no generó el video")
