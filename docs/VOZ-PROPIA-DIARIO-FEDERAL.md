# Voz propia de Álvaro — arquitectura para Diario Federal

## Objetivo

Generar versiones de audio de las notas de Diario Federal con una voz sintética basada en una grabación autorizada de Álvaro Fontana, conservando el flujo editorial, el reproductor actual y los archivos MP3 publicados por el sitio.

La voz de referencia y cualquier representación reutilizable de ella son datos sensibles: nunca deben quedar en el repositorio público, en los artefactos de Actions ni en URLs públicas.

## Estado comprobado del proyecto

- El flujo existente está en `.github/workflows/audio-notas.yml`.
- `scripts/generar-audios.py` prepara el texto desde Markdown/MDX, genera MP3, evita regenerar notas sin cambios y actualiza `data/audios.json`.
- La voz actual por defecto es `es-AR-TomasNeural`.
- Existe `scripts/voz_clonada.py`, que intenta cargar Chatterbox Multilingual desde CPU cuando se selecciona `clonada`.
- El workflow actual instala PyTorch CPU y Chatterbox dentro de GitHub Actions. No es una base recomendable para procesar artículos largos de forma fiable: descarga grande de dependencias, latencia, memoria y límite de tiempo.
- La ruta cifrada `data/voz/referencia.enc` no está presente en el repositorio consultado. La existencia/configuración de secretos no se puede confirmar desde esta revisión.

## Decisión técnica propuesta

Evaluar **Qwen3-TTS 12Hz Base** como primer candidato para la voz personalizada, sin descartar otros motores hasta escuchar pruebas con la grabación real. El repositorio oficial declara clonación rápida de voz, soporte de español y licencia Apache 2.0 para la serie publicada. La calidad concreta del español rioplatense debe validarse con una prueba A/B; el soporte de español no garantiza por sí solo acento argentino natural.

Referencia oficial: https://github.com/QwenLM/Qwen3-TTS

No seleccionar todavía un proveedor de GPU ni activar producción. Primero hay que comparar una misma muestra de 30–60 segundos y revisar pronunciación, timbre, ritmo, estabilidad y fidelidad en párrafos largos.

## Arquitectura objetivo

1. **Diario Federal / Astro / Vercel:** conserva el sitio, el reproductor y la publicación de los MP3.
2. **GitHub Actions:** detecta notas nuevas o modificadas, prepara el texto y solicita la síntesis.
3. **Servicio privado de inferencia con GPU:** mantiene el modelo cargado y recibe texto por HTTPS. No debe ejecutarse dentro de una función serverless de Vercel ni depender de una sesión efímera de GitHub Actions.
4. **Almacenamiento temporal:** referencia de voz y prompt de clonación en almacenamiento privado, cifrado y con acceso restringido. No incluirlos en el repo ni en logs.
5. **Salida:** el servicio devuelve WAV; el pipeline existente convierte a MP3 mono 24 kHz / 32 kbps y actualiza `data/audios.json`.

### Contrato mínimo del servicio privado

- `POST /v1/synthesize`
- Autenticación mediante token secreto de servidor; nunca exponerlo al navegador.
- Entrada: texto, idioma `Spanish`, identificador de voz autorizado y parámetros acotados.
- Salida: audio WAV binario y metadatos de duración/modelo.
- Rechazar texto vacío, cargas excesivas y solicitudes sin autenticación.
- No registrar texto completo de notas ni audio de referencia en logs.
- Aplicar límites de concurrencia, timeout, reintentos y limpieza de temporales.
- El servicio no debe ofrecer clonación arbitraria de voces de terceros.

## Preparación de la grabación

Cuando se adjunte el audio real de Álvaro:

- comprobar que sea una grabación utilizable y no una transcripción;
- seleccionar una toma limpia, sin música ni voces de fondo;
- conservar una copia original privada;
- generar una referencia mono a 24 kHz y revisar silencios, clipping y ruido;
- mantener el texto transcrito exacto para los modelos que aceptan audio + texto de referencia;
- no publicar ni subir la muestra a GitHub.

La presentación ya escrita para Diario Federal puede servir como guion; falta recibir el archivo de audio grabado.

## Pruebas de aceptación antes de producción

1. Comparar la misma muestra con Qwen3-TTS y, si resulta viable, un segundo motor.
2. Escuchar pronunciación de nombres argentinos, topónimos, cifras, siglas, citas y palabras extranjeras.
3. Generar una nota de 500 palabras y otra de 1.500–5.000 palabras para detectar cambios de timbre, pausas o cortes.
4. Comprobar que los MP3 se reproduzcan en móvil y escritorio y que la duración del manifiesto coincida.
5. Verificar que un error del servicio no publique un MP3 vacío ni sobrescriba un audio válido.
6. Mantener Tomás como fallback explícito hasta aprobar la calidad de la voz propia.

## Seguridad y operación

- Secretos requeridos en GitHub: URL privada del servicio y token de acceso; no incluir valores en el código.
- La referencia de voz debe residir fuera del repositorio público, cifrada en reposo y accesible solo al servicio.
- No generar ni publicar audios con voz clonada hasta que Álvaro escuche y apruebe una muestra.
- La selección de voz debe quedar registrada en el manifiesto para permitir auditoría y regeneración controlada.
- La transición debe ser reversible: si falla la síntesis personalizada, conservar el audio anterior y marcar el error; el fallback neural solo se usa cuando no existe un audio válido nuevo.

## Pendientes para completar

- [ ] Recibir y validar el archivo de voz de referencia.
- [ ] Ejecutar prueba comparativa con Qwen3-TTS en español rioplatense.
- [ ] Elegir y probar un servicio GPU privado con costos y límites conocidos.
- [ ] Implementar el cliente HTTP del servicio en el pipeline, sin instalar modelos pesados en GitHub Actions.
- [ ] Añadir pruebas automáticas para errores, textos largos y preservación de audios existentes.
- [ ] Aprobar la muestra de voz antes de habilitar la opción en producción.


## Integración Qwen añadida en la rama de trabajo

Se agregó una primera integración por HTTP:

- `services/qwen-tts/server.py`: servicio FastAPI privado que carga Qwen3-TTS 12Hz 1.7B Base en GPU, prepara una vez el prompt de clonación y sintetiza el texto en fragmentos.
- `services/qwen-tts/requirements.txt`: dependencias del servicio.
- `scripts/generar-audios.py`: opción `VOZ=qwen`, que llama al servicio privado, recibe WAV y lo comprime a MP3 mono 24 kHz / 32 kbps.
- `.github/workflows/audio-notas.yml`: opción manual `qwen` y lectura de los secretos `TTS_API_URL` y `TTS_API_TOKEN`. No instala el modelo dentro de GitHub Actions.

### Configuración necesaria en el servidor GPU

Variables obligatorias del servicio:

- `TTS_API_TOKEN`: token aleatorio largo.
- `VOICE_REFERENCE_PATH`: ruta privada al WAV de referencia.
- `VOICE_REFERENCE_TEXT`: transcripción exacta de esa grabación.
- Opcionales: `QWEN_MODEL` (por defecto `Qwen/Qwen3-TTS-12Hz-1.7B-Base`), `QWEN_DEVICE` (por defecto `cuda:0`), `TTS_MAX_CHARS` (por defecto 280).

El servicio se inicia con `uvicorn server:app --host 0.0.0.0 --port 8000`, detrás de HTTPS y firewall. No exponer el puerto directamente a Internet sin proxy TLS y controles de acceso. La GPU debe soportar CUDA y bfloat16; FlashAttention 2 debe estar disponible para la configuración indicada.

Secretos necesarios en GitHub Actions:

- `TTS_API_URL`: URL HTTPS del servicio.
- `TTS_API_TOKEN`: el mismo token configurado en el servidor.

### Estado real y límites

La integración de código está preparada, pero **no está operativa todavía**: falta desplegar el servicio en una GPU, cargar de forma privada la grabación de Álvaro y configurar los dos secretos de GitHub. No seleccionar `qwen` en producción antes de completar esos pasos y aprobar una muestra. Si el servicio falla, la tarea falla sin sustituir ni borrar el MP3 anterior.

La generación larga se divide en fragmentos dentro del servicio y se concatena antes de la compresión MP3. Hay que probar continuidad de timbre y pausas en notas extensas antes de habilitar la opción para publicaciones automáticas.
