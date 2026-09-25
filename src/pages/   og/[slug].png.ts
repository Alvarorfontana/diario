import { getCollection } from 'astro:content';
import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';

export const prerender = true;

export async function getStaticPaths() {
  const articulos = await getCollection('articulos');
  return articulos.map((a) => ({ params: { slug: a.id } }));
}

export async function GET({ params }: { params: { slug: string } }) {
  const articulos = await getCollection('articulos');
  const art = articulos.find((a) => a.id === params.slug);
  if (!art) return new Response('No encontrado', { status: 404 });

  const { title, heroImage } = art.data;
  
  // Construir URL absoluta SIEMPRE
  let imageUrl: string | null = null;
  if (heroImage) {
    const imagePath = typeof heroImage === 'object' ? heroImage.src : heroImage;
    if (imagePath) {
      // Si ya es URL absoluta (empieza con http), usarla tal cual
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        imageUrl = imagePath;
      } 
      // Si es ruta relativa (empieza con /), construir URL absoluta
      else if (imagePath.startsWith('/')) {
        imageUrl = `https://www.diariofederal.com.ar${imagePath}`;
      }
      // Si es ruta relativa sin /, agregar el prefijo
      else {
        imageUrl = `https://www.diariofederal.com.ar/${imagePath}`;
      }
    }
  }

  const tituloCorto = title.length > 85 ? title.slice(0, 82) + '…' : title;

  const markup = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#f6efdf' } },
    imageUrl ? h('img', {
      src: imageUrl,
      style: { width: '100%', height: '62%', objectFit: 'cover' },
    }) : null,
    h(
      'div',
      {
        style: {
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#f6efdf', height: imageUrl ? '38%' : '100%', padding: '44px 52px',
          justifyContent: 'center', gap: '14px',
        },
      },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
        h('div', { style: { width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#e93323' } }),
        h('span', { style: { fontSize: '26px', letterSpacing: '5px', fontWeight: 600, color: '#e93323', textTransform: 'uppercase', fontFamily: 'sans-serif' } }, 'NOTA')
      ),
      h('span', { style: { fontSize: '52px', fontWeight: 700, lineHeight: 1.15, color: '#1a1712', fontFamily: 'serif' } }, tituloCorto),
      h('span', { style: { fontSize: '28px', marginTop: 'auto', fontWeight: 600, color: '#6b6255', fontFamily: 'serif' } }, 'EL DIARIO.')
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
