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
  
  let imageUrl: string | null = null;
  if (typeof heroImage === 'object' && heroImage?.src) {
    imageUrl = heroImage.src;
  } else if (typeof heroImage === 'string' && heroImage.length > 0) {
    imageUrl = heroImage.startsWith('http') ? heroImage : `https://www.diariofederal.com.ar${heroImage}`;
  }

  const tituloCorto = title.length > 85 ? title.slice(0, 82) + '…' : title;

  const markup = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#f6efdf' } },
    imageUrl && h('img', {
      src: imageUrl,
      style: { width: '100%', height: '62%', objectFit: 'cover' },
    }),
    h(
      'div',
      {
        style: {
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#f6efdf', height: '38%', padding: '44px 52px',
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
