import { fetchMedia, hostMatches, relayAudio, streamErrorResponse, SAFE_HEADERS, type HopPolicy } from '../../shared/stream';

const ALLOWED_DOMAINS = [
  'music.126.net',
  'joox.com',
  'audius.co',
  'ccmixter.org',
  'archive.org',
  'wikimedia.org',
  'injahow.cn',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' },
  });
};

// The first address must be on the list above. Audius answers with a redirect
// to whichever content node holds the file, and those nodes are run by many
// operators under their own domains, so a hop that starts at audius.co may go
// to any public host; every other hop must stay on the list.
const allowHop: HopPolicy = (next, previous) =>
  hostMatches(next.hostname, ALLOWED_DOMAINS) ||
  (previous !== null && hostMatches(previous.hostname, ['audius.co']));

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const audioUrl = url.searchParams.get('url');

  if (!audioUrl) {
    return new Response('Missing url parameter', { status: 400, headers: { ...CORS_HEADERS, ...SAFE_HEADERS } });
  }

  let parsed: URL;
  try {
    parsed = new URL(audioUrl);
  } catch {
    return new Response('Invalid url', { status: 400, headers: { ...CORS_HEADERS, ...SAFE_HEADERS } });
  }

  if (!hostMatches(parsed.hostname, ALLOWED_DOMAINS)) {
    return new Response('Domain not allowed', { status: 403, headers: { ...CORS_HEADERS, ...SAFE_HEADERS } });
  }

  try {
    const reqHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': parsed.origin + '/',
    };

    const range = context.request.headers.get('Range');
    if (range) reqHeaders['Range'] = range;

    const response = await fetchMedia(audioUrl, reqHeaders, allowHop);
    return relayAudio(response, CORS_HEADERS);
  } catch (error) {
    return streamErrorResponse(error, CORS_HEADERS);
  }
};
