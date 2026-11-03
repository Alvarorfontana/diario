export const prerender = false;

const API_BASE = 'https://civicapi.org/api/v2';

export async function GET({ url }) {
  const raceId = url.searchParams.get('id');
  const query = url.searchParams.get('query');
  const state = url.searchParams.get('state');
  const params = new URLSearchParams();

  if (raceId) {
    const upstream = await fetch(`${API_BASE}/race/${encodeURIComponent(raceId)}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  params.set('country', 'US');
  params.set('start_date', '2026-11-03');
  params.set('end_date', '2026-11-03');
  params.set('limit', '5000');
  if (query) params.set('query', query);
  if (state) params.set('province', state);

  const upstream = await fetch(`${API_BASE}/race/search?${params.toString()}`, {
    headers: { accept: 'application/json' },
    cache: 'no-store'
  });
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
