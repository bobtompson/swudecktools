import type { APIRoute } from 'astro';

// Same-origin reverse proxy for the two SWUDB upstreams (they send no CORS
// headers, so the browser can't call them directly). Runs as a Cloudflare Pages
// Function in production and in-process under `astro dev`.
export const prerender = false;

// Strict whitelist. Only these two shapes are forwarded.
function resolveUpstream(path: string): string | null {
  // /swudb/deck/{id}  ->  https://www.swudb.com/api/deck/{id}
  const deck = path.match(/^swudb\/deck\/([A-Za-z0-9_-]+)$/);
  if (deck) return `https://www.swudb.com/api/deck/${deck[1]}`;

  // /swudb/sets       ->  https://api.swu-db.com/sets
  if (path === 'swudb/sets') return 'https://api.swu-db.com/sets';

  return null;
}

export const GET: APIRoute = async ({ params }) => {
  const path = params.path ?? '';
  const upstream = resolveUpstream(path);
  if (!upstream) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  let res: Response;
  try {
    res = await fetch(upstream, {
      headers: { accept: 'application/json', 'user-agent': 'swu-deck-tools/0.1' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Upstream request failed' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': 'public, max-age=300',
    },
  });
};
