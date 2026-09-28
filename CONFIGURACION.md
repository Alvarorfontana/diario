# EL DIARIO — cómo funciona (sin base de datos)

Las **notas** son archivos `.md` en `src/content/articulos/` y las **fotos** subidas desde el panel
van a `public/uploads/`. Todo vive en el repo de GitHub; cada cambio hace que Vercel redespliegue
(≈1 minuto) y la nota aparece publicada. No hay Supabase ni ninguna otra base.

## 1. Variables en Vercel (Settings → Environment Variables → Production)

| Variable | Para qué |
|---|---|
| `ADMIN_PASSWORD` | Contraseña para entrar a `/admin` |
| `GITHUB_PAT` | Token de GitHub con permiso **Contents: Read and write** sobre el repo `Alvarorfontana/diario` |
| `GITHUB_REPO` *(opcional)* | Otro repo, si cambia. Por defecto `Alvarorfontana/diario` |
| `GITHUB_BRANCH` *(opcional)* | Por defecto `main` |

Las variables de Supabase (`SUPABASE_*`) ya no se usan: se pueden borrar. Después de cargar/cambiar variables: **Redeploy**.

## 2. Usar el panel `/admin`

- **Nueva nota**: completá los campos, escribí en el editor y tocá *Guardar Noticia*.
- **Foto**: elegí el archivo en "Foto de la nota"; se sube sola y completa la ruta `/uploads/...`.
- **Borrador**: Estado = Borrador guarda la nota pero no la muestra en el sitio.
- **Editar / Eliminar**: desde la tabla. Las notas viejas escritas en Markdown se abren en el editor visual; al guardarlas quedan en HTML.
- Las notas `.mdx` (solo la de demo del discurso) se editan directo en GitHub.

## 3. Escribir notas a mano (opcional)

Un archivo `src/content/articulos/mi-nota.md` con:

```md
---
title: "Título"
description: "Bajada"
section: "argentina"   # internacional, argentina, economia, deportes, cultura, tecnologia, opinion
pubDate: 2026-09-28
heroImage: "/uploads/mi-foto.jpg"   # o una URL https://...
tags: ["Política"]
---

Texto de la nota…
```

## 4. Desarrollo local

```sh
npm install
ADMIN_PASSWORD=algo GITHUB_PAT=ghp_xxx npm run dev
```
