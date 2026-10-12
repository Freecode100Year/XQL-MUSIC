// Regression checks for the 2026-10 audit fixes: proxy content and redirects,
// paging cursors, parameter parsing, storage, cache size and LRC parsing.
// Loads the real TypeScript sources (transpiled in memory); upstream fetches
// are replaced by fixed responses, so this needs no network.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const loaded = new Map();
async function load(file) {
  const full = path.resolve(root, file);
  if (loaded.has(full)) return loaded.get(full);
  let code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  // Resolve relative imports to transpiled copies.
  const deps = [...code.matchAll(/from '(\.[^']+)'/g)].map((m) => m[1]);
  for (const dep of deps) {
    const target = ['.ts', '.tsx', '/index.ts'].map((ext) => path.resolve(path.dirname(full), dep + ext)).find(fs.existsSync);
    const mod = await load(path.relative(root, target));
    code = code.replaceAll(`from '${dep}'`, `from '${mod.__url}'`);
  }
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  const mod = { ...(await import(url)), __url: url };
  loaded.set(full, mod);
  return mod;
}

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log('PASS:', name); } catch (e) { failures++; console.error('FAIL:', name, '-', e.message); }
}

// fetch double: each call takes the next scripted response.
let script = [];
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  const next = script.shift();
  if (!next) throw new Error('unexpected fetch ' + url);
  return typeof next === 'function' ? next(String(url), init) : next;
};
const respond = (body, status = 200, headers = {}) => new Response(body, { status, headers });
const get = (handler, url, headers = {}) => handler({ request: new Request(url, { headers }) });

const proxy = await load('functions/api/audio-proxy.ts');

await test('proxy passes audio through with safe headers', async () => {
  script = [respond('ID3', 206, { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes 0-2/3' })];
  const r = await get(proxy.onRequestGet, 'https://x/api/audio-proxy?url=' + encodeURIComponent('https://ccmixter.org/a.mp3'), { Range: 'bytes=0-2' });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
  assert.match(r.headers.get('Content-Security-Policy'), /sandbox/);
  assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(calls.at(-1).init.headers.Range, 'bytes=0-2');
  assert.equal(calls.at(-1).init.redirect, 'manual');
});

await test('proxy refuses HTML, SVG and script from upstream (F01)', async () => {
  for (const type of ['text/html; charset=utf-8', 'image/svg+xml', 'application/javascript', 'text/plain']) {
    script = [respond('<script>alert(1)</script>', 200, { 'Content-Type': type })];
    const r = await get(proxy.onRequestGet, 'https://x/api/audio-proxy?url=' + encodeURIComponent('https://archive.org/x'));
    assert.equal(r.status, 415, type);
    assert.doesNotMatch(await r.text(), /script/);
  }
});

await test('proxy error pages are not passed on', async () => {
  script = [respond('<html>not found</html>', 404, { 'Content-Type': 'text/html' })];
  const r = await get(proxy.onRequestGet, 'https://x/api/audio-proxy?url=' + encodeURIComponent('https://archive.org/x'));
  assert.equal(r.status, 404);
  assert.equal(r.headers.get('Content-Type'), 'text/plain; charset=utf-8');
});

await test('proxy checks every redirect hop (F02)', async () => {
  script = [respond(null, 302, { Location: 'https://evil.example/page' })];
  let r = await get(proxy.onRequestGet, 'https://x/api/audio-proxy?url=' + encodeURIComponent('https://archive.org/x'));
  assert.equal(r.status, 403);
  script = [respond(null, 302, { Location: 'https://ia800.us.archive.org/f.mp3' }), respond('ID3', 200, { 'Content-Type': 'audio/mpeg' })];
  r = await get(proxy.onRequestGet, 'https://x/api/audio-proxy?url=' + encodeURIComponent('https://archive.org/download/x/f.mp3'));
  assert.equal(r.status, 200);
  for (const bad of ['http://169.254.169.254/latest', 'https://127.0.0.1/x', 'https://localhost/x', 'https://[::1]/x', 'https://archive.org:8443/x', 'ftp://archive.org/x']) {
    script = [respond(null, 302, { Location: bad })];
    r = await get(proxy.onRequestGet, 'https://x/api/audio-proxy?url=' + encodeURIComponent('https://archive.org/x'));
    assert.equal(r.status, 403, bad);
  }
});

await test('Audius may hand off to its content nodes', async () => {
  script = [respond(null, 302, { Location: 'https://creatornode.example-operator.net/tracks/stream/abc' }), respond('ID3', 200, { 'Content-Type': 'audio/mpeg' })];
  const r = await get(proxy.onRequestGet, 'https://x/api/audio-proxy?url=' + encodeURIComponent('https://api.audius.co/v1/tracks/1/stream'));
  assert.equal(r.status, 200);
});

await test('redirect chains are limited', async () => {
  script = Array.from({ length: 10 }, (_, i) => respond(null, 302, { Location: `https://archive.org/${i}` }));
  const r = await get(proxy.onRequestGet, 'https://x/api/audio-proxy?url=' + encodeURIComponent('https://archive.org/x'));
  assert.equal(r.status, 508);
  script = [];
});

const { intParam } = await load('shared/params.ts');
await test('parameters never reach upstream as NaN (F12)', () => {
  assert.equal(intParam('no', 1, 1, 500), 1);
  assert.equal(intParam('-5', 1, 1, 500), 1);
  assert.equal(intParam('3abc', 1, 1, 500), 1);
  assert.equal(intParam('', 12, 1, 60), 12);
  assert.equal(intParam(null, 12, 1, 60), 12);
  assert.equal(intParam('0', 1, 1, 500), 1);
  assert.equal(intParam('999999', 1, 1, 500), 500);
  assert.equal(intParam(' 7 ', 1, 1, 500), 7);
});

const openverse = await load('functions/api/openverse.ts');
await test('Openverse reports more pages from page_count (F04)', async () => {
  const results = Array.from({ length: 20 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, url: 'https://a/b.mp3', title: 't' + i }));
  script = [respond(JSON.stringify({ results, page_count: 5 }), 200, { 'Content-Type': 'application/json' })];
  let r = await (await get(openverse.onRequestGet, 'https://x/api/openverse?action=search&keyword=a&page=1&limit=60')).json();
  assert.equal(r.data.length, 20); assert.equal(r.hasMore, true);
  assert.match(calls.at(-1).url, /page_size=20/);
  script = [respond(JSON.stringify({ results, page_count: 5 }), 200)];
  r = await (await get(openverse.onRequestGet, 'https://x/api/openverse?action=search&keyword=a&page=5&limit=60')).json();
  assert.equal(r.hasMore, false);
  script = [respond(JSON.stringify({ results: [], page_count: 0 }), 200)];
  await get(openverse.onRequestGet, 'https://x/api/openverse?action=search&keyword=a&page=no&limit=no');
  assert.doesNotMatch(calls.at(-1).url, /NaN/);
});

const audius = await load('functions/api/audius.ts');
await test('Audius pages continue where the last one stopped (F06)', async () => {
  const tracks = Array.from({ length: 300 }, (_, i) => ({ id: 't' + i, title: 'T' + i, user: { name: 'u' }, is_streamable: i >= 10 }));
  const upstream = (url) => {
    const u = new URL(url);
    const offset = Number(u.searchParams.get('offset')), limit = Number(u.searchParams.get('limit'));
    return respond(JSON.stringify({ data: tracks.slice(offset, offset + limit) }), 200);
  };
  script = [upstream];
  const first = await (await get(audius.onRequestGet, 'https://x/api/audius?action=search&keyword=a&page=1&limit=60')).json();
  script = [upstream];
  const second = await (await get(audius.onRequestGet, `https://x/api/audius?action=search&keyword=a&page=2&limit=60&offset=${first.nextOffset}`)).json();
  const ids = [...first.data, ...second.data].map((t) => t.id);
  assert.equal(new Set(ids).size, 120, 'no overlap');
  assert.equal(ids[0], 't10'); assert.equal(ids.at(-1), 't129'); assert.equal(first.hasMore, true);
});

const { parseLyrics } = await load('src/utils/format.ts');
await test('LRC lines with several time tags (F14)', () => {
  const lines = parseLyrics('[ar:Someone]\n[00:10.00][00:20.50]chorus\n[00:15.00]verse\n[00:30]\n[01:02.5]end');
  assert.deepEqual(lines.map((l) => [l.time, l.text]), [[10, 'chorus'], [15, 'verse'], [20.5, 'chorus'], [62.5, 'end']]);
  assert.equal(parseLyrics('[offset:+500]\n[00:10.00]a')[0].time, 9.5);
});

const { requestCache } = await load('src/utils/cache.ts');
await test('the request cache has a hard size limit (F13)', () => {
  for (let i = 0; i < 1000; i++) requestCache.set('k' + i, i, 60_000);
  assert.ok(requestCache.cache.size <= 300, `size ${requestCache.cache.size}`);
  assert.equal(requestCache.get('k999'), 999);
  assert.equal(requestCache.get('k0'), null);
});

// storage with a fake localStorage that can be broken on demand
const store = new Map(); let broken = false;
globalThis.localStorage = {
  getItem: (k) => { if (broken) throw new DOMException('denied', 'SecurityError'); return store.has(k) ? store.get(k) : null; },
  setItem: (k, v) => { if (broken) throw new DOMException('full', 'QuotaExceededError'); store.set(k, String(v)); },
  removeItem: (k) => { if (broken) throw new DOMException('denied', 'SecurityError'); store.delete(k); },
};
const storage = await load('src/utils/storage.ts');
await test('damaged or blocked storage does not break the player (F11)', () => {
  store.set('xql_search_history', '{}');
  storage.addSearchHistory('a');
  assert.deepEqual(storage.getSearchHistory(), ['a']);
  store.set('xql_search_history', JSON.stringify(['x', 3, null, 'y']));
  assert.deepEqual(storage.getSearchHistory(), ['x', 'y']);
  store.set('xql_volume', 'NaN'); assert.equal(storage.getVolume(), 0.8);
  store.set('xql_volume', '7'); assert.equal(storage.getVolume(), 1);
  store.set('xql_eq_gains', JSON.stringify(Array(31).fill('3'))); assert.equal(storage.getEqGains(), null);
  store.set('xql_eq_gains', JSON.stringify(Array(31).fill(99))); assert.equal(storage.getEqGains()[0], 20);
  store.set('xql_play_mode', 'bogus'); assert.equal(storage.getPlayMode(), 'sequential');
  broken = true;
  assert.equal(storage.getRegisteredUsername(), null);
  assert.deepEqual(storage.getSearchHistory(), []);
  storage.addSearchHistory('b');
  storage.setVolume(0.5);
  assert.equal(storage.getVolume(), 0.8);
  broken = false;
});

if (failures) process.exitCode = 1;
