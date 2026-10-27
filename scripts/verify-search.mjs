// Exercise the actual request helper without a browser or upstream network.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/hooks/useSearch.ts', import.meta.url), 'utf8');
const start = source.indexOf('async function searchJson(');
const end = source.indexOf('\nasync function searchStandard(', start);
const code = ts.transpileModule('export ' + source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { searchJson } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
let fireTimeout;
let timerCleared = false;
globalThis.SEARCH_TIMEOUT_MS = 12000;
globalThis.window = {
  setTimeout(fn) { fireTimeout = fn; timerCleared = false; return 1; },
  clearTimeout() { timerCleared = true; },
};
globalThis.fetch = async (_, { signal }) => new Promise((resolve, reject) => {
  if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
  signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
});
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log('PASS:', name); }
  catch (e) { failures++; console.error('FAIL:', name, '-', e.message); }
}
await test('search deadline is reported as a failure, not user cancellation', async () => {
  const request = searchJson('/api/search', new AbortController().signal);
  fireTimeout();
  await assert.rejects(request, e => e.name === 'TimeoutError');
  assert.equal(timerCleared, true);
});
await test('user cancellation stays an AbortError', async () => {
  const user = new AbortController();
  const request = searchJson('/api/search', user.signal);
  user.abort();
  await assert.rejects(request, e => e.name === 'AbortError');
  assert.equal(timerCleared, true);
});
await test('already cancelled searches never start a network request', async () => {
  let requests = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { requests++; return Response.json({ code: 1 }); };
  try {
    const user = new AbortController(); user.abort();
    await assert.rejects(searchJson('/api/search', user.signal), e => e.name === 'AbortError');
    assert.equal(requests, 0);
  } finally { globalThis.fetch = original; }
});
if (failures) process.exitCode = 1;
