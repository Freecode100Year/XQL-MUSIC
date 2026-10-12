import { fetchMedia, relayAudio, streamErrorResponse } from '../../shared/stream';
import { intParam, MAX_KEYWORD, MAX_PAGE } from '../../shared/params';
const OPENVERSE = 'https://api.openverse.org/v1/audio/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANONYMOUS_PAGE_SIZE = 20;
const SEARCH_SOURCES = new Set(['jamendo', 'freesound']);
const OPENVERSE_TIMEOUT_MS = 5_000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS, 'Cache-Control': 'public, max-age=300' },
  });
}

function licenseLabel(item: any): string {
  const name = String(item?.license || '').toUpperCase();
  const version = String(item?.license_version || '');
  return name ? `CC ${name}${version ? ` ${version}` : ''}` : 'Creative Commons';
}

async function openverseFetch(path: string): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENVERSE_TIMEOUT_MS);
  try {
    const response = await fetch(`${OPENVERSE}${path}`, {
      headers: { 'User-Agent': 'XQL-MUSIC/2.0 (public CC music player)' },
      signal: controller.signal,
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
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
    const keyword = requestUrl.searchParams.get('keyword')?.trim().slice(0, MAX_KEYWORD) || '';
    const page = intParam(requestUrl.searchParams.get('page'), 1, 1, MAX_PAGE);
    const limit = intParam(requestUrl.searchParams.get('limit'), 12, 1, ANONYMOUS_PAGE_SIZE);
    const source = requestUrl.searchParams.get('source') || '';
    if (!keyword) return jsonResponse({ code: 1, data: [] });
    if (source && !SEARCH_SOURCES.has(source)) {
      return jsonResponse({ code: 0, data: [], msg: 'Invalid Openverse source' });
    }

    // Anonymous callers may request at most 20 tracks. One upstream request
    // per user search keeps this source below its rate-limit threshold.
    const query = new URLSearchParams({ q: keyword, page: String(page), page_size: String(limit) });
    if (source) query.set('source', source);
    const result = await openverseFetch(`?${query.toString()}`);
    const results = Array.isArray(result?.results) ? result.results : [];
    if (!results.length && result === null) {
      return jsonResponse({ code: 0, data: [], msg: 'Openverse search failed' });
    }
    const data = results
      .filter((item: any) => UUID.test(String(item?.id || '')) && item?.url)
      .map((item: any) => ({
        id: item.id,
        name: item.title || 'Untitled',
        artist: item.creator || item.provider || 'Openverse',
        license: licenseLabel(item),
        pic: item.thumbnail || '',
        duration: typeof item.duration === 'number' ? Math.round(item.duration / 1000) : undefined,
        catalogSource: String(item.source || ''),
      }))
      .slice(0, limit);
    // Openverse says how many pages there are; filtering cannot end the list early.
    const pageCount = Number(result?.page_count);
    const hasMore = Number.isFinite(pageCount) ? page < pageCount : results.length >= limit;
    return jsonResponse({ code: 1, data, hasMore });
  }

  const id = requestUrl.searchParams.get('id') || '';
  if (!UUID.test(id)) return jsonResponse({ code: 0, data: null, msg: 'Invalid Openverse track' });

  const track = await openverseFetch(`${encodeURIComponent(id)}/`);
  const audioUrl = String(track?.url || '');
  try {
    const parsed = new URL(audioUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('Invalid protocol');
  } catch {
    return action === 'stream'
      ? new Response('Audio unavailable', { status: 404, headers: CORS_HEADERS })
      : jsonResponse({ code: 0, data: null, msg: 'Openverse audio unavailable' });
  }

  if (action === 'song') {
    // Resolve through this endpoint so only URLs returned by Openverse are ever fetched.
    return jsonResponse({ code: 1, data: { url: `/api/openverse?action=stream&id=${encodeURIComponent(id)}`, pic: track.thumbnail || '', lrc: '' } });
  }

  if (action === 'stream') {
    try {
      const headers: Record<string, string> = { 'User-Agent': 'XQL-MUSIC/2.0 (public CC music player)' };
      const range = context.request.headers.get('Range');
      if (range) headers.Range = range;
      // Openverse indexes files on many hosts (Jamendo, Freesound, Commons...),
      // so any public host may serve the file; only audio is passed on.
      const response = await fetchMedia(audioUrl, headers, () => true);
      return relayAudio(response, CORS_HEADERS);
    } catch (error) {
      return streamErrorResponse(error, CORS_HEADERS);
    }
  }

  return jsonResponse({ code: 0, data: null, msg: 'Invalid action' });
};
