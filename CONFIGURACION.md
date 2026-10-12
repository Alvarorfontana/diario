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

## Datos fuera del repositorio del sitio (recomendado)

Comentarios, suscripciones, publicidad, "minuto a minuto" y fotos del panel pueden vivir en un
repositorio **privado** aparte. Así:

- solo publicar o editar una nota despliega la web (antes también lo hacía cada comentario, cada
  suscripción, cada foto y cada cambio de publicidad: todo eso cuenta en el límite de 100
  despliegues por día del plan gratuito de Vercel);
- los correos de los suscriptores dejan de estar públicos;
- las fotos se ven al instante en `/media/...`, sin esperar un despliegue.

Pasos:
1. GitHub → New repository → `diario-datos` → **Private** → Create.
2. Al token `GITHUB_PAT` (fine-grained) sumarle el repositorio `diario-datos` con **Contents: Read and write**.
3. Vercel → proyecto del diario → Settings → Environment Variables: `DATA_REPO` = `Alvarorfontana/diario-datos`. Redeploy.
4. Abrir `/api/env-check`: `DATA_REPO` tiene que aparecer en verde.

La migración es automática: si un archivo todavía no está en `diario-datos`, se lee el viejo del
sitio y la próxima vez que cambia se guarda en el privado. Después de la primera suscripción o del
primer comentario nuevo se puede borrar `data/subscribers.json` y `data/comments.json` de este
repositorio (siguen en el historial de Git).
