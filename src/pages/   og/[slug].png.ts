// src/pages/og/[slug].png.ts
// Genera la imagen Open Graph (1200x630) de cada articulo, en el build.
// Requisitos: npm i @vercel/og react
// IMPORTANTE: el archivo DEBE llamarse [slug].png.ts para que la ruta
// quede /og/[slug].png

import { getCollection } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const prerender = true;

// Red de seguridad: por si algun articulo viejo tuviera la foto como
// archivo local en vez de link. Con heroImage como URL no se usa.
const imagenes = import.meta.glob<{ default: ImageMetadata }>(
  '/src/content/articulos/**/*.{jpg,jpeg,png,webp}',
  { eager: true }
);

async function resolverImagen(imagen: string): Promise<string | null> {
  // Caso actual: link de internet (Unsplash, etc.) -> se usa directo
  if (/^https?:\/\//.test(imagen)) return imagen;

  // Caso alternativo: archivo local -> se lee del disco y se incrusta
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

  // La foto de portada: campo "heroImage" del frontmatter
  const valorImagen = (art.data as Record<string, unknown>).heroImage;
  if (typeof valorImagen !== 'string') {
    return new Response('El articulo no tiene heroImage', { status: 404 });
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
