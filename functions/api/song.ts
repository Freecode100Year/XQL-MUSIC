const PROXY_BASES = [
  'https://music-api.gdstudio.xyz/api.php',
  'https://smusic0.pages.dev/api/proxy',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SOURCE_MAP: Record<string, string> = {
  wy: 'netease',
  jx: 'joox',
  netease: 'netease',
  joox: 'joox',
};

// Every source here serves its own audio; a track missing from one is
// re-looked-up on the other rather than silently failing.
const PLAYABLE_SOURCES = ['netease', 'joox'];

async function gdFetch(params: Record<string, string>): Promise<any | null> {
  for (const base of PROXY_BASES) {
    try {
      const u = new URL(base);
      for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
      u.searchParams.set('proxy_server', 'gdstudio');
      const res = await fetch(u.toString(), { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        continue;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/[\s（）()【】\[\]·・'"’”,，.。!！?？-]/g, '');
}

// Cross-source rescue: an occasional track is missing a url on its own source,
// so re-find it on the sibling source that still serves audio.
async function rescueByName(
  name: string,
  artist: string,
  exclude: string,
  includeMetadata = true,
): Promise<{ url: string; pic: string; lrc: string } | null> {
  const target = normalize(name);
  if (!target) return null;

  for (const src of PLAYABLE_SOURCES) {
    if (src === exclude) continue;
    const list = await gdFetch({
      types: 'search',
      source: src,
      name: `${name} ${artist}`.trim(),
      count: '10',
      pages: '1',
    });
    if (!Array.isArray(list)) continue;

    const candidates = list.filter((it: any) => {
      const n = normalize(it.name || '');
      return n === target || n.includes(target) || target.includes(n);
    });
    const ordered = candidates.length ? candidates : list.slice(0, 3);

    for (const item of ordered.slice(0, 4)) {
      const id = String(item.url_id || item.id || '');
      if (!id) continue;
      const urlData = await gdFetch({ types: 'url', source: src, id, br: '320' });
      const found = urlData?.url;
      if (!found) continue;

      if (!includeMetadata) return { url: found, pic: '', lrc: '' };

      const [picData, lrcData] = await Promise.all([
        gdFetch({ types: 'pic', source: src, id: String(item.pic_id || id), size: '300' }),
        gdFetch({ types: 'lyric', source: src, id: String(item.lyric_id || id) }),
      ]);
      return {
        url: found,
        pic: picData?.url || '',
        lrc: lrcData?.lyric || '',
      };
    }
  }
  return null;
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id') || '';
  const type = url.searchParams.get('type') || 'wy';
  const name = url.searchParams.get('name') || '';
  const artist = url.searchParams.get('artist') || '';
  const fast = url.searchParams.get('fast') === '1';
  const source = SOURCE_MAP[type];
  if (!source) {
    return new Response(JSON.stringify({ code: 0, data: null, msg: 'Unsupported source' }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    // Playback requests only need the stream URL. Do not make switching wait
    // for artwork and lyrics, which are loaded independently by the client.
    const [urlData, picData, lrcData] = await Promise.all([
      gdFetch({ types: 'url', source, id, br: '320' }),
      fast ? Promise.resolve(null) : gdFetch({ types: 'pic', source, id, size: '300' }),
      fast ? Promise.resolve(null) : gdFetch({ types: 'lyric', source, id }),
    ]);

    let songUrl = urlData?.url || '';
    let pic = picData?.url || '';
    let lrc = lrcData?.lyric || '';

    if (!songUrl && name) {
      const rescued = await rescueByName(name, artist, source, !fast);
      if (rescued) {
        songUrl = rescued.url;
        if (!pic) pic = rescued.pic;
        if (!lrc) lrc = rescued.lrc;
      }
    }

    // Last resort for netease ids: Meting mirror that 302s to the CDN file.
    if (!songUrl && source === 'netease' && /^\d+$/.test(id)) {
      songUrl = `https://api.injahow.cn/meting/?type=url&id=${id}`;
    }

    return new Response(
      JSON.stringify({
        code: songUrl ? 1 : 0,
        data: { url: songUrl, pic, lrc, name: '', artist: '', album: '' },
      }),
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=600',
        },
      }
    );
  } catch {
    return new Response(JSON.stringify({ code: 0, data: null, msg: 'Failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
