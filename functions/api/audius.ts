// Audius: decentralized, artist-uploaded catalog. Public API, no key required,
// and unlike the CN sources it is reachable from every Cloudflare edge PoP.
const AUDIUS_HOSTS = [
  'https://api.audius.co',
  'https://discoveryprovider.audius.co',
  'https://discoveryprovider2.audius.co',
];

const APP_NAME = 'XQL-MUSIC';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function jsonResponse(data: any): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

async function audiusFetch(path: string): Promise<any | null> {
  for (const host of AUDIUS_HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      continue;
    }
  }
  return null;
}

function pickArtwork(track: any): string {
  const art = track?.artwork || {};
  return art['480x480'] || art['1000x1000'] || art['150x150'] || '';
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const action = url.searchParams.get('action') || 'search';

  if (action === 'search') {
    const keyword = url.searchParams.get('keyword') || '';
    const limit = parseInt(url.searchParams.get('limit') || '12', 10);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    if (!keyword) return jsonResponse({ code: 1, data: [] });

    // Over-fetch: the streamable filter below runs after the upstream call, so
    // asking for exactly `limit` would return short pages (and an empty one when
    // the single hit happens to be non-streamable), which also broke the
    // `length >= limit` test the client uses to decide whether more pages exist.
    const offset = (page - 1) * limit;
    const fetchCount = Math.min(limit * 2 + 5, 100);
    const result = await audiusFetch(
      `/v1/tracks/search?query=${encodeURIComponent(keyword)}` +
        `&app_name=${APP_NAME}&limit=${fetchCount}&offset=${offset}`,
    );
    const list = result?.data;
    if (!Array.isArray(list)) return jsonResponse({ code: 0, data: [], msg: 'Audius search failed' });

    // Non-streamable and token-gated tracks 404 on /stream, so keep them out of the list.
    const playable = list.filter(
      (t: any) => t?.is_streamable !== false && !t?.stream_conditions,
    );

    const data = playable.slice(0, limit).map((t: any) => ({
      id: t.id,
      name: t.title || '',
      artist: t.user?.name || t.user?.handle || '',
      album: t.genre || '',
      pic: pickArtwork(t),
      duration: t.duration || 0,
    }));
    return jsonResponse({ code: 1, data });
  }

  if (action === 'song') {
    const id = url.searchParams.get('id') || '';
    if (!id) return jsonResponse({ code: 0, data: null });

    // The stream endpoint 302s to whichever content node holds the file;
    // hand the stable api.audius.co URL to the player and let audio-proxy follow it.
    const streamUrl = `${AUDIUS_HOSTS[0]}/v1/tracks/${encodeURIComponent(id)}/stream?app_name=${APP_NAME}`;
    const detail = await audiusFetch(`/v1/tracks/${encodeURIComponent(id)}?app_name=${APP_NAME}`);
    const track = detail?.data;

    return jsonResponse({
      code: 1,
      data: {
        url: streamUrl,
        pic: track ? pickArtwork(track) : '',
        lrc: '',
        name: track?.title || '',
        artist: track?.user?.name || '',
        album: track?.genre || '',
      },
    });
  }

  return jsonResponse({ code: 0, msg: 'Invalid action' });
};
