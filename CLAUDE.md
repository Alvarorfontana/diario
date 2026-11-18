## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Reglas del proyecto (Diario Federal)

Valen para cualquier persona o IA que trabaje en este repo. Antes de empezar, leer también `PROGRESO.md`.

1. **No sacar nada, solo agregar.** Ningún cambio de diseño elimina bloques existentes.
2. **La portada no se reordena.** Un restyling cambia el estilo, no el orden ni los bloques.
3. Diseño base: plantilla Astromag sin azul, sin tipografía gótica en el nombre. Barra superior gris en el celular, header fijo al bajar.
4. Toda foto lleva epígrafe con qué muestra y su fuente.
5. **Commits firmados como `Alvarorfontana` <alvarorfontana@gmail.com>**: Vercel no publica commits de otros autores.
6. Solo herramientas y servicios gratuitos. Nada de Cafecito.
7. Notas y fotos viven en el repo, sin base de datos. Solo comentarios y suscripciones pueden ir a Supabase.
8. El proyecto de Vercel con el dominio es `diario-5z4k`. No crear otros proyectos conectados al repo.
9. Ninguna clave ni grabación de voz en claro: el repo es público. Usar secretos de GitHub o Vercel.
10. **Tipografía fija: una sola letra para leer.** Titular, bajada (copete, clase `bajada`), epígrafe (clase `epigrafe`) y texto de la nota van todos en Newsreader: titulares en 700, bajadas y epígrafes en regular gris. Inter queda solo para rótulos chicos: menú, volantas, fechas, firma, botones, recuadros, gráficos, mercados y logo. Las reglas viven al final de `src/styles/global.css`; toda bajada nueva lleva `class="bajada"`. No agregar otras familias (ni Georgia, ni Manrope, ni letras de sistema), tampoco con estilos dentro de una nota.
11. **Titulares siempre en mayúscula y minúscula** (tipo oración), nunca todo en mayúsculas. Las mayúsculas sostenidas quedan solo para volantas y rótulos chicos en Inter.
12. **Redes solo como dibujo, sin ninguna acción.** Los íconos de redes (WhatsApp, X, Facebook, LinkedIn, Telegram, Instagram, YouTube) arriba y abajo de la nota y en el pie van como dibujo: sin enlace, sin botón que funcione, sin remitir a ninguna cuenta. Solo quedan activos imprimir/PDF, mail y copiar enlace.

13. **Guía de estilo:** toda nota sigue `GUIA-DE-ESTILO.md`. Noticias hasta 760 palabras; análisis, informes y crónicas hasta 1.200; opinión se publica tal cual, sin límite. Estructura: introducción, desarrollo, contexto, voces, conclusión y qué sigue.
14. **Enlaces de las notas en celeste** (`#0284c7`, reglas al final de `src/styles/global.css`). No darles color a mano.
15. **Visitas privadas:** el contador está en `/admin/visitas` (Upstash Redis gratuito). No mostrar esos números en el sitio público.

### Después de cada cambio
1. `npm run build` sin errores.
2. Revisar en ancho de celular y de escritorio.
3. Vista previa de WhatsApp: og:image = foto directa de la nota.
4. Anotar el cambio en `PROGRESO.md` (fecha, qué se hizo, qué quedó pendiente).
