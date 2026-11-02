# Implementación del Observatorio — hoja de ruta

## Fase 0 — Aislada y documentada (iniciada)
- [x] Crear rama de trabajo separada de `main`.
- [x] Definir Skills de coordinación, investigación, verificación y redacción.
- [x] Definir Skill de Observatorio de Noticias.
- [x] Definir Skill de Agenda Editorial Propia.
- [x] Definir contrato de datos de agenda.
- [x] Registrar fuentes institucionales iniciales.
- [x] Definir plantilla de informe diario.
- [ ] Revisar y aprobar el alcance del MVP.

## Fase 1 — MVP operativo
- [ ] Crear aplicación independiente, fuera de las rutas y del build público de Astro.
- [ ] Configurar autenticación y control de acceso antes de almacenar información editorial.
- [ ] Persistir señales, fuentes, propuestas y estados en una base de datos separada.
- [ ] Implementar captura manual de enlaces y documentos.
- [ ] Incorporar conectores RSS/API solo después de verificar endpoints, permisos y límites.
- [ ] Deduplicar señales y conservar historial de cambios.
- [ ] Crear panel de Observatorio y Agenda con filtros por tema, país, prioridad y estado.
- [ ] Generar informe diario y exportarlo en Markdown/PDF.
- [ ] Registrar quién aprobó, modificó o descartó cada propuesta.

## Fase 2 — Automatización de monitoreo
- [ ] Tareas programadas para fuentes habilitadas.
- [ ] Alertas por novedades relevantes, no por cada publicación.
- [ ] Seguimiento de temas y actores.
- [ ] Comparación de cobertura con muestra y período explícitos.
- [ ] Registro de fallos de consulta y fuentes inactivas.

## Fase 3 — Integración editorial
- [ ] Crear expedientes de investigación desde una propuesta aprobada.
- [ ] Enviar material al flujo de verificación y redacción.
- [ ] Preparar paquete editorial y derivados multimedia.
- [ ] Integrar publicación únicamente mediante credenciales limitadas y aprobación explícita.

## Condiciones de seguridad
- No agregar archivos del observatorio a `src/` ni `public/` del diario.
- No cambiar `main`, configuración Astro, dominio, DNS ni proyecto Vercel del sitio público.
- No usar credenciales del sitio público en el navegador.
- La aplicación tendrá repositorio/proyecto y almacenamiento propios.
- No realizar publicación automática.
