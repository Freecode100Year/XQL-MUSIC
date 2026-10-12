import { intParam, MAX_KEYWORD, MAX_PAGE } from '../../shared/params';
const ARCHIVE = 'https://archive.org';

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

function escapeLucenePhrase(value: string): string {
  return value.replace(/[+\-!(){}\[\]^"~*?:\\/]|&&|\|\|/g, '\\$&');
}

function licenseLabel(licenseUrl: string): string {
  const match = licenseUrl.match(/creativecommons\.org\/licenses\/([^/]+)\/([\d.]+)/i);
  return match ? `CC ${match[1].toUpperCase()} ${match[2]}` : 'Creative Commons';
}

function preferredAudioFile(files: any[]): string {
  const playable = files.filter((file) => {
    const name = String(file?.name || '');
    const format = String(file?.format || '');
    return !file?.private && /\.(mp3|m4a|ogg|opus|wav)$/i.test(name) && /mp3|ogg|opus|wav|m4a|mpeg/i.test(format);
  });
  playable.sort((a, b) => {
    const score = (file: any) => /\.mp3$/i.test(String(file.name)) ? 0 : 1;
    return score(a) - score(b);
  });
  return playable[0]?.name || '';
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const action = url.searchParams.get('action') || 'search';

  if (action === 'search') {
    const keyword = url.searchParams.get('keyword')?.trim().slice(0, MAX_KEYWORD) || '';
    const page = intParam(url.searchParams.get('page'), 1, 1, MAX_PAGE);
    const limit = intParam(url.searchParams.get('limit'), 12, 1, 60);
    if (!keyword) return jsonResponse({ code: 1, data: [] });

    const phrase = escapeLucenePhrase(keyword);
    const query = `collection:netlabels AND mediatype:audio AND (title:"${phrase}" OR creator:"${phrase}")`;
    const endpoint = new URL(`${ARCHIVE}/advancedsearch.php`);
    endpoint.searchParams.set('q', query);
    endpoint.searchParams.append('fl[]', 'identifier');
    endpoint.searchParams.append('fl[]', 'title');
    endpoint.searchParams.append('fl[]', 'creator');
    endpoint.searchParams.append('fl[]', 'licenseurl');
    endpoint.searchParams.set('rows', String(limit));
    endpoint.searchParams.set('page', String(page));
    endpoint.searchParams.set('output', 'json');

    try {
      const response = await fetch(endpoint.toString());
      const result: any = response.ok ? await response.json() : null;
      const docs = Array.isArray(result?.response?.docs) ? result.response.docs : [];
      const data = docs
        .filter((item: any) => item.identifier && /^https?:\/\/creativecommons\.org\/licenses\//i.test(item.licenseurl || ''))
        .map((item: any) => ({
          id: item.identifier,
          name: item.title || item.identifier,
          artist: Array.isArray(item.creator) ? item.creator.join(' / ') : item.creator || 'Internet Archive',
          license: licenseLabel(item.licenseurl),
          pic: `${ARCHIVE}/services/img/${encodeURIComponent(item.identifier)}`,
        }));
      // numFound counts matches before the licence filter, so a page thinned
      // by the filter does not end the list.
      const found = Number(result?.response?.numFound);
      const hasMore = Number.isFinite(found) ? page * limit < found : docs.length >= limit;
      return jsonResponse({ code: 1, data, hasMore });
    } catch {
      return jsonResponse({ code: 0, data: [], msg: 'Internet Archive search failed' });
    }
  }

  if (action === 'song') {
    const id = url.searchParams.get('id') || '';
    if (!/^[A-Za-z0-9._-]+$/.test(id)) {
      return jsonResponse({ code: 0, data: null, msg: 'Invalid archive item' });
    }

    try {
      const response = await fetch(`${ARCHIVE}/metadata/${encodeURIComponent(id)}`);
      const item: any = response.ok ? await response.json() : null;
      if (item?.metadata?.['access-restricted'] === 'true') {
        return jsonResponse({ code: 0, data: null, msg: 'Restricted archive item' });
      }
      const filename = preferredAudioFile(Array.isArray(item?.files) ? item.files : []);
      const audioUrl = filename
        ? `${ARCHIVE}/download/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`
        : '';
      return jsonResponse({ code: audioUrl ? 1 : 0, data: audioUrl ? { url: audioUrl, lrc: '' } : null });
    } catch {
      return jsonResponse({ code: 0, data: null, msg: 'Internet Archive item failed' });
    }
  }

  return jsonResponse({ code: 0, data: null, msg: 'Invalid action' });
};
