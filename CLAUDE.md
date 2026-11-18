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
10. **Tipografía fija: solo dos letras, estilo LPO / El País.** Titulares en Newsreader 700 (siempre la misma negrita, nada de extranegrita suelta) y texto corrido de las notas en Newsreader. Bajadas (copete, clase `bajada`) y epígrafes (clase `epigrafe`) en Inter regular gris, igual que menú, volantas, firma, fechas, recuadros, gráficos y logo. Las reglas viven al final de `src/styles/global.css`: toda bajada nueva lleva `class="bajada"`. No agregar otras familias (ni Georgia, ni Manrope, ni letras de sistema), tampoco con estilos dentro de una nota.
11. **Titulares siempre en mayúscula y minúscula** (tipo oración), nunca todo en mayúsculas. Las mayúsculas sostenidas quedan solo para volantas y rótulos chicos en Inter.
12. **Sin enlaces a cuentas personales** (Facebook, X, Substack u otras): los íconos de redes van solo como dibujo. Los botones de compartir nota sí quedan, sin mencionar ninguna cuenta.

### Después de cada cambio
1. `npm run build` sin errores.
2. Revisar en ancho de celular y de escritorio.
3. Vista previa de WhatsApp: og:image = foto directa de la nota.
4. Anotar el cambio en `PROGRESO.md` (fecha, qué se hizo, qué quedó pendiente).
