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
