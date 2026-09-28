# Configuración del CMS Supabase

## 1. Supabase
Abra SQL Editor y ejecute `supabase/setup.sql` una sola vez.

## 2. Vercel > Settings > Environment Variables (Production)
- `SUPABASE_PROJECT_URL`: URL real del proyecto, por ejemplo `https://xxxxx.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY`: clave que empieza por `sb_publishable_...`
- `SUPABASE_SECRET_KEY`: clave que empieza por `sb_secret_...` (solo servidor; nunca ponerla en código ni compartirla)
- `ADMIN_PASSWORD`: contraseña del panel `/admin`

Después haga un Redeploy.

## 3. Editor
El panel `/admin` guarda directamente en la tabla `articles`. El texto admite párrafos, negrita, cursiva, H2/H3, listas, citas, enlaces y destacados editoriales.
