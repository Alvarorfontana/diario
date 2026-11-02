# Centro de Operaciones Editoriales — Diario Federal

Este directorio define los protocolos editoriales de la primera etapa. No forma parte del build público de Astro y no modifica las rutas, colecciones, estilos ni APIs del sitio.

## Principios
1. El sitio público permanece intacto durante el desarrollo.
2. El centro editorial se construye y despliega por separado.
3. Ningún agente publica por su cuenta.
4. Toda afirmación factual debe tener fuente trazable.
5. Se distinguen hechos confirmados, declaraciones, proyecciones e interpretación.
6. Los borradores y materiales de trabajo no se almacenan en repositorios públicos.
7. No se inventan fuentes, citas, cifras, imágenes, audios ni resultados de herramientas.

## Flujo editorial
Recepción → Investigación → Verificación → Redacción → Edición → Aprobación humana → Exportación/publicación controlada.

## Skills iniciales
- `skills/manager/SKILL.md`: coordinación y estados.
- `skills/research/SKILL.md`: investigación y documentación de fuentes.
- `skills/fact-check/SKILL.md`: verificación y matriz de afirmaciones.
- `skills/writing-editing/SKILL.md`: redacción y edición periodística.

## Integración futura
El repositorio contiene una API de publicación documentada en `API-PUBLICACION.md`. La integración se habilitará solo en un entorno Preview aislado, con repositorio privado y credenciales limitadas. No apuntar esta etapa a `Alvarorfontana/diario` ni a `main`.

## Fuera del alcance de esta etapa
- Cambios en `src/`, `public/`, configuración Astro o Vercel.
- Publicación automática.
- Acceso a credenciales desde el navegador.
- Uso de datos o fuentes no verificadas.
