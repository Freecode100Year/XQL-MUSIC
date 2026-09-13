const OPEN_AUDIO = 'https://open.audio';
const CC0_LICENSE = 'cc0-1.0';
const TRACK_ID = /^\d+$/;
const LISTEN_PATH = /^\/api\/v2\/listen\/[0-9a-f-]{36}\/$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition',
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS, 'Cache-Control': 'public, max-age=300' },
  });
}

function coverUrl(track: any): string {
  const urls = track?.cover?.urls;
  return String(urls?.medium_square_crop || urls?.original || urls?.source || '');
}

function artistName(track: any): string {
  const credits = Array.isArray(track?.artist_credit) ? track.artist_credit : [];
  return credits
    .map((credit: any) => `${String(credit?.credit || '').trim()}${String(credit?.joinphrase || '')}`)
    .filter(Boolean)
    .join('') || 'Open.Audio';
}

function isCc0Music(track: any): boolean {
  return track?.license === CC0_LICENSE && track?.content_category === 'music' && track?.is_playable === true;
}

async function getTrack(id: string): Promise<any | null> {
  if (!TRACK_ID.test(id)) return null;
  try {
    const response = await fetch(`${OPEN_AUDIO}/api/v2/tracks/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'XQL-MUSIC/2.0 (CC0 music player)' },
    });
    const track: any = response.ok ? await response.json() : null;
    return isCc0Music(track) && LISTEN_PATH.test(String(track?.listen_url || '')) ? track : null;
  } catch {
    return null;
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, {
  status: 204,
  headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' },
});

export const onRequestGet: PagesFunction = async (context) => {
  const requestUrl = new URL(context.request.url);
  const action = requestUrl.searchParams.get('action') || 'search';

  if (action === 'search') {
    const keyword = requestUrl.searchParams.get('keyword')?.trim().slice(0, 100) || '';
    const page = Math.max(1, Number.parseInt(requestUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(60, Math.max(1, Number.parseInt(requestUrl.searchParams.get('limit') || '12', 10)));
    if (!keyword) return jsonResponse({ code: 1, data: [] });

    const endpoint = new URL(`${OPEN_AUDIO}/api/v2/tracks`);
    endpoint.searchParams.set('q', keyword);
    endpoint.searchParams.set('page', String(page));
    endpoint.searchParams.set('page_size', String(limit));
    endpoint.searchParams.set('license', CC0_LICENSE);

    try {
      const response = await fetch(endpoint.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'lesou-music/1.0 (CC0 music player)' },
      });
      const result: any = response.ok ? await response.json() : null;
      if (!result) return jsonResponse({ code: 0, data: [], msg: 'Open.Audio search failed' });
      const tracks = Array.isArray(result.results) ? result.results : [];
      const data = tracks.filter(isCc0Music).map((track: any) => ({
        id: String(track.id),
        name: track.title || 'Untitled',
        artist: artistName(track),
        album: track.album?.title || 'CC0 1.0',
        license: 'CC0 1.0',
        pic: coverUrl(track),
        duration: Number(track.uploads?.[0]?.duration) || undefined,
      }));
      return jsonResponse({ code: 1, data });
    } catch {
      return jsonResponse({ code: 0, data: [], msg: 'Open.Audio search failed' });
    }
  }

  const id = requestUrl.searchParams.get('id') || '';
  const track = await getTrack(id);
  if (!track) return jsonResponse({ code: 0, data: null, msg: 'Open.Audio track unavailable' });

  if (action === 'song') {
    return jsonResponse({
      code: 1,
      data: {
        url: `/api/openaudio?action=stream&id=${encodeURIComponent(id)}`,
        download: `/api/openaudio?action=download&id=${encodeURIComponent(id)}`,
        pic: coverUrl(track),
        lrc: '',
      },
    });
  }

  if (action === 'stream' || action === 'download') {
    try {
      const headers: Record<string, string> = { 'User-Agent': 'XQL-MUSIC/2.0 (CC0 music player)' };
      const range = context.request.headers.get('Range');
      if (range) headers.Range = range;
      const response = await fetch(`${OPEN_AUDIO}${track.listen_url}`, { headers, redirect: 'follow' });
      const responseHeaders = new Headers(CORS_HEADERS);
      for (const key of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
        const value = response.headers.get(key);
        if (value) responseHeaders.set(key, value);
      }
      if (!responseHeaders.has('Content-Type')) responseHeaders.set('Content-Type', 'audio/mpeg');
      responseHeaders.set('Cache-Control', 'public, max-age=3600');
      if (action === 'download') {
        const extension = String(track.uploads?.[0]?.extension || 'mp3').replace(/[^a-z0-9]/gi, '') || 'mp3';
        responseHeaders.set('Content-Disposition', `attachment; filename="open-audio-${id}.${extension}"`);
      }
      return new Response(response.body, { status: response.status, headers: responseHeaders });
    } catch {
      return new Response('Open.Audio stream failed', { status: 502, headers: CORS_HEADERS });
    }
  }

  return jsonResponse({ code: 0, data: null, msg: 'Invalid action' });
};
