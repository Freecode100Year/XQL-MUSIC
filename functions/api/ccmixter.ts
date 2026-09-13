const CCMIXTER_POOL = 'https://ccmixter.org/api/pool';

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function tagValue(item: string, tag: string): string {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function attribute(item: string, tag: string, name: string): string {
  const match = item.match(new RegExp(`<${tag}\\b[^>]*\\b${name}="([^"]*)"`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function licenseLabel(licenseUrl: string): string {
  const match = licenseUrl.match(/creativecommons\.org\/licenses\/([^/]+)\/([\d.]+)/i);
  return match ? `CC ${match[1].toUpperCase()} ${match[2]}` : 'Creative Commons';
}

function parseItems(xml: string) {
  const matches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return matches.map((item) => ({
    id: tagValue(item, 'guid'),
    name: tagValue(item, 'title'),
    artist: tagValue(item, 'dc:creator'),
    license: licenseLabel(tagValue(item, 'cc:license')),
    pic: attribute(item, 'media:thumbnail', 'url'),
    url: attribute(item, 'enclosure', 'url'),
    mime: attribute(item, 'enclosure', 'type'),
  })).filter((item) => item.id && item.url && /^audio\//i.test(item.mime));
}

async function poolFetch(path: string): Promise<string | null> {
  try {
    const response = await fetch(`${CCMIXTER_POOL}${path}`, {
      headers: { 'User-Agent': 'XQL-MUSIC/2.0 (public CC music player)' },
    });
    return response.ok ? await response.text() : null;
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

    const offset = (page - 1) * limit;
    const xml = await poolFetch(
      `/search?query=${encodeURIComponent(keyword)}&type=any&limit=${limit}&offset=${offset}`,
    );
    if (!xml) return jsonResponse({ code: 0, data: [], msg: 'ccMixter search failed' });
    return jsonResponse({ code: 1, data: parseItems(xml) });
  }

  if (action === 'song') {
    const id = url.searchParams.get('id') || '';
    if (!id.startsWith('https://ccmixter.org/files/')) {
      return jsonResponse({ code: 0, data: null, msg: 'Invalid ccMixter track' });
    }

    const xml = await poolFetch(`/file?guid=${encodeURIComponent(id)}`);
    const track = xml ? parseItems(xml)[0] : undefined;
    return jsonResponse({
      code: track?.url ? 1 : 0,
      data: track ? { url: track.url, pic: track.pic, lrc: '' } : null,
    });
  }

  return jsonResponse({ code: 0, data: null, msg: 'Invalid action' });
};
