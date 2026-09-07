import { SEARCH_HISTORY_MAX } from '../config';

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
} as const;

export function clearLegacyAuthData(): void {
  localStorage.removeItem('xql_user');
  localStorage.removeItem('xql_accounts');
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
  const raw = localStorage.getItem(KEYS.GAIN_MULTIPLIER);
  return raw ? parseFloat(raw) : 1.0;
}

export function setGainMultiplier(gain: number): void {
  localStorage.setItem(KEYS.GAIN_MULTIPLIER, String(gain));
}

export type SpatialMode = 'off' | 'wide' | 'mono';

export function getSpatialMode(): SpatialMode {
  const mode = localStorage.getItem(KEYS.SPATIAL_MODE);
  return mode === 'wide' || mode === 'mono' ? mode : 'off';
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
