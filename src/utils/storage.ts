import { SEARCH_HISTORY_MAX } from '../config';
import type { Song } from '../types';

const KEYS = {
  SEARCH_HISTORY: 'xql_search_history',
  VOLUME: 'xql_volume',
  PLAY_MODE: 'xql_play_mode',
  SPATIAL_AUDIO: 'xql_spatial_audio',
  CROSSFEED: 'xql_crossfeed',
  DEESSER: 'xql_deesser',
  LOUDNESS_COMP: 'xql_loudness_comp',
  OUTPUT_MODE: 'xql_output_mode',
  GAIN_MULTIPLIER: 'xql_gain_multiplier',
  EQ_ENABLED: 'xql_eq_enabled',
  EQ_GAINS: 'xql_eq_gains',
  EQ_PRESET: 'xql_eq_preset',
  SPATIAL_MODE: 'xql_spatial_mode',
  NIGHT_MODE: 'xql_night_mode',
  BALANCE: 'xql_balance',
  VIRTUAL_8D: 'xql_virtual_8d',
  VIRTUAL_8D_SPEED: 'xql_virtual_8d_speed',
  VIRTUAL_8D_DEPTH: 'xql_virtual_8d_depth',
  USERNAME: 'xql_username',
} as const;

export function getRegisteredUsername(): string | null {
  const username = localStorage.getItem(KEYS.USERNAME);
  return username && /^\d{11}$/.test(username) ? username : null;
}

export function registerUsername(username: string): boolean {
  if (!/^\d{11}$/.test(username)) return false;
  localStorage.setItem(KEYS.USERNAME, username);
  return true;
}

function favoritesKey(username: string): string {
  return `xql_favorites_${username}`;
}

export function getFavorites(username: string): Song[] {
  if (!/^\d{11}$/.test(username)) return [];
  try {
    const value = JSON.parse(localStorage.getItem(favoritesKey(username)) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((song): song is Song => Boolean(
      song && typeof song === 'object' && typeof song.id === 'string' &&
      typeof song.name === 'string' && typeof song.artist === 'string' &&
      typeof song.source === 'string' && typeof song.sourceType === 'string',
    )).slice(0, 500);
  } catch {
    return [];
  }
}

export function setFavorites(username: string, songs: Song[]): void {
  if (!/^\d{11}$/.test(username)) return;
  localStorage.setItem(favoritesKey(username), JSON.stringify(songs.slice(0, 500)));
}

export function getSearchHistory(): string[] {
  const raw = localStorage.getItem(KEYS.SEARCH_HISTORY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addSearchHistory(keyword: string): void {
  const history = getSearchHistory().filter((h) => h !== keyword);
  history.unshift(keyword);
  if (history.length > SEARCH_HISTORY_MAX) history.pop();
  localStorage.setItem(KEYS.SEARCH_HISTORY, JSON.stringify(history));
}

export function clearSearchHistory(): void {
  localStorage.removeItem(KEYS.SEARCH_HISTORY);
}

export function getVolume(): number {
  const raw = localStorage.getItem(KEYS.VOLUME);
  return raw ? parseFloat(raw) : 0.8;
}

export function setVolume(vol: number): void {
  localStorage.setItem(KEYS.VOLUME, String(vol));
}

export function getPlayMode(): string {
  return localStorage.getItem(KEYS.PLAY_MODE) || 'sequential';
}

export function setPlayMode(mode: string): void {
  localStorage.setItem(KEYS.PLAY_MODE, mode);
}

// Crossfeed strength. In-ear monitors are the worst case for headphone
// listening: sealed in the canal, they leak nothing across to the other ear, so
// hard-panned material collapses into two points inside the head. Medium is the
// default because it is the amount that relieves that without audibly narrowing
// the image. An explicit choice, once made, is still respected.
export type CrossfeedMode = 'off' | 'light' | 'medium' | 'strong';

const CROSSFEED_MODES: CrossfeedMode[] = ['off', 'light', 'medium', 'strong'];

export function getCrossfeedMode(): CrossfeedMode {
  const raw = localStorage.getItem(KEYS.CROSSFEED);
  if (raw && (CROSSFEED_MODES as string[]).includes(raw)) return raw as CrossfeedMode;
  // Migrate the old on/off flag.
  const legacy = localStorage.getItem(KEYS.SPATIAL_AUDIO);
  return legacy === 'true' ? 'medium' : 'off';
}

export function setCrossfeedMode(mode: CrossfeedMode): void {
  localStorage.setItem(KEYS.CROSSFEED, mode);
  localStorage.setItem(KEYS.SPATIAL_AUDIO, String(mode !== 'off'));
}

// De-essing changes the high-frequency content of every track. Keep it opt-in
// so a clean recording or a neutral headphone is not processed unnecessarily.
export function getDeEsser(): boolean {
  const raw = localStorage.getItem(KEYS.DEESSER);
  return raw === 'true';
}

export function setDeEsser(enabled: boolean): void {
  localStorage.setItem(KEYS.DEESSER, String(enabled));
}

// Equal-loudness compensation intentionally colours the mix, so leave it to
// listeners who prefer it at lower volumes instead of applying it by default.
export function getLoudnessComp(): boolean {
  const raw = localStorage.getItem(KEYS.LOUDNESS_COMP);
  return raw === 'true';
}

export function setLoudnessComp(enabled: boolean): void {
  localStorage.setItem(KEYS.LOUDNESS_COMP, String(enabled));
}

// Which transducer the chain is being voiced for. Headphone is the default -
// this is a web player, so most listening happens on in-ears - but a laptop or
// a desk speaker needs the opposite treatment: no crossfeed (the room already
// does that), no de-esser aimed at a canal resonance that is not there, and a
// cabinet voicing instead.
export type OutputMode = 'headphone' | 'speaker';

export function getOutputMode(): OutputMode {
  return localStorage.getItem(KEYS.OUTPUT_MODE) === 'speaker' ? 'speaker' : 'headphone';
}

export function setOutputMode(mode: OutputMode): void {
  localStorage.setItem(KEYS.OUTPUT_MODE, mode);
}

export function getGainMultiplier(): number {
  const raw = Number.parseFloat(localStorage.getItem(KEYS.GAIN_MULTIPLIER) || '1');
  return Number.isFinite(raw) ? Math.max(0, Math.min(2, raw)) : 1;
}

export function setGainMultiplier(gain: number): void {
  localStorage.setItem(KEYS.GAIN_MULTIPLIER, String(Math.max(0, Math.min(2, gain))));
}

export type SpatialMode = 'off' | 'wide' | 'mono';

export function getSpatialMode(): SpatialMode {
  const mode = localStorage.getItem(KEYS.SPATIAL_MODE);
  // Migrate the removed phase-widening mode to neutral stereo.
  return mode === 'mono' ? mode : 'off';
}

export function setSpatialMode(mode: SpatialMode): void {
  localStorage.setItem(KEYS.SPATIAL_MODE, mode);
}

export function getNightMode(): boolean {
  return localStorage.getItem(KEYS.NIGHT_MODE) === 'true';
}

export function setNightMode(enabled: boolean): void {
  localStorage.setItem(KEYS.NIGHT_MODE, String(enabled));
}

export function getBalance(): number {
  const value = Number.parseFloat(localStorage.getItem(KEYS.BALANCE) || '0');
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

export function setBalance(value: number): void {
  localStorage.setItem(KEYS.BALANCE, String(Math.max(-1, Math.min(1, value))));
}

export function getVirtual8d(): boolean {
  return localStorage.getItem(KEYS.VIRTUAL_8D) === 'true';
}

export function setVirtual8d(enabled: boolean): void {
  localStorage.setItem(KEYS.VIRTUAL_8D, String(enabled));
}

function getBoundedNumber(key: string, fallback: number, min: number, max: number): number {
  const value = Number.parseFloat(localStorage.getItem(key) || '');
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

export function getVirtual8dSpeed(): number {
  return getBoundedNumber(KEYS.VIRTUAL_8D_SPEED, 0.075, 0.04, 0.12);
}

export function setVirtual8dSpeed(value: number): void {
  localStorage.setItem(KEYS.VIRTUAL_8D_SPEED, String(Math.max(0.04, Math.min(0.12, value))));
}

export function getVirtual8dDepth(): number {
  return getBoundedNumber(KEYS.VIRTUAL_8D_DEPTH, 0.7, 0.25, 0.85);
}

export function setVirtual8dDepth(value: number): void {
  localStorage.setItem(KEYS.VIRTUAL_8D_DEPTH, String(Math.max(0.25, Math.min(0.85, value))));
}

export function getEqEnabled(): boolean {
  return localStorage.getItem(KEYS.EQ_ENABLED) === 'true';
}

export function setEqEnabled(enabled: boolean): void {
  localStorage.setItem(KEYS.EQ_ENABLED, String(enabled));
}

export function getEqGains(): number[] | null {
  const raw = localStorage.getItem(KEYS.EQ_GAINS);
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length === 31 ? arr : null;
  } catch {
    return null;
  }
}

export function setEqGains(gains: number[]): void {
  localStorage.setItem(KEYS.EQ_GAINS, JSON.stringify(gains));
}

export function getEqPreset(): string {
  return localStorage.getItem(KEYS.EQ_PRESET) || 'flat';
}

export function setEqPreset(preset: string): void {
  localStorage.setItem(KEYS.EQ_PRESET, preset);
}
