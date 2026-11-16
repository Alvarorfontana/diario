# Progreso · Diario Federal

Libreta del proyecto: qué hay, qué se hizo y qué falta. Se actualiza después de cada cambio, con la fecha.
Las reglas de trabajo están en `CLAUDE.md`.

## Qué hay hoy

- Sitio diariofederal.com.ar (Astro, Vercel `diario-5z4k`), panel propio en `/admin`.
- Portada estilo Astromag: último momento, franja de mercados, "Lo que tenés que saber", En vivo, Opinión con caras,
  Lo más leído (Vercel Analytics), boletines temáticos, portada "Tu región", "Temas del día".
- Solapa "Canal" con señales de YouTube (DW Español primero, C5N, Página/12, France 24, Euronews).
- "Escuchá esta nota": audio automático por nota (`scripts/generar-audios.py`, tarea "Audio de las notas").
- Botón imprimir o bajar PDF por nota.
- Video flash (`/admin/flash` → tarea "Video flash", `scripts/flash/generar-flash.py`). Diseños: Noticiero, Clásico y Editorial.
- Comentarios por correo con aprobación de Álvaro.

## Registro

### 2026-11-14
- Laboratorio de datos con datos propios: proceso diario `.github/workflows/laboratorio-datos.yml` (19:23 h) corre `scripts/datos/actualizar-laboratorio.mjs` y guarda en `data/laboratorio/` inflación INDEC (datos.gob.ar, respaldo ArgentinaDatos), riesgo país, dólar oficial/blue/MEP (ArgentinaDatos), reservas (API BCRA v4.0) y proyecciones FMI de la región. Si una fuente falla se conserva el último dato (`estado.json`). /datos/ suma "Argentina en datos": 5 indicadores y 5 gráficos + tabla FMI. Pendiente: NASA FIRMS (incendios) y ACLED (conflictos) cuando Álvaro saque las claves gratuitas; conectar el Centro de Información.
- Laboratorio de datos (/datos/) y Centro multimedia (/multimedia/), tomados del PR 15 y adaptados: en el menú ☰ y en el pie; sin azul; sin fechas visibles; ECharts y Leaflet instalados en el sitio (sin CDN); el mapa GDELT solo aparece si la fuente devuelve datos; radio con "Próximamente" hasta tener señal. Pendiente: conectar el Centro de Información (GDELT + RSS ya recolectados) como fuente del Laboratorio, en vez de consultar GDELT desde el navegador.
- Celular: en la nota, la barra fija con el titular tapaba el ☰; ahora la barra lleva su propio ☰ que abre el menú de secciones (como El País). Freno general para que nada ensanche la página en el celular (overflow-x: clip) y sin agrandado automático de letras del navegador.
- Portada más limpia (pedido de Álvaro): secciones en menú desplegable (☰) con pocas entradas (Internacional, Argentina, Economía, Opinión + especiales Brasil 2026, Flash, Boletín, Canal, Contexto Político); Deportes, Cultura y Tecnología salen del menú/pie pero se pueden seguir cargando y sus notas van al montón de la portada. "Por sección" pasa a "Más noticias". Sin fechas visibles en notas (quedan en metadatos para Google). Logo centrado y fecha del día en franja finita debajo ("14 nov 2026", automática, estilo El País/NYT). Sin títulos sobre fotos: tapa, destacadas y apertura de sección con foto limpia y título abajo.
- Flash de último momento (~30 s): "UOM: Bonetti le responde a Mariano Martín y defiende la paritaria", con frases de su nota del 13/11. Voz Tomás, diseño Noticiero. Publicado en /flash (dura 41 s).

### 2026-11-13
- Nota de opinión: "Mariano Martín: periodismo sin código de ética profesional" (Roberto Bonetti, UOM Seccional Capital). Texto textual del PDF, foto cedida por Álvaro. Bonetti sumado a AUTORES con foto de firma.

### 2026-11-11
- Nota de tapa: "León XIV se despidió en Luján" (Emilio Lahitte). Salió sin foto; Álvaro sube la de Vatican News desde
  `/admin` con su epígrafe.
- Flash: nuevo diseño **Editorial** (estilo revista, número grande del tema, cortina roja entre noticias). Se elige en
  `/admin/flash` → "Diseño del video". Noticiero y Clásico siguen igual.
- **Voz clonada** de Álvaro como opción ("Mi voz (clonada)") en el flash y en el audio de las notas. Modelo Chatterbox
  Multilingual (MIT), `scripts/voz_clonada.py`. La grabación va cifrada en `data/voz/referencia.enc`; la clave en el
  secreto `VOZ_CLAVE`. Si falta, sale con Tomás.
- Se sumaron estas reglas a `CLAUDE.md` y se creó este archivo.

## Pendiente

- [ ] Voz clonada: Álvaro graba 20–30 s, se cifra y se sube `data/voz/referencia.enc`; cargar el secreto `VOZ_CLAVE`.
      Después, primera prueba: medir cuánto tarda en GitHub y cómo suena la tonada.
- [ ] Audio de las notas como lista de reproducción y podcast (Spotify y otras).
- [ ] Bot de Telegram para subir notas (ficha + texto).
- [ ] Newsletter: definir el envío de boletines.
- [ ] Evaluador automático: tarea de GitHub que revise cada cambio antes de publicar (build, fotos con epígrafe y fuente,
      sin claves en el código).

- 2026-11-11: Flash de último momento "León XIV en Luján" (voz original del Papa, música Starostin, frases destacadas, sin marca de El Destape; video Vatican News). Miniatura: captura recortada y limpia de logos.
- 2026-11-12: Nota "Perú consigue deuda a 30 años y Argentina mira de afuera" (Economía, firma Ramiro De la Puente). Fotos de Caputo (principal) y Keiko Fujimori (en el cuerpo), crédito Diario Federal.
- 2026-11-12: Nota "Cerrada, cara y sin inversión: por qué la industria argentina cae más que en casi todo el mundo" (Economía, firma Ramiro De la Puente). Datos del MIDTM (Banco Mundial, FMI, OIT, CEPAL), INDEC, SIPA y SRT. Foto Pauny (Maquinac) y tres gráficos propios en /uploads. Se agregó estilo para tablas dentro de las notas (scroll horizontal en celular).
- 2026-11-12: Nota de industria: el número de puestos perdidos queda unificado en 90.924 (SIPA) en bajada, epígrafe, puntos clave y cuerpo; la SRT se usa solo para empleadores (4.324).
- 2026-11-12: Nota "Ni 500 países ni el 30 % del mundo: lo que esconden las cifras de Milei" (Argentina, chequeo, firma Emilio Lahitte). Discurso en la Gala Endeavor: 500 mercados, 30 % del planeta, respuesta al Papa sobre IA y empleo, pobreza y Revolución Industrial, importaciones. Datos del MIDTM. Foto de Ámbito recortada (sin franja con logo) en /uploads.
- 2026-11-13: Firmas: se quitaron los autores inventados (María Fernández, Laura Giménez, Alberto González con foto genérica). Sus notas pasan a "Redacción Federal" y "Mesa Internacional", firmas de mesa con bio en consts.ts. El /admin ahora respeta la firma ("autor") que manda el Centro de Información con cada borrador.
- 2026-11-13: Se volvieron atrás las firmas: María Fernández, Laura Giménez y Alberto González quedan como estaban, con sus notas y fotos. Las firmas de mesa (Redacción Federal, Mesa Internacional) se usan solo de acá en adelante para los borradores del Centro.
- 2026-11-14: Seguridad del /admin: después de 5 contraseñas incorrectas desde la misma conexión, el ingreso se bloquea 15 minutos (cada error demora 1 segundo). Vive en la memoria del servidor (src/lib/auth.ts). Pendiente: verificación en dos pasos en GitHub, Vercel y Google; evaluar pasar el repo a privado (Actions usa ~500 min/mes, el plan privado gratis da 2.000).

## 2026-11-14 — Boletín de audio: cortina de noticiero
- Arreglado el filtro de ffmpeg que hacía fallar la generación (la voz se usaba dos veces sin asplit).
- Cortina: música del flash (Paulyudin) acelerada a 1.25 para ritmo de noticiero. El nombre del MP3 ahora cambia si cambia la música.
- Boletín: el script arma también una tapa cuadrada con el logo y un video MP4 (tapa + audio) para WhatsApp. Se guarda solo el último video y la última tapa.
- /boletines: botón "Pasar por WhatsApp" (en celular comparte el video; en computadora abre WhatsApp con el enlace), descarga del video y la tapa como vista previa.
- 2026-11-15: Video flash: nuevo diseño **OpenFilm** (cuarto, en /admin/flash → «Diseño del video»). Escenas animadas como páginas web (apertura con lista de temas, placa por noticia con número grande, título palabra por palabra, dato en rojo, cortina roja, barra de temas, video en tarjeta con fondo desenfocado, subtítulos palabra por palabra) renderizadas con OpenFilm 0.3.2 (MIT, gratis) en la tarea de GitHub; voz y música se mezclan igual que antes. Código: `scripts/flash/openfilm_flash.py` y `scripts/flash/openfilm/lib/`. Noticiero, Clásico y Editorial no cambian.
- 2026-11-15: Arreglo en `/api/admin/flash`: guardaba siempre «noticiero» aunque se eligiera Editorial, y pasaba la voz clonada a Tomás. Ahora respeta Editorial, OpenFilm y «Mi voz (clonada)».
- 2026-11-15: Pronunciación: Kicillof → «Kisilof», Kirchner (y kirchnerismo/kirchnerista) → «Kírshner» (elegido por Álvaro tras escuchar opciones).
- Pendiente OpenFilm: probar el primer flash real en la tarea de GitHub (tiempo de render, ~8 min por 1,5 min de video).
