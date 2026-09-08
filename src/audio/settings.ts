export const SYSTEMS = {
  '2.0': ['FL', 'FR'], '2.1': ['FL', 'FR', 'LFE'],
  '4.0': ['FL', 'FR', 'SL', 'SR'], '4.1': ['FL', 'FR', 'LFE', 'SL', 'SR'],
  '5.1': ['FL', 'FR', 'C', 'LFE', 'SL', 'SR'],
  '7.1': ['FL', 'FR', 'C', 'LFE', 'SL', 'SR', 'BL', 'BR'],
  '7.2': ['FL', 'FR', 'C', 'LFE', 'SL', 'SR', 'BL', 'BR', 'LFE2'],
} as const;
export type System = keyof typeof SYSTEMS;
export type Trajectory = 'circle' | 'orbital' | 'pendulum';
export const TONE_HZ = [60, 170, 350, 1000, 3500, 6000, 12000];
export interface AdvancedSettings {
  system: System; trajectory: Trajectory; tone: number[]; dialogue: number;
  normalize: boolean; limiter: boolean; smartMono: boolean;
  centerHz: number; subHz: number; rearDelay: number; rearAmbience: number;
  rearDirect: boolean; rearInvert: boolean; splitBass: boolean;
  channelGains: number[]; routing: number[];
  fps: number; smoothing: number; silenceSave: boolean; silenceSeconds: number;
  remember: boolean; theme: 'auto' | 'dark' | 'light';
}
export const DEFAULT_ADVANCED: AdvancedSettings = {
  system: '2.0', trajectory: 'circle', tone: Array(7).fill(0), dialogue: 0,
  normalize: true, limiter: true, smartMono: false,
  centerHz: 120, subHz: 120, rearDelay: 20, rearAmbience: 0.25,
  rearDirect: false, rearInvert: false, splitBass: true,
  channelGains: Array(9).fill(1), routing: Array.from({ length: 9 }, (_, i) => i),
  fps: 30, smoothing: 0.8, silenceSave: true, silenceSeconds: 10,
  remember: true, theme: 'auto',
};
export function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
export function sanitizeAdvanced(value: unknown): AdvancedSettings {
  const x = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const d = DEFAULT_ADVANCED;
  const bool = (key: keyof AdvancedSettings) => typeof x[key] === 'boolean' ? x[key] as boolean : d[key] as boolean;
  const nums = (key: 'tone' | 'channelGains' | 'routing', min: number, max: number) => d[key].map((n, i) => bounded(Array.isArray(x[key]) ? x[key][i] : undefined, n, min, max));
  const used = new Set<number>();
  const routing = nums('routing', -1, 8).map(Math.round).map(n => {
    if (n < 0 || used.has(n)) return -1;
    used.add(n); return n;
  });
  return {
    system: typeof x.system === 'string' && Object.hasOwnProperty.call(SYSTEMS, x.system) ? x.system as System : d.system,
    trajectory: ['circle', 'orbital', 'pendulum'].includes(String(x.trajectory)) ? x.trajectory as Trajectory : d.trajectory,
    tone: nums('tone', -12, 12), dialogue: bounded(x.dialogue, 0, 0, 1),
    normalize: bool('normalize'), limiter: bool('limiter'), smartMono: bool('smartMono'),
    centerHz: bounded(x.centerHz, 120, 40, 1000), subHz: bounded(x.subHz, 120, 40, 250),
    rearDelay: bounded(x.rearDelay, 20, 0, 100), rearAmbience: bounded(x.rearAmbience, 0.25, 0, 1),
    rearDirect: bool('rearDirect'), rearInvert: bool('rearInvert'), splitBass: bool('splitBass'),
    channelGains: nums('channelGains', 0, 2), routing,
    fps: [0, 15, 30, 60].includes(Number(x.fps)) ? Number(x.fps) : 30,
    smoothing: bounded(x.smoothing, 0.8, 0, 0.95), silenceSave: bool('silenceSave'),
    silenceSeconds: bounded(x.silenceSeconds, 10, 2, 60), remember: bool('remember'),
    theme: ['auto', 'dark', 'light'].includes(String(x.theme)) ? x.theme as AdvancedSettings['theme'] : 'auto',
  };
}
export function loadAdvanced(): AdvancedSettings {
  try { return sanitizeAdvanced(JSON.parse(localStorage.getItem('xql_advanced_audio') || '{}')); } catch { return sanitizeAdvanced({}); }
}
export function saveAdvanced(value: AdvancedSettings) {
  try {
    localStorage.setItem('xql_advanced_audio', JSON.stringify(value.remember ? value : { remember: false, theme: value.theme }));
  } catch { /* Playback must work even if storage is unavailable. */ }
}
