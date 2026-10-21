# Newsletter de Diario Federal (Brevo)

El recuadro «Las noticias en tu correo» de la portada ya está conectado a **Brevo**. El lector
deja su correo, acepta la política de privacidad y **Brevo le manda un correo para confirmar**
(doble confirmación). Recién al confirmar queda en la lista. También hay una página de baja.

Todavía falta hacer la configuración de Brevo y cargar las claves en Vercel: hasta entonces el
formulario responde «El boletín todavía no está configurado».

## Cómo funciona
1. La portada muestra `NewsletterBox.astro`, que hace `POST /api/newsletter/subscribe`.
2. La API llama a Brevo:
   - con plantilla DOI → `POST /v3/contacts/doubleOptinConfirmation` (envía el correo de confirmación);
   - sin plantilla DOI → `POST /v3/contacts` (alta directa, *sin* confirmación).
3. Al confirmar, Brevo redirige a `/newsletter/confirmado/`.
4. La baja (`/newsletter/baja/`) llama a `POST /api/newsletter/unsubscribe`, que marca el correo
   como bloqueado y lo saca de la lista.
5. No se guardan correos en el repositorio.

## Configuración en Brevo (una sola vez)
1. Crear cuenta en <https://www.brevo.com> y entrar a **Contacts > Lists**: crear una lista
   (por ejemplo «Boletín Diario Federal»). Anotar su **ID** (`BREVO_LIST_ID`).
2. **Autenticar el dominio** `diariofederal.com.ar` en **Senders & Domains > Domains**: Brevo da
   registros DNS (SPF, DKIM, DMARC) que hay que cargar en el proveedor del dominio. Sin esto, los
   correos llegan a spam o se rechazan.
3. Verificar el remitente `boletin@diariofederal.com.ar`.
4. Crear la **plantilla de doble confirmación** en **Contacts > Templates**: un correo breve
   («Confirmá tu suscripción») cuyo botón/enlace use `{{ doubleoptin }}` (o `{{ params.DOIurl }}`
   si se quiere usar la URL de redirección que manda la API). Marcarla como plantilla DOI.
   Anotar su **ID** (`BREVO_DOI_TEMPLATE_ID`).
5. **API key**: **Settings > SMTP & API > API Keys**. Crear una y copiarla (`BREVO_API_KEY`).

## Variables en Vercel
En **Project > Settings > Environment Variables** (Production, y Preview si se quiere probar):

| Variable | Obligatoria | Para qué |
| --- | --- | --- |
| `BREVO_API_KEY` | sí | Autenticación con Brevo |
| `BREVO_LIST_ID` | sí | Lista donde caen los suscriptores |
| `BREVO_DOI_TEMPLATE_ID` | sí (para doble confirmación) | Plantilla que envía el correo de confirmación |
| `BREVO_REDIRECT_URL` | no | A dónde va el lector al confirmar (`https://www.diariofederal.com.ar/newsletter/confirmado/`) |
| `BREVO_SENDER_EMAIL` | no | Remitente verificado |
| `BREVO_SENDER_NAME` | no | Nombre del remitente |

Después de cargarlas hay que **redeployar** para que tomen efecto.

## Enviar el boletín
Por ahora el envío se prepara y programa **desde el panel de Brevo** (Campaigns > Email): elegir
la lista, armar el correo con la plantilla del diario y programar el envío. Brevo agrega solo el
enlace de baja en cada envío. Una etapa siguiente puede ser un panel propio para elegir las notas
del día y disparar el envío por API.

## Archivos
- `src/lib/brevo.ts` — configuración y llamadas a la API de Brevo.
- `src/pages/api/newsletter/subscribe.ts` — alta.
- `src/pages/api/newsletter/unsubscribe.ts` — baja.
- `src/components/NewsletterBox.astro` — formulario de portada (consentimiento + anti-bot).
- `src/pages/newsletter/confirmado.astro` — página al confirmar.
- `src/pages/newsletter/baja.astro` — página de baja.
- `.env.example` — variables de entorno.

## Boletines temáticos (Mesa Política, Pulso Federal, Agenda Económica)
Además del boletín general, el formulario ofrece boletines temáticos. Cada uno es una lista
aparte en Brevo:
1. En **Contacts > Lists**, crear una lista por boletín y anotar su ID.
2. En Vercel, cargar las variables que correspondan y redeployar:
   - `BREVO_LIST_MESA_POLITICA`
   - `BREVO_LIST_PULSO_FEDERAL`
   - `BREVO_LIST_AGENDA_ECONOMICA`
3. Solo aparecen en el formulario los boletines que tienen su variable cargada. El lector
   siempre queda en la lista general y, además, en los temáticos que marque.
4. Para enviar uno, en **Campaigns** se elige como destinatario la lista de ese boletín.
