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

// Storage can be switched off, full or blocked (private windows, site data
// settings). Reads then act as if nothing was saved and writes are dropped:
// the player keeps working with what it has in memory.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function getRegisteredUsername(): string | null {
  const username = read(KEYS.USERNAME);
  return username && /^\d{11}$/.test(username) ? username : null;
}

export function registerUsername(username: string): boolean {
  if (!/^\d{11}$/.test(username)) return false;
  write(KEYS.USERNAME, username);
  return true;
}

function favoritesKey(username: string): string {
  return `xql_favorites_${username}`;
}

export function getFavorites(username: string): Song[] {
  if (!/^\d{11}$/.test(username)) return [];
  try {
    const value = JSON.parse(read(favoritesKey(username)) || '[]');
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
  write(favoritesKey(username), JSON.stringify(songs.slice(0, 500)));
}

export function getSearchHistory(): string[] {
  const raw = read(KEYS.SEARCH_HISTORY);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      .map((item) => item.slice(0, 100)).slice(0, SEARCH_HISTORY_MAX);
  } catch {
    return [];
  }
}

export function addSearchHistory(keyword: string): void {
  const history = getSearchHistory().filter((h) => h !== keyword);
  history.unshift(keyword.slice(0, 100));
  history.length = Math.min(history.length, SEARCH_HISTORY_MAX);
  write(KEYS.SEARCH_HISTORY, JSON.stringify(history));
}

export function clearSearchHistory(): void {
  remove(KEYS.SEARCH_HISTORY);
}

export function getVolume(): number {
  return getBoundedNumber(KEYS.VOLUME, 0.8, 0, 1);
}

export function setVolume(vol: number): void {
  if (Number.isFinite(vol)) write(KEYS.VOLUME, String(Math.max(0, Math.min(1, vol))));
}

const PLAY_MODES = ['sequential', 'repeat-one', 'shuffle'];

export function getPlayMode(): string {
  const mode = read(KEYS.PLAY_MODE);
  return mode && PLAY_MODES.includes(mode) ? mode : 'sequential';
}

export function setPlayMode(mode: string): void {
  write(KEYS.PLAY_MODE, mode);
}

// Crossfeed strength. In-ear monitors are the worst case for headphone
// listening: sealed in the canal, they leak nothing across to the other ear, so
// hard-panned material collapses into two points inside the head. Medium is the
// default because it is the amount that relieves that without audibly narrowing
// the image. An explicit choice, once made, is still respected.
export type CrossfeedMode = 'off' | 'light' | 'medium' | 'strong';

const CROSSFEED_MODES: CrossfeedMode[] = ['off', 'light', 'medium', 'strong'];

export function getCrossfeedMode(): CrossfeedMode {
  const raw = read(KEYS.CROSSFEED);
  if (raw && (CROSSFEED_MODES as string[]).includes(raw)) return raw as CrossfeedMode;
  // Migrate the old on/off flag.
  const legacy = read(KEYS.SPATIAL_AUDIO);
  return legacy === 'true' ? 'medium' : 'off';
}

export function setCrossfeedMode(mode: CrossfeedMode): void {
  write(KEYS.CROSSFEED, mode);
  write(KEYS.SPATIAL_AUDIO, String(mode !== 'off'));
}

// De-essing changes the high-frequency content of every track. Keep it opt-in
// so a clean recording or a neutral headphone is not processed unnecessarily.
export function getDeEsser(): boolean {
  const raw = read(KEYS.DEESSER);
  return raw === 'true';
}

export function setDeEsser(enabled: boolean): void {
  write(KEYS.DEESSER, String(enabled));
}

// Equal-loudness compensation intentionally colours the mix, so leave it to
// listeners who prefer it at lower volumes instead of applying it by default.
export function getLoudnessComp(): boolean {
  const raw = read(KEYS.LOUDNESS_COMP);
  return raw === 'true';
}

export function setLoudnessComp(enabled: boolean): void {
  write(KEYS.LOUDNESS_COMP, String(enabled));
}

// Which transducer the chain is being voiced for. Headphone is the default -
// this is a web player, so most listening happens on in-ears - but a laptop or
// a desk speaker needs the opposite treatment: no crossfeed (the room already
// does that), no de-esser aimed at a canal resonance that is not there, and a
// cabinet voicing instead.
export type OutputMode = 'headphone' | 'speaker';

export function getOutputMode(): OutputMode {
  return read(KEYS.OUTPUT_MODE) === 'speaker' ? 'speaker' : 'headphone';
}

export function setOutputMode(mode: OutputMode): void {
  write(KEYS.OUTPUT_MODE, mode);
}

export function getGainMultiplier(): number {
  const raw = Number.parseFloat(read(KEYS.GAIN_MULTIPLIER) || '1');
  return Number.isFinite(raw) ? Math.max(0, Math.min(2, raw)) : 1;
}

export function setGainMultiplier(gain: number): void {
  write(KEYS.GAIN_MULTIPLIER, String(Math.max(0, Math.min(2, gain))));
}

export type SpatialMode = 'off' | 'wide' | 'mono';

export function getSpatialMode(): SpatialMode {
  const mode = read(KEYS.SPATIAL_MODE);
  // Migrate the removed phase-widening mode to neutral stereo.
  return mode === 'mono' ? mode : 'off';
}

export function setSpatialMode(mode: SpatialMode): void {
  write(KEYS.SPATIAL_MODE, mode);
}

export function getNightMode(): boolean {
  return read(KEYS.NIGHT_MODE) === 'true';
}

export function setNightMode(enabled: boolean): void {
  write(KEYS.NIGHT_MODE, String(enabled));
}

export function getBalance(): number {
  const value = Number.parseFloat(read(KEYS.BALANCE) || '0');
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

export function setBalance(value: number): void {
  write(KEYS.BALANCE, String(Math.max(-1, Math.min(1, value))));
}

export function getVirtual8d(): boolean {
  return read(KEYS.VIRTUAL_8D) === 'true';
}

export function setVirtual8d(enabled: boolean): void {
  write(KEYS.VIRTUAL_8D, String(enabled));
}

function getBoundedNumber(key: string, fallback: number, min: number, max: number): number {
  const value = Number.parseFloat(read(key) || '');
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

export function getVirtual8dSpeed(): number {
  return getBoundedNumber(KEYS.VIRTUAL_8D_SPEED, 0.075, 0.04, 0.12);
}

export function setVirtual8dSpeed(value: number): void {
  write(KEYS.VIRTUAL_8D_SPEED, String(Math.max(0.04, Math.min(0.12, value))));
}

export function getVirtual8dDepth(): number {
  return getBoundedNumber(KEYS.VIRTUAL_8D_DEPTH, 0.7, 0.25, 0.85);
}

export function setVirtual8dDepth(value: number): void {
  write(KEYS.VIRTUAL_8D_DEPTH, String(Math.max(0.25, Math.min(0.85, value))));
}

export function getEqEnabled(): boolean {
  return read(KEYS.EQ_ENABLED) === 'true';
}

export function setEqEnabled(enabled: boolean): void {
  write(KEYS.EQ_ENABLED, String(enabled));
}

export function getEqGains(): number[] | null {
  const raw = read(KEYS.EQ_GAINS);
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length !== 31) return null;
    if (!arr.every((g) => typeof g === 'number' && Number.isFinite(g))) return null;
    return arr.map((g: number) => Math.max(-20, Math.min(20, g)));
  } catch {
    return null;
  }
}

export function setEqGains(gains: number[]): void {
  write(KEYS.EQ_GAINS, JSON.stringify(gains));
}

export function getEqPreset(): string {
  const preset = read(KEYS.EQ_PRESET);
  return preset && /^[\w-]{1,40}$/.test(preset) ? preset : 'flat';
}

export function setEqPreset(preset: string): void {
  write(KEYS.EQ_PRESET, preset);
}
