import { useState, useRef, useCallback } from 'react';
import { getEqEnabled, setEqEnabled as saveEqEnabled, getEqGains, setEqGains as saveEqGains, getEqPreset, setEqPreset as saveEqPreset } from '../utils/storage';

export const EQ_FREQUENCIES = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160,
  200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
  2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
];

export const EQ_LABELS = [
  '20', '25', '31', '40', '50', '63', '80', '100', '125', '160',
  '200', '250', '315', '400', '500', '630', '800', '1k', '1.25k', '1.6k',
  '2k', '2.5k', '3.15k', '4k', '5k', '6.3k', '8k', '10k', '12.5k', '16k', '20k',
];

export interface EqPreset {
  name: string;
  label: string;
  /** One line on the house sound; shown as the preset button tooltip. */
  hint: string;
  gains: number[];
}

// House-curve presets.
//
// These are voicing curves, not measurements. Each one shapes a neutral in-ear
// towards the way that brand's own earphones sound in their default mode - no
// companion app, no EQ - following the published deviation of their stock tuning
// from the Harman in-ear target. They approximate a house sound, not any one
// model: a brand's line-up varies, and so does every ear canal.
//
// The slider values are smaller than the acoustic result on purpose. 31 bands at
// 1/3-octave spacing overlap, so a run of equal sliders sums to roughly 1.5x what
// each slider says; the numbers below are written so the summed response lands
// where the house curve actually sits.
export const EQ_PRESETS: EqPreset[] = [
  { name: 'flat', label: '平坦', hint: '不做任何补偿，直出音源本身', gains: Array(31).fill(0) },

  { name: 'harman_ie', label: '哈曼 IE', hint: '哈曼入耳目标曲线：盲测偏好度最高的中性基准', gains: [
    3.5, 3.4, 3.2, 3.0, 2.7, 2.4, 2.0, 1.6, 1.2, 0.8,
    0.4, 0.1, 0, 0, 0, 0, 0.2, 0.4, 0.8, 1.2,
    1.6, 1.8, 1.4, 0.4, -0.8, -1.2, -1.0, -0.4, 0.2, 0.6, 0.8,
  ]},

  { name: 'sony', label: '索尼', hint: 'WF-1000XM 系默认：厚重超低频，8k 以上带亮泽', gains: [
    5.5, 5.4, 5.2, 4.8, 4.4, 4.0, 3.4, 2.6, 1.8, 1.0,
    0.4, 0, -0.4, -0.6, -0.6, -0.4, 0, 0.2, 0.4, 0.6,
    0.6, 0.4, -0.4, -1.0, -0.6, 0.4, 1.6, 2.2, 2.0, 1.4, 1.0,
  ]},

  { name: 'bose', label: 'Bose', hint: '消噪耳塞默认：温暖饱满，高频收得最干净', gains: [
    4.5, 4.4, 4.2, 4.0, 3.6, 3.2, 2.6, 2.0, 1.4, 0.8,
    0.4, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.6, 0.8, 1.0,
    1.2, 1.2, 0.8, 0, -1.2, -2.0, -2.4, -2.0, -1.4, -1.0, -0.8,
  ]},

  { name: 'airpods', label: 'AirPods', hint: 'AirPods Pro 默认：贴近哈曼，人声清晰不刺', gains: [
    3.0, 3.0, 2.8, 2.6, 2.4, 2.2, 1.8, 1.4, 1.0, 0.6,
    0.2, 0, 0, 0, 0, 0.2, 0.4, 0.6, 1.0, 1.4,
    1.8, 2.0, 1.6, 0.6, -0.6, -1.4, -1.2, -0.6, -0.2, -0.8, -1.4,
  ]},

  { name: 'apple_music', label: 'Apple Music', hint: 'Apple Music 流行听感：轻低频、人声清晰、上高频克制（非官方曲线）', gains: [
    2.2, 2.2, 2.1, 2.0, 1.8, 1.6, 1.3, 1.0, 0.7, 0.4,
    0.2, 0, 0, 0, 0, 0.1, 0.3, 0.5, 0.8, 1.1,
    1.4, 1.6, 1.3, 0.5, -0.3, -0.9, -1.0, -0.6, -0.2, 0.1, 0.2,
  ]},

  { name: 'sennheiser', label: '森海塞尔', hint: '中性偏暖的监听底子，齿音收敛、空气感保留', gains: [
    2.5, 2.4, 2.2, 2.0, 1.8, 1.6, 1.4, 1.2, 0.8, 0.4,
    0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.6, 0.8, 1.0,
    1.0, 1.0, 0.6, 0, -0.8, -1.2, -0.8, 0, 0.6, 1.0, 1.2,
  ]},

  { name: 'beats', label: 'Beats', hint: '低频最猛，中低频下凹，人声推前', gains: [
    7.0, 6.8, 6.5, 6.0, 5.5, 5.0, 4.2, 3.2, 2.2, 1.2,
    0.2, -0.6, -1.2, -1.6, -1.6, -1.2, -0.6, 0, 0.8, 1.6,
    2.2, 2.6, 2.2, 1.2, -0.4, -1.2, -1.0, -0.2, 0.6, 1.0, 0.8,
  ]},

  { name: 'akg', label: '三星 AKG', hint: 'Galaxy Buds 默认：均衡底子加上中频解析', gains: [
    2.8, 2.7, 2.6, 2.4, 2.2, 2.0, 1.6, 1.2, 0.8, 0.4,
    0.2, 0, 0, 0, 0, 0.2, 0.4, 0.8, 1.2, 1.8,
    2.2, 2.4, 2.0, 1.2, 0.4, -0.4, -0.6, 0, 0.6, 1.0, 1.0,
  ]},

  { name: 'jbl', label: 'JBL', hint: '典型 V 型：低频弹、高频闪，听流行最讨好', gains: [
    6.0, 5.9, 5.6, 5.2, 4.8, 4.4, 3.6, 2.8, 1.8, 1.0,
    0.4, 0, -0.4, -0.6, -0.6, -0.2, 0.2, 0.6, 1.0, 1.6,
    2.0, 2.2, 1.8, 0.8, -0.4, -0.2, 1.0, 2.0, 2.2, 1.6, 1.0,
  ]},

  { name: 'xiaomi', label: '小米', hint: '中低频量感突出，5–8k 提亮，通勤向听感', gains: [
    4.0, 4.2, 4.4, 4.6, 4.6, 4.4, 4.0, 3.2, 2.2, 1.2,
    0.4, 0, -0.4, -0.8, -1.0, -1.0, -0.8, -0.6, -0.2, 0.4,
    1.0, 1.4, 1.4, 1.0, 1.2, 1.8, 2.0, 1.6, 1.0, 0.6, 0.4,
  ]},

  { name: 'huawei', label: '华为', hint: 'FreeBuds 默认：温润耐听，齿音压得住', gains: [
    4.0, 3.9, 3.7, 3.4, 3.1, 2.8, 2.3, 1.8, 1.2, 0.6,
    0.2, 0, 0, 0, 0, 0.2, 0.4, 0.6, 0.8, 1.2,
    1.4, 1.6, 1.2, 0.4, -0.6, -1.2, -1.0, -0.2, 0.6, 1.0, 1.0,
  ]},

  { name: 'shure', label: '舒尔', hint: 'SE 系监听：中频前置、高频最暗，久听不累', gains: [
    2.0, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.2, 1.0,
    0.8, 0.8, 0.8, 1.0, 1.2, 1.2, 1.2, 1.0, 0.8, 0.6,
    0.4, 0, -0.6, -1.4, -2.4, -3.0, -3.4, -3.0, -2.6, -2.4, -2.4,
  ]},

  { name: 'audiotechnica', label: '铁三角', hint: '偏亮偏解析，上中频与高频前置，女声见长', gains: [
    3.0, 2.9, 2.8, 2.6, 2.4, 2.2, 1.8, 1.4, 0.8, 0.2,
    -0.2, -0.4, -0.4, -0.2, 0, 0.2, 0.6, 1.0, 1.4, 2.0,
    2.4, 2.6, 2.4, 1.6, 1.0, 1.4, 2.0, 2.2, 2.0, 1.6, 1.2,
  ]},

  { name: 'beyerdynamic', label: '拜亚动力', hint: '低频精瘦、8–10k 明显抬升的经典亮声', gains: [
    2.0, 2.0, 1.9, 1.8, 1.6, 1.4, 1.2, 0.8, 0.4, 0,
    -0.2, -0.4, -0.4, -0.4, -0.2, 0, 0.2, 0.6, 1.0, 1.4,
    1.8, 2.0, 1.8, 1.2, 1.0, 1.8, 3.0, 3.4, 3.0, 2.2, 1.6,
  ]},

  { name: 'bo', label: 'B&O', hint: '低频克制、中频顺滑，高频留一点空气感', gains: [
    3.4, 3.3, 3.1, 2.9, 2.6, 2.3, 1.9, 1.5, 1.0, 0.6,
    0.2, 0, 0, 0, 0, 0.2, 0.4, 0.6, 0.8, 1.0,
    1.2, 1.4, 1.2, 0.6, -0.4, -0.8, -0.4, 0.4, 1.2, 1.6, 1.6,
  ]},
];

// 1/3-octave band Q: BW = 1/3 octave -> Q = sqrt(2^(1/3)) / (2^(1/3) - 1) ~= 4.32
export const EQ_Q = 4.32;

const DEFAULT_GAINS = Array(31).fill(0);

// Estimate the summed response of the whole cascade at each band centre.
// Neighbouring 1/3-octave bells overlap, so a run of +4 dB sliders really
// delivers about +6 dB; the weights are the bell's response one and two bands
// away at Q = 4.32.
const SKIRT_1 = 0.22;
const SKIRT_2 = 0.06;

// The skirt estimate tracks the real cascade to within 0.15 dB across every
// preset, but it can land just under; half a dB of margin keeps even the
// heaviest curve from touching full scale on its own. Only applied when
// something is actually boosted, so a flat EQ stays at unity.
const PREAMP_SAFETY_DB = 0.5;

export function preampGainFor(gains: number[], isEnabled: boolean): number {
  if (!isEnabled) return 1;
  const boost = estimatePeakBoostDb(gains);
  if (boost <= 0) return 1;
  return Math.pow(10, -(boost + PREAMP_SAFETY_DB) / 20);
}

export function estimatePeakBoostDb(gains: number[]): number {
  let peak = 0;
  for (let i = 0; i < gains.length; i++) {
    const sum =
      gains[i] +
      SKIRT_1 * ((gains[i - 1] ?? 0) + (gains[i + 1] ?? 0)) +
      SKIRT_2 * ((gains[i - 2] ?? 0) + (gains[i + 2] ?? 0));
    if (sum > peak) peak = sum;
  }
  return peak;
}

export function useEqualizer() {
  const [gains, setGains] = useState<number[]>(() => getEqGains() || DEFAULT_GAINS);
  const [enabled, setEnabledState] = useState(() => getEqEnabled());
  const [bypassed, setBypassedState] = useState(false);
  const [preset, setPresetState] = useState(() => getEqPreset());
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const preampRef = useRef<GainNode | null>(null);
  const bypassRef = useRef(false);

  // Every house curve boosts something, and the loudest of them adds more than
  // 10 dB. Without a matching preamp cut that lands straight in the limiter and
  // the track pumps for the whole song - which is exactly what an in-ear reveals
  // worst.
  const applyPreamp = useCallback((activeGains: number[], isEnabled: boolean) => {
    const node = preampRef.current;
    if (!node) return;
    node.gain.setTargetAtTime(preampGainFor(activeGains, isEnabled), node.context.currentTime, 0.03);
  }, []);

  const createFilters = useCallback((ctx: AudioContext): BiquadFilterNode[] => {
    if (filtersRef.current.length > 0) return filtersRef.current;
    const currentGains = getEqGains() || DEFAULT_GAINS;
    const isEnabled = getEqEnabled() && !bypassRef.current;
    const filters = EQ_FREQUENCIES.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      // 1/3-octave spacing needs Q ~4.3. At the old Q of 1.414 each filter was
      // nearly an octave wide, so neighbouring bands piled up and a +6 dB slider
      // actually delivered about +24 dB.
      filter.Q.value = EQ_Q;
      filter.gain.value = isEnabled ? currentGains[i] : 0;
      return filter;
    });
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1]);
    }
    filtersRef.current = filters;
    return filters;
  }, []);

  const createPreamp = useCallback((ctx: AudioContext): GainNode => {
    if (!preampRef.current) {
      const node = ctx.createGain();
      node.gain.value = preampGainFor(getEqGains() || DEFAULT_GAINS, getEqEnabled());
      preampRef.current = node;
    }
    return preampRef.current;
  }, []);

  const setBandGain = useCallback((index: number, gain: number) => {
    const clamped = Math.max(-20, Math.min(20, gain));
    setGains(prev => {
      const next = [...prev];
      next[index] = clamped;
      saveEqGains(next);
      if (enabled && !bypassed) applyPreamp(next, true);
      return next;
    });
    if (filtersRef.current[index] && enabled && !bypassed) {
      filtersRef.current[index].gain.value = clamped;
    }
    setPresetState('custom');
    saveEqPreset('custom');
  }, [enabled, bypassed, applyPreamp]);

  const reset = useCallback(() => {
    setGains(DEFAULT_GAINS);
    saveEqGains(DEFAULT_GAINS);
    setPresetState('flat');
    saveEqPreset('flat');
    filtersRef.current.forEach(f => { f.gain.value = 0; });
    applyPreamp(DEFAULT_GAINS, enabled && !bypassed);
  }, [applyPreamp, enabled, bypassed]);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    saveEqEnabled(on);
    bypassRef.current = false;
    setBypassedState(false);
    const stored = getEqGains() || DEFAULT_GAINS;
    const active = on ? stored : DEFAULT_GAINS;
    filtersRef.current.forEach((f, i) => {
      f.gain.value = active[i];
    });
    applyPreamp(stored, on);
  }, [applyPreamp]);

  const applyPreset = useCallback((presetName: string) => {
    const p = EQ_PRESETS.find(pr => pr.name === presetName);
    if (!p) return;
    setGains([...p.gains]);
    saveEqGains(p.gains);
    setPresetState(presetName);
    saveEqPreset(presetName);
    if (enabled && !bypassed) {
      filtersRef.current.forEach((f, i) => {
        f.gain.value = p.gains[i];
      });
    }
    applyPreamp(p.gains, enabled && !bypassed);
  }, [enabled, bypassed, applyPreamp]);

  const setBypassed = useCallback((on: boolean) => {
    bypassRef.current = on;
    setBypassedState(on);
    const stored = getEqGains() || DEFAULT_GAINS;
    const active = enabled && !on;
    filtersRef.current.forEach((filter, index) => {
      filter.gain.value = active ? stored[index] : 0;
    });
    applyPreamp(stored, active);
  }, [enabled, applyPreamp]);

  const setCurve = useCallback((values: number[], on: boolean) => {
    const curve = Array.from({ length: 31 }, (_, i) => Number.isFinite(values[i]) ? Math.max(-20, Math.min(20, values[i])) : 0);
    setGains(curve); saveEqGains(curve); setPresetState('custom'); saveEqPreset('custom');
    setEnabled(on); saveEqEnabled(on); setBypassedState(false); bypassRef.current = false;
    filtersRef.current.forEach((f, i) => { f.gain.value = on ? curve[i] : 0; });
    applyPreamp(curve, on);
  }, [setEnabled, applyPreamp]);

  return {
    gains, enabled, bypassed, preset, filtersRef, preampRef,
    createFilters, createPreamp, setBandGain, reset, setEnabled, setBypassed, applyPreset, setCurve,
  };
}
