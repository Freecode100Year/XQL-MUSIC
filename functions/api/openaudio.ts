import { fetchMedia, relayAudio, streamErrorResponse } from '../../shared/stream';
import { intParam, MAX_PAGE } from '../../shared/params';
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
    const page = intParam(requestUrl.searchParams.get('page'), 1, 1, MAX_PAGE);
    const limit = intParam(requestUrl.searchParams.get('limit'), 12, 1, 60);
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
      const hasMore = typeof result.next === 'string' ? Boolean(result.next)
        : Number.isFinite(Number(result.count)) ? page * limit < Number(result.count) : tracks.length >= limit;
      return jsonResponse({ code: 1, data, hasMore });
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
      const openAudioHost = new URL(OPEN_AUDIO).hostname;
      // Open.Audio answers with a redirect to signed storage (Wasabi today);
      // the first address must be Open.Audio's own.
      const response = await fetchMedia(`${OPEN_AUDIO}${track.listen_url}`, headers,
        (next, previous) => previous !== null || next.hostname === openAudioHost);
      const extra: Record<string, string> = {};
      if (action === 'download') {
        const extension = String(track.uploads?.[0]?.extension || 'mp3').replace(/[^a-z0-9]/gi, '') || 'mp3';
        extra['Content-Disposition'] = `attachment; filename="open-audio-${id}.${extension}"`;
      }
      return relayAudio(response, CORS_HEADERS, extra);
    } catch (error) {
      return streamErrorResponse(error, CORS_HEADERS);
    }
  }

  return jsonResponse({ code: 0, data: null, msg: 'Invalid action' });
};
