import { useState, useEffect } from 'react';
import { Song, LyricLine } from '../types';
import { API, CACHE_TTL } from '../config';
import { requestCache } from '../utils/cache';
import { parseLyrics } from '../utils/format';

export function useLyrics(currentSong: Song | null, currentTime: number) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [rawLyric, setRawLyric] = useState('');

  // Lyrics belong to one song. Switching songs clears them at once and
  // cancels the old request, so a slow answer for the previous song can never
  // replace (or, by failing, clear) the lyrics of the current one.
  useEffect(() => {
    setLyrics([]);
    setRawLyric('');
    if (!currentSong) return;
    const song = currentSong;
    const controller = new AbortController();
    const show = (lrc: string) => {
      if (controller.signal.aborted) return;
      setRawLyric(lrc);
      setLyrics(parseLyrics(lrc));
    };
    const cacheKey = `lyric_${song.sourceType}_${song.source}_${song.id}`;
    const cached = requestCache.get<string>(cacheKey);
    if (cached) {
      show(cached);
      return;
    }
    if (song.sourceType === 'audius' || song.sourceType === 'ccmixter' || song.sourceType === 'archive' || song.sourceType === 'openverse' || song.sourceType === 'wikimedia' || song.sourceType === 'openaudio' || song.sourceType === 'loc') {
      return;
    }
    (async () => {
      let lrc = '';
      if (song.sourceType === 'gd') {
        const res = await fetch(`${API.GD}?types=lyric&source=${song.source}&id=${song.id}`, { signal: controller.signal });
        const data = await res.json();
        lrc = data.lyric || '';
      } else {
        const res = await fetch(
          `${API.SONG}?id=${song.id}&type=${song.source}` +
            `&name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (data.code === 1 && data.data) {
          lrc = data.data.lrc || '';
        }
      }
      if (lrc) requestCache.set(cacheKey, lrc, CACHE_TTL.LYRIC);
      show(lrc);
    })().catch(() => {});
    return () => controller.abort();
  }, [currentSong]);

  useEffect(() => {
    if (lyrics.length === 0) {
      setCurrentLineIndex(-1);
      return;
    }
    let idx = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        idx = i;
        break;
      }
    }
    setCurrentLineIndex(idx);
  }, [currentTime, lyrics]);

  return {
    lyrics,
    currentLineIndex,
    rawLyric,
  };
}
