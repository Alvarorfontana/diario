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
