import { intParam, MAX_KEYWORD, MAX_PAGE } from '../../shared/params';
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
    const keyword = url.searchParams.get('keyword')?.trim().slice(0, MAX_KEYWORD) || '';
    const limit = intParam(url.searchParams.get('limit'), 12, 1, 60);
    const page = intParam(url.searchParams.get('page'), 1, 1, MAX_PAGE);
    if (!keyword) return jsonResponse({ code: 1, data: [] });

    // The streamable filter runs after the upstream call, so over-fetch, and
    // report how far into the upstream list this page actually read. The
    // client sends that back as offset for the next page, so pages neither
    // overlap nor skip. Without offset, page decides where to start.
    const offset = intParam(url.searchParams.get('offset'), (page - 1) * limit, 0, MAX_PAGE * 60);
    const fetchCount = Math.min(limit * 2 + 5, 100);
    const result = await audiusFetch(
      `/v1/tracks/search?query=${encodeURIComponent(keyword)}` +
        `&app_name=${APP_NAME}&limit=${fetchCount}&offset=${offset}`,
    );
    const list = result?.data;
    if (!Array.isArray(list)) return jsonResponse({ code: 0, data: [], msg: 'Audius search failed' });

    // Non-streamable and token-gated tracks 404 on /stream, so keep them out of the list.
    const picked: any[] = [];
    let read = 0;
    for (const t of list) {
      if (picked.length >= limit) break;
      read++;
      if (t?.is_streamable !== false && !t?.stream_conditions) picked.push(t);
    }

    const data = picked.map((t: any) => ({
      id: t.id,
      name: t.title || '',
      artist: t.user?.name || t.user?.handle || '',
      album: t.genre || '',
      pic: pickArtwork(t),
      duration: t.duration || 0,
    }));
    const hasMore = read < list.length || list.length >= fetchCount;
    return jsonResponse({ code: 1, data, hasMore, nextOffset: offset + read });
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
