# API privada de publicación — Diario Federal

Implementación preparada en una rama local, sin publicar cambios en GitHub ni en el diario.

## Qué hace

`POST /api/v1/articulos` crea notas en el mismo formato Markdown con frontmatter YAML que utiliza el diario. Usa la API de GitHub y conserva la colección actual de Astro; no agrega una base de datos. El panel existente mantiene su autenticación y sus rutas.

La API necesita un Bearer Token propio. Una sesión iniciada en el panel no autoriza llamadas a esta ruta. No acepta tokens en la URL. El endpoint es accesible por red una vez desplegado; la autenticación protege la operación.

## Configuración del servidor

Configurar estas variables como secretos/variables del entorno correspondiente en Vercel, nunca en archivos versionados:

| Variable | Valor o propósito |
| --- | --- |
| `ARTICULOS_API_TOKEN` | Secreto aleatorio de al menos 32 caracteres; usar 32 bytes aleatorios o más. No reutilizar la contraseña del panel. |
| `PUBLICACION_GITHUB_TOKEN` | Credencial de GitHub limitada al repositorio elegido, con lectura de metadatos y escritura de Contents. Puede aprovechar `GITHUB_PAT` si no se define esta variable. |
| `PUBLICACION_GITHUB_REPO` | Destino explícito `propietario/repositorio`. No tiene valor predeterminado. |
| `PUBLICACION_GITHUB_BRANCH` | Rama existente de destino. No tiene valor predeterminado. |
| `PUBLICACION_PERMITIR_PUBLICAR` | Omitir o usar `false` para trabajar solo con borradores. Usar exactamente `true` para habilitar solicitudes con `estado: publicado`. |
| `PUBLICACION_SITE_URL` | Origen HTTPS del sitio donde se desplegarán esas notas. En producción: `https://www.diariofederal.com.ar`. |

`VERCEL_ENV` es provista por Vercel. En Preview, el repositorio de destino debe ser privado, incluso cuando se ensaye el estado publicado. Los borradores siempre requieren un repositorio privado, en cualquier entorno. La comprobación se hace consultando GitHub en cada solicitud, antes de escribir; no alcanza con cambiar una etiqueta de configuración.

Para la prueba, configurar únicamente el entorno Preview y apuntar a una copia privada del repositorio y a una rama de prueba. No apuntar la prueba a `Alvarorfontana/diario` ni a `main` del diario. No activar esta ruta en producción hasta validar el flujo en ese entorno.

**Privacidad:** una rama de un repositorio público también es pública. `draft: true` evita que Astro muestre una nota, pero no oculta el archivo dentro de GitHub. La API rechaza ese caso. Una copia privada más una vista previa protegida restringen el acceso; no ofrecen anonimato absoluto frente al proveedor ni frente a colaboradores autorizados.

## Solicitud

Header: `Authorization: Bearer <secreto>` y `Content-Type: application/json`.

```json
{
  "titulo": "Título de la nota",
  "bajada": "Resumen o copete del artículo.",
  "categoria": "Opinión",
  "autor": "Emilio Lahitte",
  "contenido_html": "<p>Cuerpo de la nota.</p>",
  "estado": "borrador",
  "slug": "titulo-de-la-nota",
  "fecha": "2026-10-18",
  "volanta": "Análisis",
  "imagen_url": "https://ejemplo.org/foto.jpg",
  "epigrafe": "Epígrafe y crédito de la fotografía.",
  "etiquetas": ["Política"],
  "fuentes": [{ "titulo": "Documento consultado", "url": "https://ejemplo.org/documento" }]
}
```

- Obligatorios: `titulo`, `bajada`, `categoria`, `autor`, `contenido_html`.
- `estado` por defecto: `borrador`. La publicación requiere `publicado` explícito y la variable habilitante.
- Categorías: Internacional, Argentina, Economía, Deportes, Cultura, Tecnología y Opinión; también sus identificadores sin acentos. Política se guarda en Argentina, la sección existente.
- El slug puede omitirse: se genera a partir del título. Si se proporciona, solo admite letras minúsculas sin acentos, números y guiones.
- Si se omite la fecha, se utiliza la fecha de Argentina. Para reintentos en días diferentes, enviar `fecha` explícita.
- La imagen es opcional: URL HTTPS o archivo ya existente bajo `/uploads/`. Esta ruta no sube imágenes ni comprueba que la imagen remota exista.
- `video_url` opcional: enlace de YouTube con identificador válido; se transforma en una inserción del dominio youtube-nocookie.com. La disponibilidad del video y el permiso de inserción dependen de YouTube.
- La primera versión recibe HTML, no Markdown/MDX. Se conserva HTML editorial permitido y se eliminan scripts, eventos y otras etiquetas o atributos peligrosos. Los iframes enviados en el HTML se eliminan: usar `video_url`.
- Máximo: 1 MiB de JSON, 20 etiquetas y 30 fuentes. Los campos desconocidos se rechazan para detectar errores de escritura.

## Respuestas

Nueva nota: `201 Created`.

```json
{
  "success": true,
  "id": "titulo-de-la-nota",
  "sha": "identificador-del-archivo",
  "estado": "borrador",
  "url": null,
  "repetido": false,
  "publicacion": "borrador_privado",
  "mensaje": "Borrador guardado en el repositorio privado; no se publica en el sitio"
}
```

Para publicado, `url` indica la futura URL y `publicacion` es `pendiente_despliegue`. El `201` confirma el guardado del archivo, **no** que Vercel haya terminado de desplegar ni que la URL ya responda. El proyecto que sirve el diario debe construir desde el repositorio y la rama configurados. Una escritura en otra rama o repositorio no cambia por sí sola el diario.

Si ya existe exactamente el mismo archivo, devuelve `200` con `repetido: true`, sin otro commit. Si el contenido difiere o existe un `.mdx` con el mismo slug, devuelve `409` y no sobrescribe. Esta ruta crea notas; la edición y la promoción de borradores existentes siguen a cargo del panel o de un flujo de revisión separado.

| HTTP | Situación |
| --- | --- |
| 400 | JSON, campos, fecha, categoría, enlaces o slug inválidos |
| 401 | Bearer Token ausente o incorrecto |
| 403 | Se intentó publicar sin habilitar la publicación |
| 405 | Método distinto de POST |
| 409 | Slug ocupado, conflicto de escritura o repositorio público para borrador/prueba |
| 413 | JSON demasiado grande |
| 415 | Content-Type distinto de application/json |
| 503 | Configuración incompleta, credencial de almacenamiento sin acceso o servicio no disponible |

Los errores no incluyen la credencial de GitHub ni los detalles internos de sus respuestas. Las respuestas llevan `Cache-Control: no-store`.

## Script para automatizaciones

Incluido: `scripts/publicar-nota.mjs` y `scripts/nota-api.ejemplo.json`.

Configurar `ARTICULOS_API_URL` con la URL HTTPS real del endpoint desplegado y `ARTICULOS_API_TOKEN` con el mismo secreto del servidor, mediante variables de entorno o GitHub Actions Secrets. El script no acepta el secreto como argumento ni lo imprime.

```sh
node scripts/publicar-nota.mjs scripts/nota-api.ejemplo.json
```

En una Preview protegida, la solicitud necesita además superar la protección de Vercel mediante el mecanismo autorizado correspondiente. El Bearer Token de esta API no sustituye la autenticación de Vercel. No desactivar la protección para probar. El script incluido no añade un bypass de Vercel ni hace reintentos automáticos.

## Validación realizada

- Pruebas automatizadas con almacenamiento simulado: autenticación, configuración, validación, privacidad, HTML, duplicados, conflictos y errores del proveedor.
- Compilación del sitio completo: `npm run build` finalizó correctamente, utilizando la limpieza de archivos antiguos ya prevista por el proyecto. La ejecución directa de `astro build`, que omite esa limpieza, detectó una referencia antigua a Supabase; no se añadió Supabase ni se incluyó ninguna eliminación ajena a esta API.
- El servidor de desarrollo en segundo plano no permaneció activo en este entorno: no se confirmó una llamada HTTP real al endpoint. La prueba de integración en Preview sigue pendiente.
- No se enviaron notas reales a GitHub, no se generaron secretos y no se modificó la producción durante esta implementación local.

Para repetir las comprobaciones:

```sh
node --test tests/publication.test.mjs
npm run build
```

La prueba real contra GitHub y Vercel queda pendiente hasta disponer de un repositorio privado, una credencial limitada y acceso al entorno Preview. No se debe describir la API como activa hasta terminar esa verificación.
