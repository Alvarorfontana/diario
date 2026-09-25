// src/pages/og/[slug].png.ts
//
// Endpoint que genera la imagen Open Graph (1200x630) de cada artículo.
// Se prerenderiza en el build: NO requiere serverless functions ni vercel.json.
//
// Requisitos:
//   npm i @vercel/og react
//
// IMPORTANTES:
//   - El archivo DEBE llamarse [slug].png.ts (doble extensión) para que la
//     ruta quede /og/[slug].png. Si se llama [slug].ts, la ruta es /og/[slug]
//     y /og/[slug].png da 404.
//   - Ajustá 'imagen' y 'title' al nombre real de los campos de tu colección
//     (ver console.log de más abajo si no estás seguro).
//   - Ajustá el glob de imágenes a la carpeta real donde Keystatic guarda
//     las fotos de los artículos.

import { getCollection } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const prerender = true;

// Todas las imágenes de los artículos, con .fsPath (ruta absoluta en el disco
// del build). Esto nos permite leer el archivo e incrustarlo como data URI,
// sin depender de que la imagen esté publicada en producción.
const imagenes = import.meta.glob<{ default: ImageMetadata }>(
  '/src/content/articulos/**/*.{jpg,jpeg,png,webp}',
  { eager: true }
);

async function resolverImagen(imagen: string): Promise<string | null> {
  // Caso 1: imagen remota (https://...) → se usa directo
  if (/^https?:\/\//.test(imagen)) return imagen;

  // Caso 2: imagen local de Keystatic (p. ej. "./foto.jpg") → la leemos del
  // disco del build y la incrustamos como data URI (Satori no acepta rutas
  // relativas y falla en silencio si no puede resolver el src).
  const base = path.basename(imagen.replace(/^\.\//, ''));

  const meta = Object.values(imagenes)
    .map((m) => m.default)
    .find((m) => m.fsPath?.endsWith('/' + base));

  if (meta) {
    const buf = await readFile(meta.fsPath);
    const ext = path.extname(meta.fsPath).slice(1).toLowerCase();
    const mime =
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' :
      ext === 'gif' ? 'image/gif' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  }
  return null;
}

export async function getStaticPaths() {
  const articulos = await getCollection('articulos');
  return articulos.map((a) => ({ params: { slug: a.slug } }));
}

export async function GET({ params }: { params: { slug: string } }) {
  const articulos = await getCollection('articulos');
  const art = articulos.find((a) => a.slug === params.slug);
  if (!art) return new Response('No encontrado', { status: 404 });

  // Debug (opcional): descomentar para ver los campos disponibles en build
  // console.log('Campos del artículo:', Object.keys(art.data));

  // ⚠️ AJUSTAR: nombre real del campo de la foto de portada en Keystatic
  const campoImagen = 'imagen' as const;
  const valorImagen = (art.data as Record<string, unknown>)[campoImagen];
  if (typeof valorImagen !== 'string') {
    return new Response(`El campo "${campoImagen}" no existe o no es string`, { status: 404 });
  }

  const src = await resolverImagen(valorImagen);
  if (!src) return new Response('Sin imagen', { status: 404 });

  const markup = h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#f5f0e6',
        fontFamily: 'sans-serif',
      },
    },
    h('img', {
      src,
      style: { width: '100%', height: '62%', objectFit: 'cover' },
    }),
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f5f0e6',
          height: '38%',
          padding: '44px 52px',
        },
      },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
        h('div', {
          style: {
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: '#d21f26',
          },
        }),
        h(
          'span',
          {
            style: {
              fontSize: '26px',
              letterSpacing: '5px',
              fontWeight: 600,
              color: '#1a1a1a',
            },
          },
          'NOTA'
        )
      ),
      h(
        'span',
        {
          style: {
            fontSize: '52px',
            fontWeight: 700,
            lineHeight: 1.15,
            marginTop: '22px',
            color: '#1a1a1a',
          },
        },
        // ⚠️ AJUSTAR: nombre real del campo del título en Keystatic
        (art.data as Record<string, unknown>).title as string
      ),
      h(
        'span',
        {
          style: {
            fontSize: '28px',
            marginTop: 'auto',
            fontWeight: 600,
            color: '#1a1a1a',
          },
        },
        'EL DIARIO.'
      )
    )
  );

  const img = new ImageResponse(markup, { width: 1200, height: 630 });
  const buf = await img.arrayBuffer();

  return new Response(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
