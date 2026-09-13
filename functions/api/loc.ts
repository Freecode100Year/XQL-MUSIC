const LOC = 'https://www.loc.gov';
const PUBLIC_DOMAIN_END_YEAR = 1922;
const ITEM_ID = /^jukebox-\d+$/;

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

function itemId(value: unknown): string {
  const match = String(value || '').match(/\/item\/(jukebox-\d+)/i);
  return match?.[1] || '';
}

function itemYear(item: any): number {
  const match = String(item?.date || item?.item?.recording_date || '').match(/^(\d{4})/);
  return match ? Number(match[1]) : 0;
}

function isPublicDomainAudio(item: any): boolean {
  const year = itemYear(item);
  const formats = Array.isArray(item?.online_format) ? item.online_format : [];
  return item?.access_restricted !== true && year >= 1900 && year <= PUBLIC_DOMAIN_END_YEAR && formats.includes('audio');
}

function mediaUrl(item: any): string {
  const resources = Array.isArray(item?.resources) ? item.resources : [];
  const candidate = resources.map((resource: any) => String(resource?.audio || resource?.media || '')).find(Boolean) || '';
  try {
    const parsed = new URL(candidate);
    return parsed.hostname === 'tile.loc.gov' && parsed.pathname.startsWith('/streaming-services/') ? candidate : '';
  } catch {
    return '';
  }
}

function coverUrl(item: any): string {
  const images = Array.isArray(item?.image_url) ? item.image_url : [];
  const resources = Array.isArray(item?.resources) ? item.resources : [];
  return String(images[0] || resources.map((resource: any) => resource?.image).find(Boolean) || '');
}

function artistName(item: any): string {
  const primary = Array.isArray(item?.contributor_primary) ? item.contributor_primary : [];
  const contributors = Array.isArray(item?.contributor) ? item.contributor : [];
  return String(primary[0] || contributors[0] || 'Library of Congress');
}

async function getItem(id: string): Promise<any | null> {
  if (!ITEM_ID.test(id)) return null;
  try {
    const response = await fetch(`${LOC}/item/${encodeURIComponent(id)}/?fo=json`, {
      headers: { Accept: 'application/json', 'User-Agent': 'lesou-music/1.0 (public-domain audio player)' },
    });
    const result: any = response.ok ? await response.json() : null;
    const item = result?.item ? { ...result.item, resources: result.resources || result.item.resources } : null;
    return item && isPublicDomainAudio(item) && mediaUrl(item) ? item : null;
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

    const endpoint = new URL(`${LOC}/collections/national-jukebox/`);
    endpoint.searchParams.set('fo', 'json');
    endpoint.searchParams.set('at', 'results');
    endpoint.searchParams.set('q', keyword);
    endpoint.searchParams.set('c', String(limit));
    endpoint.searchParams.set('sp', String(page));
    endpoint.searchParams.set('dates', `1900/${PUBLIC_DOMAIN_END_YEAR}`);

    try {
      const response = await fetch(endpoint.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'lesou-music/1.0 (public-domain audio player)' },
      });
      const result: any = response.ok ? await response.json() : null;
      if (!result) return jsonResponse({ code: 0, data: [], msg: 'Library of Congress search failed' });
      const items = Array.isArray(result.results) ? result.results : [];
      const data = items.filter((item: any) => isPublicDomainAudio(item) && itemId(item.id) && mediaUrl(item)).map((item: any) => ({
        id: itemId(item.id),
        name: item.title || 'Untitled',
        artist: artistName(item),
        album: `Public Domain · ${itemYear(item)}`,
        license: 'Public Domain (US)',
        pic: coverUrl(item),
      }));
      return jsonResponse({ code: 1, data });
    } catch {
      return jsonResponse({ code: 0, data: [], msg: 'Library of Congress search failed' });
    }
  }

  const id = requestUrl.searchParams.get('id') || '';
  const item = await getItem(id);
  if (!item) return jsonResponse({ code: 0, data: null, msg: 'Library of Congress track unavailable' });

  if (action === 'song') {
    return jsonResponse({
      code: 1,
      data: {
        url: `/api/loc?action=stream&id=${encodeURIComponent(id)}`,
        download: `/api/loc?action=download&id=${encodeURIComponent(id)}`,
        pic: coverUrl(item),
        lrc: '',
      },
    });
  }

  if (action === 'stream' || action === 'download') {
    try {
      const headers: Record<string, string> = { 'User-Agent': 'lesou-music/1.0 (public-domain audio player)' };
      const range = context.request.headers.get('Range');
      if (range) headers.Range = range;
      const response = await fetch(mediaUrl(item), { headers, redirect: 'follow' });
      const responseHeaders = new Headers(CORS_HEADERS);
      for (const key of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
        const value = response.headers.get(key);
        if (value) responseHeaders.set(key, value);
      }
      if (!responseHeaders.has('Content-Type')) responseHeaders.set('Content-Type', 'audio/mpeg');
      responseHeaders.set('Cache-Control', 'public, max-age=3600');
      if (action === 'download') responseHeaders.set('Content-Disposition', `attachment; filename="loc-${id}.mp3"`);
      return new Response(response.body, { status: response.status, headers: responseHeaders });
    } catch {
      return new Response('Library of Congress stream failed', { status: 502, headers: CORS_HEADERS });
    }
  }

  return jsonResponse({ code: 0, data: null, msg: 'Invalid action' });
};
