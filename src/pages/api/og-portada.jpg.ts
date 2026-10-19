import type { APIRoute } from 'astro';
import sharp from 'sharp';

export const prerender = false;

export const GET: APIRoute = async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#f8f7f4"/>
    <rect width="1200" height="18" fill="#d32128"/>
    <rect x="72" y="77" width="1056" height="3" fill="#d32128"/>
    <text x="76" y="150" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="bold" letter-spacing="8" fill="#d32128">PERIODISMO INDEPENDIENTE</text>
    <text x="64" y="325" font-family="Georgia,Times New Roman,serif" font-size="119" font-weight="bold" fill="#141414">DIARIO</text>
    <text x="64" y="449" font-family="Georgia,Times New Roman,serif" font-size="119" font-weight="bold" fill="#d32128">FEDERAL</text>
    <rect x="76" y="485" width="1048" height="3" fill="#141414"/>
    <text x="76" y="544" font-family="Arial,Helvetica,sans-serif" font-size="30" fill="#353535">Argentina · Política · Economía · Internacionales</text>
    <rect y="594" width="1200" height="36" fill="#d32128"/>
  </svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  return new Response(jpeg, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
};
