# Laboratorio Audiovisual DF — workflow de integración

Este documento describe únicamente componentes nuevos. No autoriza cambios sobre módulos existentes.

## Flujo editorial

1. **Noticia seleccionada:** el operador copia título, cuerpo y fuentes en el Laboratorio Audiovisual. No se modifica ni se importa automáticamente el registro original.
2. **Gemini:** el endpoint protegido `/api/admin/laboratorio-audiovisual` propone guion, locución, lista de planos y rótulos. La salida queda para revisión humana.
3. **Preparación para Flow:** el operador revisa el guion y copia las instrucciones de cada escena a Google Flow. La autenticación de Flow es independiente de Gemini. No se automatiza el consumo de créditos ni se guardan cookies/sesiones de Google en el repositorio.
4. **Material generado:** el operador incorpora los clips exportados al trabajo audiovisual. Cada archivo conserva su referencia y atribución.
5. **VideoAgent:** los clips se envían a una instancia de VideoAgent aislada, mediante un adaptador HTTP propio cuando esté desplegado y probado. VideoAgent ofrece comprensión, resumen, edición y remake; su ejecución upstream se inicia actualmente con `python main.py` y una configuración de modelos/API, por lo que no se presupone una API REST oficial.
6. **Revisión:** se revisa imagen, sonido, locución, subtítulos, duración, fuentes y derechos. La exportación final se descarga y se entrega manualmente a la Mesa para aprobación.
7. **Publicación:** nunca automática. No hay escritura en CMS ni modificación de artículos.

## Estados de trabajo propuestos

`Borrador → Guion listo → Escenas preparadas → Clips generados → En edición → Revisión editorial → Aprobado → Exportado`

Los estados son del trabajo audiovisual nuevo y no alteran los estados editoriales existentes.

## Despliegue separado de VideoAgent

- Ejecutar en un servicio Linux aislado con GPU adecuada; el README upstream indica 8 GB de memoria GPU como referencia mínima, no como garantía de rendimiento.
- Instalar Python 3.10, FFmpeg y dependencias fijadas por el repositorio upstream.
- Descargar solo los modelos necesarios para el flujo elegido; el proyecto lista modelos de voz, Whisper e ImageBind y otros componentes opcionales.
- Configurar claves de proveedores en secretos del servicio. No incluir claves, cookies o tokens en Git.
- Mantener archivos de video fuera de Vercel y del repositorio; usar almacenamiento de objetos separado con URLs temporales.
- Exponer el servicio solo detrás de autenticación fuerte y limitar tamaño, duración, formatos y concurrencia.
- Probar primero con material de muestra no sensible.

## Dependencias y límites verificados

VideoAgent es un proyecto Python con dependencias multimodales extensas, modelos adicionales y configuración de proveedores. No es una dependencia apta para instalar dentro de las funciones Astro/Vercel ni se considera desplegado por agregar este documento. Ver:
- https://github.com/HKUDS/VideoAgent
- https://github.com/HKUDS/VideoAgent/blob/main/readme_zh.md
- https://github.com/HKUDS/VideoAgent/blob/main/pyproject.toml

## Protección de la aplicación existente

- Esta integración se desarrolla en la rama `add/laboratorio-audiovisual-df`.
- El único archivo preexistente del proyecto que se toca en esta rama es `src/pages/admin/index.astro`, con una única inserción de enlace al nuevo módulo.
- No se modifica `/admin/flash`, CMS, portada, esquema de datos, publicación, configuración Vercel ni dominios.
- No fusionar ni desplegar sin autorización expresa del propietario.


## Verificación técnica de VideoAgent (26-11-2026)

La lectura del README y del manifiesto upstream agrega una condición importante para no diseñar una integración engañosa:

- El arranque documentado es interactivo por consola con `python main.py`; no se encontró en la documentación consultada un contrato REST estable que permita tratarlo como una API lista para consumir.
- La configuración upstream separa proveedores por función: Claude para el router del grafo de agentes; GPT para edición, overview, resumen, QA y commentary; Gemini para captioning y comprensión visual fina. Por lo tanto, **GEMINI_API_KEY por sí sola no habilita todo VideoAgent**.
- El README publica 8 GB de VRAM como referencia de entorno, y enumera descargas independientes para CosyVoice, Fish Speech, Seed-VC, DiffSinger, Whisper e ImageBind. No es razonable asumir que todos esos modelos deban instalarse para el primer caso de uso.
- El manifiesto de dependencias incluye PyTorch/torchaudio, ONNX Runtime GPU, Whisper, Diffusers, Gradio, FastAPI y numerosas bibliotecas de audio/video. Debe tratarse como un entorno pesado y aislado, no como dependencia del sitio Astro ni de Vercel Functions.

### Alcance recomendado para Diario Federal

1. No instalar VideoAgent dentro del repositorio principal ni dentro del runtime de Diario Federal.
2. Antes de aprovisionar una máquina o GPU, validar primero el flujo de menor costo: Gemini prepara el guion; Google Flow produce los clips manualmente; FFmpeg realiza ensamblado/compresión en un worker separado. Esto cubre la producción diaria de uno o dos videos sin exigir VideoAgent.
3. Mantener VideoAgent como etapa opcional de análisis/edición avanzada, solo si una prueba real demuestra una ventaja editorial suficiente y se aprueba el costo de cómputo y de proveedores.
4. Si se habilita más adelante, construir un adaptador HTTP propio delante del proceso upstream, con cola de trabajos, autenticación, límites de tamaño/duración, almacenamiento temporal y borrado automático. No exponer el proceso interactivo directamente a Internet.

Fuentes upstream consultadas:
- https://github.com/HKUDS/VideoAgent/blob/main/readme.md (secciones Quick Start, Model Download, LLM Configuration y Usage).
- https://github.com/HKUDS/VideoAgent/blob/main/pyproject.toml (dependencias y versiones).


## Prueba de concepto aislada en Kaggle (26-11-2026)

Se agregó `notebooks/videoagent-df-kaggle-poc.ipynb` para probar un componente real de VideoAgent sin instalar el framework completo ni desplegar un servidor.

### Alcance de la primera prueba
- Ejecuta el agente upstream `VideoContentQA`: Whisper large-v3-turbo transcribe un clip y el agente responde preguntas sobre esa transcripción.
- Se enruta la función `gpt()` a la API compatible con OpenAI de Gemini, usando el mismo secreto de Gemini para el cliente. Esto evita exigir una clave GPT para esta prueba puntual; no equivale a haber adaptado todo el framework.
- Se omite el coordinador multiagente y la función News completa. El notebook no genera un MP4 final ni publica contenido.
- Se instalan dependencias mínimas, no `requirements.txt` completo. La descarga de Whisper requiere varios GB libres.

### Ejecución en nube
Kaggle documenta GPU P100 gratuita sujeta a disponibilidad/cola, sesiones de hasta 12 horas y 20 GB en `/kaggle/working`. Es apto para pruebas por sesión, no para alojar un servicio permanente. La clave debe guardarse en Kaggle Secrets como `GEMINI_API_KEY`; nunca en el notebook ni en Git. Usar solo un clip breve y un dataset privado.

### Licencias: condición para uso editorial/comercial
El repositorio principal incluye licencia MIT, pero el conjunto de modelos no hereda automáticamente esa licencia. El Model Card de ImageBind declara CC BY-NC-SA 4.0 y uso solo de investigación/no comercial. El README de VideoAgent indica que el flujo `News` requiere CosyVoice, Whisper e ImageBind. Por tanto, no se debe usar esa ruta integrada para producción comercial de Diario Federal mientras ImageBind siga formando parte del flujo. La primera prueba evita ImageBind y se limita a Video QA/transcripción y resumen sobre texto. Revisar también las licencias individuales de los modelos y pesos que se incorporen.

### Resultado esperado y decisión
La prueba se considera satisfactoria si la transcripción española es utilizable, Gemini responde sin inventar y el tiempo/espacio consumidos son razonables. Solo entonces se evalúa un segundo módulo. No se ha ejecutado todavía el notebook ni se ha descargado ningún modelo en una cuenta externa.
