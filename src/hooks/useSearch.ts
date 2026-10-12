import { useState, useRef, useCallback } from 'react';
import { OpenverseSource, Song, StandardPlatform } from '../types';
import { API, CACHE_TTL, SEARCH_DEBOUNCE_MS, DEFAULT_LIMIT, DEFAULT_PLATFORM, PLATFORMS } from '../config';
import { requestCache } from '../utils/cache';
import { addSearchHistory } from '../utils/storage';

export type SourceStatus = 'idle' | 'loading' | 'ready' | 'error';
type SourceStatusMap = Record<string, SourceStatus>;
// One page of results. hasMore and nextOffset come from the server when the
// source can tell; otherwise a full page is taken to mean there may be more.
type Page = { songs: Song[]; hasMore?: boolean; nextOffset?: number };
type SearchResponse = Page & { statuses: SourceStatusMap };

function pageFrom(data: any, songs: Song[]): Page {
  return {
    songs,
    hasMore: typeof data.hasMore === 'boolean' ? data.hasMore : undefined,
    nextOffset: Number.isInteger(data.nextOffset) ? data.nextOffset : undefined,
  };
}

const SOURCE_KEYS = PLATFORMS.filter((platform) => platform.key !== 'all').map((platform) => platform.key);
const SEARCH_TIMEOUT_MS = 12_000;

function deduplicateSongs(songs: Song[]): Song[] {
  const seen = new Map<string, Song>();
  for (const song of songs) {
    const key = `${song.name.toLowerCase().trim()}|${song.artist.toLowerCase().trim()}`;
    if (!seen.has(key)) seen.set(key, song);
  }
  return Array.from(seen.values());
}

function readyStatus(key: string): SourceStatusMap {
  return { [key]: 'ready' };
}

async function searchJson(url: string, signal: AbortSignal): Promise<any> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Search failed (${response.status})`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

async function searchStandard(kw: string, plat: string, pg: number, signal: AbortSignal): Promise<Song[]> {
  const url = `${API.SEARCH}?keyword=${encodeURIComponent(kw)}&type=${plat}&page=${pg}&limit=${DEFAULT_LIMIT}`;
  const data = await searchJson(url, signal);
  if (data.code !== 1 || !Array.isArray(data.data)) throw new Error(`${plat} search unavailable`);
  return data.data.map((item: any) => ({
    id: String(item.id || item.ID),
    name: item.name || item.songname || '',
    artist: item.artist || item.singer || '',
    album: item.album || '',
    pic: item.pic == null ? '' : String(item.pic),
    source: plat as StandardPlatform,
    sourceType: 'standard' as const,
  }));
}

async function searchAudius(kw: string, pg: number, signal: AbortSignal, offset?: number): Promise<Page> {
  const from = offset === undefined ? '' : `&offset=${offset}`;
  const url = `${API.AUDIUS}?action=search&keyword=${encodeURIComponent(kw)}&page=${pg}&limit=${DEFAULT_LIMIT}${from}`;
  const data = await searchJson(url, signal);
  if (data.code !== 1 || !Array.isArray(data.data)) throw new Error('Audius search unavailable');
  return pageFrom(data, data.data.map((item: any) => ({
    id: String(item.id), name: item.name || '', artist: item.artist || '', album: item.album || '',
    pic: item.pic, duration: item.duration, source: 'au' as const, sourceType: 'audius' as const,
  })));
}

async function searchCcMixter(kw: string, pg: number, signal: AbortSignal): Promise<Page> {
  const url = `${API.CCMIXTER}?action=search&keyword=${encodeURIComponent(kw)}&page=${pg}&limit=${DEFAULT_LIMIT}`;
  const data = await searchJson(url, signal);
  if (data.code !== 1 || !Array.isArray(data.data)) throw new Error('ccMixter search unavailable');
  return pageFrom(data, data.data.map((item: any) => ({
    id: String(item.id), name: item.name || '', artist: item.artist || '',
    album: item.license || 'Creative Commons', pic: item.pic,
    source: 'cc' as const, sourceType: 'ccmixter' as const,
  })));
}

async function searchArchive(kw: string, pg: number, signal: AbortSignal): Promise<Page> {
  const url = `${API.ARCHIVE}?action=search&keyword=${encodeURIComponent(kw)}&page=${pg}&limit=${DEFAULT_LIMIT}`;
  const data = await searchJson(url, signal);
  if (data.code !== 1 || !Array.isArray(data.data)) throw new Error('Internet Archive search unavailable');
  return pageFrom(data, data.data.map((item: any) => ({
    id: String(item.id), name: item.name || '', artist: item.artist || 'Internet Archive',
    album: item.license || 'Creative Commons', pic: item.pic,
    source: 'ia' as const, sourceType: 'archive' as const,
  })));
}

const OPENVERSE_CATALOG_BY_PLATFORM: Partial<Record<OpenverseSource, 'jamendo' | 'freesound'>> = {
  jm: 'jamendo',
  fs: 'freesound',
};

function openversePlatform(catalogSource: unknown, requestedPlatform: OpenverseSource): OpenverseSource {
  if (requestedPlatform !== 'ov') return requestedPlatform;
  if (catalogSource === 'jamendo') return 'jm';
  if (catalogSource === 'freesound') return 'fs';
  return 'ov';
}

async function searchOpenverse(
  kw: string,
  pg: number,
  signal: AbortSignal,
  requestedPlatform: OpenverseSource = 'ov',
): Promise<Page> {
  const catalogSource = OPENVERSE_CATALOG_BY_PLATFORM[requestedPlatform];
  const sourceQuery = catalogSource ? `&source=${catalogSource}` : '';
  const url = `${API.OPENVERSE}?action=search&keyword=${encodeURIComponent(kw)}&page=${pg}&limit=${DEFAULT_LIMIT}${sourceQuery}`;
  const data = await searchJson(url, signal);
  if (data.code !== 1 || !Array.isArray(data.data)) throw new Error('Openverse search unavailable');
  return pageFrom(data, data.data.map((item: any) => ({
    id: String(item.id), name: item.name || '', artist: item.artist || 'Openverse',
    album: item.license || 'Creative Commons', pic: item.pic, duration: item.duration,
    source: openversePlatform(item.catalogSource, requestedPlatform), sourceType: 'openverse' as const,
  })));
}

async function searchWikimedia(kw: string, pg: number, signal: AbortSignal): Promise<Page> {
  const url = `${API.WIKIMEDIA}?action=search&keyword=${encodeURIComponent(kw)}&page=${pg}&limit=${DEFAULT_LIMIT}`;
  const data = await searchJson(url, signal);
  if (data.code !== 1 || !Array.isArray(data.data)) throw new Error('Wikimedia search unavailable');
  return pageFrom(data, data.data.map((item: any) => ({
    id: String(item.id), name: item.name || '', artist: item.artist || 'Wikimedia Commons',
    album: item.license || 'Wikimedia Commons', pic: item.pic,
    source: 'wm' as const, sourceType: 'wikimedia' as const,
  })));
}

async function searchOpenAudio(kw: string, pg: number, signal: AbortSignal): Promise<Page> {
  const url = `${API.OPENAUDIO}?action=search&keyword=${encodeURIComponent(kw)}&page=${pg}&limit=${DEFAULT_LIMIT}`;
  const data = await searchJson(url, signal);
  if (data.code !== 1 || !Array.isArray(data.data)) throw new Error('Open.Audio search unavailable');
  return pageFrom(data, data.data.map((item: any) => ({
    id: String(item.id), name: item.name || '', artist: item.artist || 'Open.Audio',
    album: item.license || item.album || 'CC0 1.0', pic: item.pic, duration: item.duration,
    source: 'oa' as const, sourceType: 'openaudio' as const,
  })));
}

async function searchLoc(kw: string, pg: number, signal: AbortSignal): Promise<Song[]> {
  const endpoint = new URL('https://www.loc.gov/collections/national-jukebox/');
  endpoint.searchParams.set('fo', 'json');
  endpoint.searchParams.set('at', 'results');
  endpoint.searchParams.set('q', kw.slice(0, 100));
  endpoint.searchParams.set('c', String(DEFAULT_LIMIT));
  endpoint.searchParams.set('sp', String(pg));
  endpoint.searchParams.set('dates', '1900/1922');
  const data = await searchJson(endpoint.toString(), signal);
  if (!Array.isArray(data.results)) throw new Error('Library of Congress search unavailable');
  return data.results.map((item: any) => {
    const id = String(item.id || '').match(/\/item\/(jukebox-\d+)/i)?.[1] || '';
    const year = Number(String(item.date || '').match(/^(\d{4})/)?.[1] || 0);
    const formats = Array.isArray(item.online_format) ? item.online_format : [];
    const resources = Array.isArray(item.resources) ? item.resources : [];
    const audioUrl = String(resources.map((resource: any) => resource?.media).find(Boolean) || '');
    const images = Array.isArray(item.image_url) ? item.image_url : [];
    const primary = Array.isArray(item.contributor_primary) ? item.contributor_primary : [];
    const contributors = Array.isArray(item.contributor) ? item.contributor : [];
    let validAudio = false;
    try {
      const parsed = new URL(audioUrl);
      validAudio = parsed.protocol === 'https:' && parsed.hostname === 'tile.loc.gov' && parsed.pathname.startsWith('/streaming-services/');
    } catch {}
    if (!id || year < 1900 || year > 1922 || item.access_restricted === true || !formats.includes('audio') || !validAudio) return null;
    return {
      id, name: item.title || '', artist: String(primary[0] || contributors[0] || 'Library of Congress'),
      album: `Public Domain · ${year}`, pic: String(images[0] || ''), audioUrl,
      source: 'loc' as const, sourceType: 'loc' as const,
    };
  }).filter(Boolean) as Song[];
}

async function searchAggregate(kw: string, pg: number, signal: AbortSignal): Promise<SearchResponse> {
  const searches: Array<{ key: string; run: () => Promise<Song[]> }> = [
    { key: 'wy', run: () => searchStandard(kw, 'wy', pg, signal) },
    { key: 'jx', run: () => searchStandard(kw, 'jx', pg, signal) },
    { key: 'au', run: async () => (await searchAudius(kw, pg, signal)).songs },
    { key: 'cc', run: async () => (await searchCcMixter(kw, pg, signal)).songs },
    { key: 'ia', run: async () => (await searchArchive(kw, pg, signal)).songs },
    { key: 'ov', run: async () => (await searchOpenverse(kw, pg, signal)).songs },
    { key: 'wm', run: async () => (await searchWikimedia(kw, pg, signal)).songs },
    { key: 'oa', run: async () => (await searchOpenAudio(kw, pg, signal)).songs },
    { key: 'loc', run: () => searchLoc(kw, pg, signal) },
  ];
  const results = await Promise.all(searches.map(async ({ key, run }) => {
    try {
      return { key, songs: await run(), status: 'ready' as const };
    } catch {
      return { key, songs: [] as Song[], status: 'error' as const };
    }
  }));
  const statuses = Object.fromEntries(results.map(({ key, status }) => [key, status]));
  const merged: Song[] = [];
  const maxLength = Math.max(0, ...results.map((result) => result.songs.length));
  for (let index = 0; index < maxLength; index++) {
    for (const result of results) {
      if (result.songs[index]) merged.push(result.songs[index]);
    }
  }
  return { songs: deduplicateSongs(merged).slice(0, DEFAULT_LIMIT), statuses };
}

async function searchOne(platformInfo: (typeof PLATFORMS)[number], kw: string, plat: string, pg: number,
  signal: AbortSignal, offset?: number): Promise<SearchResponse> {
  const statuses = readyStatus(plat);
  switch (platformInfo.type) {
    case 'aggregate': {
      const response = await searchAggregate(kw, pg, signal);
      return response;
    }
    case 'audius': return { ...(await searchAudius(kw, pg, signal, offset)), statuses };
    case 'ccmixter': return { ...(await searchCcMixter(kw, pg, signal)), statuses };
    case 'archive': return { ...(await searchArchive(kw, pg, signal)), statuses };
    case 'openverse': return { ...(await searchOpenverse(kw, pg, signal, plat as OpenverseSource)), statuses };
    case 'wikimedia': return { ...(await searchWikimedia(kw, pg, signal)), statuses };
    case 'openaudio': return { ...(await searchOpenAudio(kw, pg, signal)), statuses };
    case 'loc': return { songs: await searchLoc(kw, pg, signal), statuses };
    default: return { songs: await searchStandard(kw, plat, pg, signal), statuses };
  }
}

export function useSearch() {
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [platform, setPlatform] = useState<string>(DEFAULT_PLATFORM);
  const [hasMore, setHasMore] = useState(false);
  const [sourceStatus, setSourceStatus] = useState<SourceStatusMap>({});
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  // What the list on screen shows: the query, the last page loaded and where
  // the next page starts. Kept in refs so a burst of scroll events sees the
  // current values, and only advanced once a page has arrived.
  const shownRef = useRef<{ kw: string; plat: string; page: number; nextOffset?: number }>({ kw: '', plat: DEFAULT_PLATFORM, page: 0 });
  const loadingMoreRef = useRef(false);

  // Forget any search in flight or waiting for the debounce.
  const cancelPending = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    requestRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    loadingMoreRef.current = false;
  }, []);

  const reset = useCallback(() => {
    cancelPending();
    shownRef.current = { kw: '', plat: shownRef.current.plat, page: 0 };
    setResults([]);
    setHasMore(false);
    setLoading(false);
    setSourceStatus({});
  }, [cancelPending]);

  const setLoadingStatuses = useCallback((plat: string) => {
    if (plat === 'all') {
      setSourceStatus(Object.fromEntries(SOURCE_KEYS.map((key) => [key, 'loading'])));
    } else {
      setSourceStatus((previous) => ({ ...previous, [plat]: 'loading' }));
    }
  }, []);

  const doSearch = useCallback(async (kw: string, plat: string, pg: number, append = false) => {
    if (!kw.trim()) {
      reset();
      return;
    }
    const platformInfo = PLATFORMS.find((item) => item.key === plat);
    if (!platformInfo) return;

    cancelPending();
    const requestId = requestRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    if (append) loadingMoreRef.current = true;
    setLoading(true);
    setLoadingStatuses(plat);
    const offset = append ? shownRef.current.nextOffset : undefined;

    const finish = (response: SearchResponse) => {
      shownRef.current = { kw, plat, page: pg, nextOffset: response.nextOffset };
      setResults((previous) => append ? deduplicateSongs([...previous, ...response.songs]) : response.songs);
      setHasMore(response.hasMore ?? response.songs.length >= DEFAULT_LIMIT);
      setSourceStatus(response.statuses);
    };

    const cacheKey = `search_${plat}_${kw}_${pg}_${offset ?? ''}`;
    const cached = requestCache.get<SearchResponse>(cacheKey);
    if (cached) {
      finish(cached);
      abortRef.current = null;
      loadingMoreRef.current = false;
      setLoading(false);
      return;
    }

    try {
      const response = await searchOne(platformInfo, kw, plat, pg, signal, offset);
      if (requestId !== requestRef.current) return;
      requestCache.set(cacheKey, response, CACHE_TTL.SEARCH);
      finish(response);
      addSearchHistory(kw);
    } catch (error: any) {
      if (requestId !== requestRef.current || error?.name === 'AbortError') return;
      if (!append) {
        shownRef.current = { kw, plat, page: 0 };
        setResults([]);
        setHasMore(false);
      }
      // A failed next page keeps hasMore, so scrolling retries the same page.
      setSourceStatus(plat === 'all'
        ? Object.fromEntries(SOURCE_KEYS.map((key) => [key, 'error']))
        : { [plat]: 'error' });
    } finally {
      if (requestId === requestRef.current) {
        abortRef.current = null;
        loadingMoreRef.current = false;
        setLoading(false);
      }
    }
  }, [cancelPending, reset, setLoadingStatuses]);

  const search = useCallback((kw: string, plat?: string) => {
    const nextPlatform = plat || platform;
    setKeyword(kw);
    if (plat) setPlatform(plat);
    cancelPending();
    if (!kw.trim()) {
      reset();
      return;
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      doSearch(kw, nextPlatform, 1);
    }, SEARCH_DEBOUNCE_MS);
  }, [platform, cancelPending, reset, doSearch]);

  const searchImmediate = useCallback((kw: string, plat?: string) => {
    const nextPlatform = plat || platform;
    setKeyword(kw);
    if (plat) setPlatform(plat);
    doSearch(kw, nextPlatform, 1);
  }, [platform, doSearch]);

  const loadMore = useCallback(() => {
    const shown = shownRef.current;
    // One page at a time, and never on top of a new search still loading.
    if (loadingMoreRef.current || abortRef.current || !shown.kw || shown.page < 1) return;
    doSearch(shown.kw, shown.plat, shown.page + 1, true);
  }, [doSearch]);

  const changePlatform = useCallback((nextPlatform: string) => {
    setPlatform(nextPlatform);
    if (keyword.trim()) doSearch(keyword, nextPlatform, 1);
    else cancelPending();
  }, [keyword, cancelPending, doSearch]);

  const clear = useCallback(() => {
    setKeyword('');
    reset();
  }, [reset]);

  return {
    results, loading, keyword, platform, hasMore, sourceStatus,
    search, searchImmediate, loadMore, changePlatform, setKeyword, clear,
  };
}
