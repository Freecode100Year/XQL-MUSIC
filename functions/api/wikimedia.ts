const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const PLAYABLE_MIMES = /^(audio\/|application\/ogg$)/i;

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

function plainText(value: unknown): string {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function metadataValue(item: any, key: string): string {
  return plainText(item?.imageinfo?.[0]?.extmetadata?.[key]?.value);
}

function toTrack(page: any) {
  const info = page?.imageinfo?.[0];
  const mime = String(info?.mime || '');
  if (!Number.isInteger(page?.pageid) || !PLAYABLE_MIMES.test(mime) || !info?.url) return null;
  const license = metadataValue(page, 'LicenseShortName') || metadataValue(page, 'UsageTerms') || 'Wikimedia Commons';
  return {
    id: String(page.pageid),
    name: String(page.title || 'Untitled').replace(/^File:/i, ''),
    artist: metadataValue(page, 'Artist') || metadataValue(page, 'Author') || 'Wikimedia Commons',
    license,
  };
}

async function commonsFetch(params: URLSearchParams): Promise<any | null> {
  params.set('format', 'json');
  params.set('origin', '*');
  try {
    const response = await fetch(`${COMMONS_API}?${params.toString()}`, {
      headers: { 'User-Agent': 'XQL-MUSIC/2.0 (public CC music player)' },
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const action = url.searchParams.get('action') || 'search';

  if (action === 'search') {
    const keyword = url.searchParams.get('keyword')?.trim() || '';
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(60, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '12', 10)));
    if (!keyword) return jsonResponse({ code: 1, data: [] });

    const params = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: `filetype:audio ${keyword}`, gsrnamespace: '6',
      gsrlimit: String(limit), gsroffset: String((page - 1) * limit), prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
    });
    const result = await commonsFetch(params);
    const pages = Object.values(result?.query?.pages || {}) as any[];
    const data = pages.map(toTrack).filter(Boolean).sort((a: any, b: any) => a.name.localeCompare(b.name));
    return jsonResponse({ code: 1, data });
  }

  if (action === 'song') {
    const id = url.searchParams.get('id') || '';
    if (!/^\d+$/.test(id)) return jsonResponse({ code: 0, data: null, msg: 'Invalid Wikimedia track' });
    const params = new URLSearchParams({ action: 'query', pageids: id, prop: 'imageinfo', iiprop: 'url|mime' });
    const result = await commonsFetch(params);
    const page = Object.values(result?.query?.pages || {})[0] as any;
    const info = page?.imageinfo?.[0];
    const audioUrl = String(info?.url || '');
    try {
      const parsed = new URL(audioUrl);
      if (parsed.hostname !== 'upload.wikimedia.org' || !PLAYABLE_MIMES.test(String(info?.mime || ''))) throw new Error('Invalid audio');
    } catch {
      return jsonResponse({ code: 0, data: null, msg: 'Wikimedia audio unavailable' });
    }
    return jsonResponse({ code: 1, data: { url: audioUrl, lrc: '' } });
  }

  return jsonResponse({ code: 0, data: null, msg: 'Invalid action' });
};
