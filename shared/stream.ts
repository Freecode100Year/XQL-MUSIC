// Fetching and relaying audio for the player. The relay runs on this site's
// origin, so it must never hand back something a browser would run as a page:
// only audio types pass, and every response carries headers that stop it being
// rendered or sniffed. Redirects are followed by hand, a few hops at most, and
// each hop is checked against the caller's rules before it is fetched.

export const SAFE_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

// What browsers play in <audio>. Octet-stream is common on music CDNs; with
// nosniff and the sandbox above it cannot run as a page.
const AUDIO_TYPE = /^(audio\/[a-z0-9.+-]+|application\/(ogg|octet-stream)|video\/(mp4|ogg|webm))$/i;

export function isAudioType(contentType: string | null): boolean {
  return AUDIO_TYPE.test((contentType || '').split(';')[0].trim());
}

// Plain public hostnames only: no IP literals, no single-label or local names.
export function isPublicUrl(url: URL): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.port && url.port !== '443' && url.port !== '80') return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host.startsWith('[') || /^[\d.]+$/.test(host)) return false;
  return !/(^|\.)(localhost|local|internal|lan|home|arpa)$/.test(host);
}

export function hostMatches(host: string, domains: readonly string[]): boolean {
  const h = host.toLowerCase();
  return domains.some((d) => h === d || h.endsWith(`.${d}`));
}

// allowHop(next, previous) decides whether a URL may be fetched; previous is
// null for the first one.
export type HopPolicy = (next: URL, previous: URL | null) => boolean;

export const MAX_HOPS = 5;

export class StreamError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function fetchMedia(start: string, headers: Record<string, string>, allowHop: HopPolicy,
  timeoutMs = 15_000): Promise<Response> {
  let url: URL;
  try { url = new URL(start); } catch { throw new StreamError(400, 'Invalid url'); }
  let previous: URL | null = null;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (!isPublicUrl(url) || !allowHop(url, previous)) throw new StreamError(403, 'Address not allowed');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url.toString(), { headers, redirect: 'manual', signal: controller.signal });
    } catch {
      throw new StreamError(502, 'Upstream failed');
    } finally {
      // Only the wait for the response headers is limited; the body streams.
      clearTimeout(timer);
    }
    const location = response.headers.get('Location');
    if (response.status >= 300 && response.status < 400 && location) {
      response.body?.cancel().catch(() => {});
      previous = url;
      try { url = new URL(location, url); } catch { throw new StreamError(502, 'Bad redirect'); }
      continue;
    }
    return response;
  }
  throw new StreamError(508, 'Too many redirects');
}

// relayAudio passes an upstream audio response on, or refuses it.
export function relayAudio(response: Response, cors: Record<string, string>, extra: Record<string, string> = {}): Response {
  const base = { ...cors, ...SAFE_HEADERS };
  if (response.status !== 200 && response.status !== 206) {
    response.body?.cancel().catch(() => {});
    const status = response.status >= 400 && response.status < 600 ? response.status : 502;
    return new Response('Audio unavailable', { status, headers: { ...base, 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const type = response.headers.get('Content-Type');
  if (type && !isAudioType(type)) {
    response.body?.cancel().catch(() => {});
    return new Response('Not audio', { status: 415, headers: { ...base, 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const headers = new Headers(base);
  for (const key of ['Content-Length', 'Content-Range', 'Accept-Ranges']) {
    const value = response.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set('Content-Type', type || 'audio/mpeg');
  headers.set('Cache-Control', 'public, max-age=3600');
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

export function streamErrorResponse(error: unknown, cors: Record<string, string>): Response {
  const status = error instanceof StreamError ? error.status : 502;
  const message = error instanceof StreamError ? error.message : 'Proxy failed';
  return new Response(message, { status, headers: { ...cors, ...SAFE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
}
