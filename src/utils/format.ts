import { LyricLine } from '../types';

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// Each line may carry several time tags ([00:10.00][00:20.00]chorus), one
// for every time it is sung. Tags like [ar:Artist] are skipped, and
// [offset:+500] (milliseconds, positive means earlier) is applied.
export function parseLyrics(lrc: string): LyricLine[] {
  if (!lrc) return [];
  const lines: LyricLine[] = [];
  const offsetTag = lrc.match(/\[offset:\s*([+-]?\d+)\s*\]/i);
  const offset = offsetTag ? Number(offsetTag[1]) / 1000 : 0;
  const tag = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  for (const raw of lrc.split(/\r?\n/)) {
    const times: number[] = [];
    let rest = raw.trim();
    tag.lastIndex = 0;
    let match: RegExpExecArray | null;
    let end = 0;
    while ((match = tag.exec(rest)) !== null && match.index === end) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
      times.push(Math.max(0, min * 60 + sec + ms / 1000 - offset));
      end = tag.lastIndex;
    }
    if (!times.length) continue;
    const text = rest.slice(end).trim();
    if (!text) continue;
    for (const time of times) lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
