const PROXY_BASES = [
  'https://music-api.gdstudio.xyz/api.php',
  'https://smusic0.pages.dev/api/proxy',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const NETEASE_SEARCH = 'https://music.163.com/api/search/get';
const UPSTREAM_TIMEOUT_MS = 5_000;

// Kuwo and QQ were removed: they still return search hits upstream but no
// longer hand back a playable url, so they only ever produced silent results.
const SOURCE_MAP: Record<string, string> = {
  wy: 'netease',
  jx: 'joox',
};

async function fetchWithTimeout(url: string, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function searchNetEase(keyword: string, page: number, limit: number): Promise<any[] | null> {
  try {
    const endpoint = new URL(NETEASE_SEARCH);
    endpoint.searchParams.set('s', keyword);
    endpoint.searchParams.set('type', '1');
    endpoint.searchParams.set('offset', String((page - 1) * limit));
    endpoint.searchParams.set('limit', String(limit));
    const response = await fetchWithTimeout(endpoint.toString(), {
      'User-Agent': UA,
      Referer: 'https://music.163.com/',
      Accept: 'application/json',
    });
    if (!response.ok) return null;
    const payload: any = await response.json();
    const songs = Array.isArray(payload?.result?.songs) ? payload.result.songs : null;
    if (!songs) return null;
    return songs.map((item: any) => ({
      id: item.id,
      name: item.name || '',
      artist: Array.isArray(item.artists) ? item.artists.map((artist: any) => artist?.name).filter(Boolean).join('/') : '',
      album: item.album?.name || '',
      pic: item.album?.picId || '',
      lyric_id: item.id,
      source: 'netease',
    }));
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const keyword = (url.searchParams.get('keyword') || '').trim().slice(0, 100);
  const type = url.searchParams.get('type') || 'wy';
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(60, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '12', 10)));

  const empty = () =>
    new Response(JSON.stringify({ code: 0, data: [] }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    });

  // A retired source must stay retired: never quietly fall back to another
  // platform's catalogue for a type we no longer serve.
  const source = SOURCE_MAP[type];
  if (!source) return empty();

  // The public NetEase response is currently the fastest reliable search
  // path. GD Studio remains below as a fallback instead of delaying every
  // search behind its browser challenge and intermittent 5xx responses.
  if (source === 'netease') {
    const data = await searchNetEase(keyword, page, limit);
    if (data) {
      return new Response(JSON.stringify({ code: 1, data }), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=120',
        },
      });
    }
  }

  for (const base of PROXY_BASES) {
    try {
      const proxyUrl = new URL(base);
      proxyUrl.searchParams.set('types', 'search');
      proxyUrl.searchParams.set('source', source);
      proxyUrl.searchParams.set('proxy_server', 'gdstudio');
      proxyUrl.searchParams.set('name', keyword);
      proxyUrl.searchParams.set('count', String(limit));
      proxyUrl.searchParams.set('pages', String(page));

      const response = await fetchWithTimeout(proxyUrl.toString(), { 'User-Agent': UA });
      if (!response.ok) continue;

      const raw = (await response.json()) as any[];
      if (!Array.isArray(raw)) continue;

      const data = raw.map((item: any) => ({
        id: item.url_id || item.id,
        name: item.name || '',
        artist: Array.isArray(item.artist) ? item.artist.join('/') : item.artist || '',
        album: item.album || '',
        pic: item.pic_id || item.pic || '',
        lyric_id: item.lyric_id || '',
        source: item.source || source,
      }));

      return new Response(JSON.stringify({ code: 1, data }), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch {
      continue;
    }
  }

  return empty();
};
