const SOURCES = [
  { name: 'Jamendo CC', source: 'jamendo', keyword: 'piano' },
  { name: 'Freesound CC Audio', source: 'freesound', keyword: 'music' },
];

const timeoutSignal = (milliseconds) => AbortSignal.timeout(milliseconds);

for (const source of SOURCES) {
  const query = new URLSearchParams({
    q: source.keyword,
    source: source.source,
    page_size: '5',
  });
  const searchResponse = await fetch(`https://api.openverse.org/v1/audio/?${query}`, {
    headers: { 'User-Agent': 'XQL-MUSIC/2.0 (silent source verifier)' },
    signal: timeoutSignal(15_000),
  });
  if (!searchResponse.ok) throw new Error(`${source.name}: search returned ${searchResponse.status}`);

  const searchResult = await searchResponse.json();
  const track = searchResult?.results?.find((item) => item?.url && item?.source === source.source);
  if (!track) throw new Error(`${source.name}: no playable search result`);

  const audioResponse = await fetch(track.url, {
    headers: { Range: 'bytes=0-1023' },
    redirect: 'follow',
    signal: timeoutSignal(15_000),
  });
  const contentType = audioResponse.headers.get('content-type') || '';
  if (audioResponse.status !== 206 || !contentType.toLowerCase().startsWith('audio/')) {
    await audioResponse.body?.cancel();
    throw new Error(`${source.name}: expected partial audio, received ${audioResponse.status} ${contentType}`);
  }
  await audioResponse.body?.cancel();
  console.log(`${source.name}: search OK, silent Range check OK (${contentType})`);
}
