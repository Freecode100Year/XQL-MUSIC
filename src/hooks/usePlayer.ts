import { useState, useRef, useCallback, useEffect } from 'react';
import { Song, SongDetail, PlayMode } from '../types';
import { API, CACHE_TTL } from '../config';
import { requestCache } from '../utils/cache';
import {
  getVolume, setVolume as saveVolume,
  getPlayMode, setPlayMode as savePlayMode,
  getCrossfeedMode, setCrossfeedMode as saveCrossfeedMode, CrossfeedMode,
  getDeEsser, setDeEsser as saveDeEsser,
  getLoudnessComp, setLoudnessComp as saveLoudnessComp,
  getOutputMode, setOutputMode as saveOutputMode, OutputMode,
  getGainMultiplier, setGainMultiplier as saveGainMultiplier,
  getSpatialMode, setSpatialMode as saveSpatialMode, SpatialMode,
  getNightMode, setNightMode as saveNightMode,
  getBalance, setBalance as saveBalance,
  getVirtual8d, setVirtual8d as saveVirtual8d,
  getVirtual8dSpeed, setVirtual8dSpeed as saveVirtual8dSpeed,
  getVirtual8dDepth, setVirtual8dDepth as saveVirtual8dDepth,
} from '../utils/storage';
import { useI18n } from '../i18n';
import { AdvancedSettings, loadAdvanced, saveAdvanced, sanitizeAdvanced, SYSTEMS } from '../audio/settings';
import { AdvancedAudio } from '../audio/advanced';
import { SpatialOrbit } from '../audio/orbit';

interface EqualizerBridge {
  filtersRef: React.MutableRefObject<BiquadFilterNode[]>;
  preampRef: React.MutableRefObject<GainNode | null>;
  createFilters: (ctx: AudioContext) => BiquadFilterNode[];
  createPreamp: (ctx: AudioContext) => GainNode;
}

const CROSSFEED_ORDER: CrossfeedMode[] = ['off', 'light', 'medium', 'strong'];

// Bauer/Meier crossfeed settings. A lower corner and a hotter cross feed the far
// ear more, which pulls a hard-panned mix further out of the middle of the head
// at the cost of some width.
//
// compFreq/compDb undo the centre-image boost that adding a cross copy causes.
// The obvious choice - a shelf of -20*log10(1+level) sitting on the direct path
// at the crossfeed corner - is wrong: the lowpass contributes ~90 degrees of
// phase at its corner, so direct and cross do not add arithmetically there, and
// the centre image ends up with 1.5 to 4 dB of ripple right through the vocal
// range. Compensating the merged output instead, with a shelf whose corner and
// depth were solved numerically per mode, holds the ripple to 0.5-1.1 dB.
// See scripts/verify-audio-chain.mjs.
const CROSSFEED_PARAMS: Record<
  Exclude<CrossfeedMode, 'off'>,
  { cutoff: number; level: number; compFreq: number; compDb: number }
> = {
  light: { cutoff: 800, level: 0.25, compFreq: 520, compDb: -2.35 },
  medium: { cutoff: 700, level: 0.40, compFreq: 470, compDb: -3.65 },
  strong: { cutoff: 620, level: 0.55, compFreq: 430, compDb: -4.80 },
};

// De-esser crossover. An in-ear seals the canal, which moves its main resonance
// up to roughly 6-8 kHz and puts it right on top of the sibilance that 320 kbps
// encoding already roughens. Splitting there and compressing only the top lets
// the band breathe when there is nothing harsh to catch.
const DEESS_CROSSOVER_HZ = 5500;

// Marshall's powered cabinets, tone controls centred: a big low shelf for the
// thump, a scoop where the box would otherwise sound boxy, a presence lift that
// gives guitars and vocals their bite, and a deliberately smooth top. Applied as
// its own block so it stacks on top of whatever the 31-band EQ is set to.
const MARSHALL_VOICING: Array<{
  type: BiquadFilterType; freq: number; q: number; gain: number;
}> = [
  { type: 'lowshelf', freq: 90, q: 0.707, gain: 4.5 },
  { type: 'peaking', freq: 160, q: 1.0, gain: 2.0 },
  { type: 'peaking', freq: 400, q: 1.2, gain: -1.5 },
  { type: 'peaking', freq: 1200, q: 1.0, gain: 1.0 },
  { type: 'peaking', freq: 3200, q: 1.4, gain: 2.5 },
  { type: 'peaking', freq: 6500, q: 1.5, gain: -1.5 },
  { type: 'highshelf', freq: 11000, q: 0.707, gain: -2.0 },
];
// Trim that keeps the voicing's own boost out of the limiter.
const MARSHALL_TRIM = Math.pow(10, -5 / 20);

// Subsonic cut. Headphones reproduce rumble faithfully and it does nothing but
// eat headroom; a speaker cannot reproduce it at all and just distorts trying.
const SUBSONIC_HZ = { headphone: 20, speaker: 55 };

// iOS/iPadOS suspends an AudioContext when Safari is backgrounded or the screen
// is locked. Once a media element is connected to a MediaElementAudioSourceNode,
// its native output is muted in favour of that context, so the stream can no
// longer keep playing. Android browsers are more permissive, but using the
// native media path there too gives the most consistent lock-screen behaviour.
// Keep the rich Web Audio chain for desktops and let phones/tablets use the
// HTMLMediaElement's system-integrated output instead.
const needsNativeBackgroundAudio = () => {
  const ua = navigator.userAgent;
  const isIPadDesktopUA = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod/i.test(ua) || isIPadDesktopUA;
};

const setMediaSessionAction = (
  action: MediaSessionAction,
  handler: MediaSessionActionHandler,
) => {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Each browser exposes a different subset of Media Session actions. One
    // unsupported action must not prevent the remaining lock-screen controls.
  }
};

export function usePlayer(
  addToast: (text: string, type?: 'success' | 'error' | 'info') => void,
  equalizer: EqualizerBridge,
) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const volumeGainRef = useRef<GainNode | null>(null);
  const envGainRef = useRef<GainNode | null>(null);
  const highpassRef = useRef<BiquadFilterNode | null>(null);
  const webAudioActiveRef = useRef(false);
  const topologyRef = useRef<string | null>(null);
  const mediaActionsRef = useRef<{ next: () => void; prev: () => void; pause: () => void }>({
    next: () => {}, prev: () => {}, pause: () => {},
  });
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playRequestRef = useRef(0);
  const songUrlRequestsRef = useRef(new Map<string, Promise<string | null>>());
  const failureSkipRef = useRef<() => boolean>(() => false);
  const autoSkipInFlightRef = useRef(false);
  const failedTrackCountRef = useRef(0);

  const crossfeedRef = useRef<{
    splitter: ChannelSplitterNode;
    merger: ChannelMergerNode;
    lpL: BiquadFilterNode;
    lpR: BiquadFilterNode;
    crossL: GainNode;
    crossR: GainNode;
    comp: BiquadFilterNode;
    output: GainNode;
  } | null>(null);
  const deEsserRef = useRef<{
    input: GainNode;
    lowA: BiquadFilterNode;
    lowB: BiquadFilterNode;
    highA: BiquadFilterNode;
    highB: BiquadFilterNode;
    comp: DynamicsCompressorNode;
    output: GainNode;
  } | null>(null);
  const voicingRef = useRef<{ input: BiquadFilterNode; output: GainNode } | null>(null);
  const contourRef = useRef<{ low: BiquadFilterNode; high: BiquadFilterNode } | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const nightCompressorRef = useRef<DynamicsCompressorNode | null>(null);
  const spatialRef = useRef<{
    input: GainNode;
    output: GainNode;
    leftDirect: GainNode;
    leftCross: GainNode;
    rightDirect: GainNode;
    rightCross: GainNode;
  } | null>(null);
  const virtual8dRef = useRef<SpatialOrbit | null>(null);
  const advancedRef = useRef<AdvancedAudio | null>(null);
  const [advanced, setAdvancedState] = useState(loadAdvanced);
  const advancedSettingsRef = useRef(advanced);
  const processingRef = useRef(!needsNativeBackgroundAudio());
  const [processingEnabled, setProcessingState] = useState(processingRef.current);
  const [audioRevision, setAudioRevision] = useState(0);
  const [hardwareChannels, setHardwareChannels] = useState(2);
  const [activeChannels, setActiveChannels] = useState(2);
  const loudnessGainRef = useRef<GainNode | null>(null);
  const meterRef = useRef<{ shelf: BiquadFilterNode; hp: BiquadFilterNode; analyser: AnalyserNode } | null>(null);
  const loudnessTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [songDetail, setSongDetail] = useState<SongDetail | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(getVolume());
  const [playMode, setPlayModeState] = useState<PlayMode>(getPlayMode() as PlayMode);
  const [crossfeedMode, setCrossfeedModeState] = useState<CrossfeedMode>(getCrossfeedMode());
  const [deEsser, setDeEsserState] = useState(getDeEsser());
  const [loudnessComp, setLoudnessCompState] = useState(getLoudnessComp());
  const [outputMode, setOutputModeState] = useState<OutputMode>(getOutputMode());
  const [gainMultiplier, setGainMultiplierState] = useState(getGainMultiplier());
  const [spatialMode, setSpatialModeState] = useState<SpatialMode>(getSpatialMode());
  const [nightMode, setNightModeState] = useState(getNightMode());
  const [balance, setBalanceState] = useState(getBalance());
  const [virtual8d, setVirtual8dState] = useState(getVirtual8d());
  const [virtual8dSpeed, setVirtual8dSpeedState] = useState(getVirtual8dSpeed());
  const [virtual8dDepth, setVirtual8dDepthState] = useState(getVirtual8dDepth());
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  // Everything the audio graph needs is mirrored into refs. The graph used to be
  // rebuilt from an effect whose dependency list included the equalizer bridge
  // object, which React re-creates on every render - so with `timeupdate` firing
  // four times a second the whole chain was being disconnected and reconnected
  // mid-playback, several times per second.
  const volumeRef = useRef(volume);
  const gainMultiplierRef = useRef(gainMultiplier);
  const crossfeedRefMode = useRef(crossfeedMode);
  const deEsserModeRef = useRef(deEsser);
  const loudnessCompRef = useRef(loudnessComp);
  const outputModeRef = useRef(outputMode);
  const spatialModeRef = useRef(spatialMode);
  const balanceRef = useRef(balance);
  const virtual8dSpeedRef = useRef(virtual8dSpeed);
  const virtual8dDepthRef = useRef(virtual8dDepth);
  const equalizerRef = useRef(equalizer);
  equalizerRef.current = equalizer;

  const disconnectSafe = useCallback((node: AudioNode) => {
    try { node.disconnect(); } catch {}
  }, []);

  const ensureGainNode = useCallback((ctx: AudioContext) => {
    if (!gainNodeRef.current) {
      gainNodeRef.current = ctx.createGain();
      gainNodeRef.current.gain.value = gainMultiplierRef.current;
    }
    return gainNodeRef.current;
  }, []);

  const ensureVolumeGain = useCallback((ctx: AudioContext) => {
    if (!volumeGainRef.current) {
      volumeGainRef.current = ctx.createGain();
      // Perceptual taper: a linear slider spends most of its travel in a range
      // that already sounds like full volume. Squaring puts the halfway point at
      // -12 dB, which is roughly where "half as loud" actually is.
      volumeGainRef.current.gain.value = volumeRef.current * volumeRef.current;
    }
    return volumeGainRef.current;
  }, []);

  // Short ramp applied around every start, stop and track change. Switching an
  // audio element's source mid-waveform is a step discontinuity, and a step is a
  // click - inaudible on a laptop speaker, unmistakable in a sealed in-ear.
  const ensureEnvGain = useCallback((ctx: AudioContext) => {
    if (!envGainRef.current) {
      envGainRef.current = ctx.createGain();
      envGainRef.current.gain.value = 1;
    }
    return envGainRef.current;
  }, []);

  const fadeEnv = useCallback((target: number, ms: number) => {
    const ctx = audioCtxRef.current;
    const env = envGainRef.current;
    if (!ctx || !env) return;
    const now = ctx.currentTime;
    env.gain.cancelScheduledValues(now);
    env.gain.setValueAtTime(env.gain.value, now);
    if (ms <= 0) {
      env.gain.setValueAtTime(target, now);
    } else {
      env.gain.linearRampToValueAtTime(target, now + ms / 1000);
    }
  }, []);

  // Toggling the de-esser or the output mode changes the shape of the graph, and
  // re-routing mid-waveform clicks just like a source swap does. Duck across it.
  const duckThroughRebuild = useCallback(() => {
    if (!webAudioActiveRef.current) return;
    fadeEnv(0, 25);
    setTimeout(() => fadeEnv(1, 70), 90);
  }, [fadeEnv]);

  const ensureHighpass = useCallback((ctx: AudioContext) => {
    if (!highpassRef.current) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = SUBSONIC_HZ[outputModeRef.current];
      hp.Q.value = 0.707;
      highpassRef.current = hp;
    }
    return highpassRef.current;
  }, []);

  // Headphone crossfeed (Bauer/Meier style).
  //
  // Headphones deliver each channel to one ear only, which never happens with
  // real sources - some of the left signal always reaches the right ear, low-passed
  // by head shadowing and delayed by the extra path around the head. Feeding a
  // filtered, delayed copy across restores that and relieves the in-head
  // localisation that makes wide mixes tiring.
  //
  // The cross gain must stay positive: a phase-inverted copy cancels the centre
  // image where the vocal and the bass live. The delay belongs on the cross path,
  // never on the direct one, or the whole mix shifts to one side.
  const ensureCrossfeedNodes = useCallback((ctx: AudioContext) => {
    if (crossfeedRef.current) return crossfeedRef.current;

    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);

    // Direct path is a straight wire - no filtering, and above all no delay, or
    // the whole stereo image shifts to one side.
    splitter.connect(merger, 0, 0);
    splitter.connect(merger, 1, 1);

    // No explicit delay line: a 2nd-order lowpass at this corner already carries
    // ~330 us of group delay in its passband, which is the real acoustic path
    // around the head. Adding a delay on top notches the centre.
    const makeLowpass = () => {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = CROSSFEED_PARAMS.medium.cutoff;
      f.Q.value = 0.707;
      return f;
    };
    const lpL = makeLowpass();
    const lpR = makeLowpass();

    // In phase. A negative cross gain would cancel the centre image, which is
    // where the vocal and the bass live.
    const crossL = ctx.createGain();
    const crossR = ctx.createGain();
    crossL.gain.value = 0;
    crossR.gain.value = 0;

    // L -> lowpass -> opposite ear, and mirrored.
    splitter.connect(lpL, 0);
    lpL.connect(crossL);
    crossL.connect(merger, 0, 1);

    splitter.connect(lpR, 1);
    lpR.connect(crossR);
    crossR.connect(merger, 0, 0);

    // Centre-image compensation, applied to the sum rather than to the direct
    // path - see CROSSFEED_PARAMS.
    const comp = ctx.createBiquadFilter();
    comp.type = 'lowshelf';
    comp.frequency.value = CROSSFEED_PARAMS.medium.compFreq;
    comp.gain.value = 0;

    const output = ctx.createGain();
    output.gain.value = 1.0;

    merger.connect(comp);
    comp.connect(output);

    const nodes = { splitter, merger, lpL, lpR, crossL, crossR, comp, output };
    crossfeedRef.current = nodes;
    return nodes;
  }, []);

  const applyCrossfeedParams = useCallback((mode: CrossfeedMode) => {
    const nodes = crossfeedRef.current;
    const ctx = audioCtxRef.current;
    if (!nodes || !ctx) return;
    const t = ctx.currentTime;
    if (mode === 'off') {
      nodes.crossL.gain.setTargetAtTime(0, t, 0.02);
      nodes.crossR.gain.setTargetAtTime(0, t, 0.02);
      nodes.comp.gain.setTargetAtTime(0, t, 0.02);
      return;
    }
    const { cutoff, level, compFreq, compDb } = CROSSFEED_PARAMS[mode];
    nodes.lpL.frequency.setTargetAtTime(cutoff, t, 0.02);
    nodes.lpR.frequency.setTargetAtTime(cutoff, t, 0.02);
    nodes.crossL.gain.setTargetAtTime(level, t, 0.02);
    nodes.crossR.gain.setTargetAtTime(level, t, 0.02);
    nodes.comp.frequency.setTargetAtTime(compFreq, t, 0.02);
    nodes.comp.gain.setTargetAtTime(compDb, t, 0.02);
  }, []);

  // Band-split de-esser. A Linkwitz-Riley 4th-order crossover (two cascaded
  // Butterworth sections per side) sums back to a flat magnitude response, so
  // with the compressor idle the block is inaudible; when sibilance hits, only
  // the top band ducks and the body of the voice is untouched.
  const ensureDeEsserNodes = useCallback((ctx: AudioContext) => {
    if (deEsserRef.current) return deEsserRef.current;
    const input = ctx.createGain();
    const output = ctx.createGain();

    const makeLp = () => {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = DEESS_CROSSOVER_HZ;
      f.Q.value = 0.707;
      return f;
    };
    const makeHp = () => {
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = DEESS_CROSSOVER_HZ;
      f.Q.value = 0.707;
      return f;
    };
    const lowA = makeLp();
    const lowB = makeLp();
    const highA = makeHp();
    const highB = makeHp();

    const comp = ctx.createDynamicsCompressor();
    // The high band on its own sits far below full scale, so the threshold has
    // to be low to catch anything. Web Audio's compressor applies no makeup
    // gain, which is what a de-esser wants: reduction only.
    comp.threshold.value = -32;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.06;

    input.connect(lowA);
    lowA.connect(lowB);
    lowB.connect(output);

    input.connect(highA);
    highA.connect(highB);
    highB.connect(comp);
    comp.connect(output);

    deEsserRef.current = { input, lowA, lowB, highA, highB, comp, output };
    return deEsserRef.current;
  }, []);

  const ensureVoicingNodes = useCallback((ctx: AudioContext) => {
    if (voicingRef.current) return voicingRef.current;
    const filters = MARSHALL_VOICING.map((spec) => {
      const f = ctx.createBiquadFilter();
      f.type = spec.type;
      f.frequency.value = spec.freq;
      f.Q.value = spec.q;
      f.gain.value = spec.gain;
      return f;
    });
    for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
    const output = ctx.createGain();
    output.gain.value = MARSHALL_TRIM;
    filters[filters.length - 1].connect(output);
    voicingRef.current = { input: filters[0], output };
    return voicingRef.current;
  }, []);

  // Equal-loudness compensation. In-ears isolate well, so people listen quietly,
  // and the ear's sensitivity to bass falls away faster than anything else as
  // level drops (ISO 226). These two shelves open up as the volume control comes
  // down and sit at 0 dB when it is all the way up.
  const ensureContourNodes = useCallback((ctx: AudioContext) => {
    if (contourRef.current) return contourRef.current;
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 120;
    low.gain.value = 0;
    const high = ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 8000;
    high.gain.value = 0;
    low.connect(high);
    contourRef.current = { low, high };
    return contourRef.current;
  }, []);

  const applyContour = useCallback(() => {
    const nodes = contourRef.current;
    const ctx = audioCtxRef.current;
    if (!nodes || !ctx) return;
    const on = loudnessCompRef.current;
    const effective = Math.min(1, Math.max(0.001, volumeRef.current * volumeRef.current * gainMultiplierRef.current));
    const attenDb = 20 * Math.log10(effective);
    const lowDb = on ? Math.min(6, Math.max(0, -attenDb * 0.35)) : 0;
    const highDb = on ? Math.min(2.5, Math.max(0, -attenDb * 0.15)) : 0;
    nodes.low.gain.setTargetAtTime(lowDb, ctx.currentTime, 0.05);
    nodes.high.gain.setTargetAtTime(highDb, ctx.currentTime, 0.05);
  }, []);

  // Mid/side stereo control inspired by the extension's "Music Stereo+" mode.
  // It remains a two-channel signal, so it is safe for ordinary headphones and
  // speakers. Wide uses a deliberately small 1.15 width factor; the limiter
  // remains downstream for exceptionally wide, already-hot masters.
  const ensureSpatialNodes = useCallback((ctx: AudioContext) => {
    if (spatialRef.current) return spatialRef.current;
    const input = ctx.createGain();
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const output = ctx.createGain();
    const leftDirect = ctx.createGain();
    const leftCross = ctx.createGain();
    const rightDirect = ctx.createGain();
    const rightCross = ctx.createGain();
    input.connect(splitter);
    splitter.connect(leftDirect, 0);
    splitter.connect(rightCross, 1);
    splitter.connect(rightDirect, 1);
    splitter.connect(leftCross, 0);
    leftDirect.connect(merger, 0, 0);
    leftCross.connect(merger, 0, 1);
    rightDirect.connect(merger, 0, 1);
    rightCross.connect(merger, 0, 0);
    merger.connect(output);
    spatialRef.current = { input, output, leftDirect, leftCross, rightDirect, rightCross };
    return spatialRef.current;
  }, []);

  const applySpatialParams = useCallback((mode: SpatialMode, balanceValue: number) => {
    const nodes = spatialRef.current;
    const ctx = audioCtxRef.current;
    if (!nodes || !ctx) return;
    const width = mode === 'wide' ? 1.15 : mode === 'mono' ? 0 : 1;
    const leftLevel = balanceValue > 0 ? 1 - balanceValue : 1;
    const rightLevel = balanceValue < 0 ? 1 + balanceValue : 1;
    const direct = (1 + width) / 2;
    const cross = (1 - width) / 2;
    const time = ctx.currentTime;
    nodes.leftDirect.gain.setTargetAtTime(direct * leftLevel, time, 0.02);
    nodes.rightCross.gain.setTargetAtTime(cross * leftLevel, time, 0.02);
    nodes.rightDirect.gain.setTargetAtTime(direct * rightLevel, time, 0.02);
    nodes.leftCross.gain.setTargetAtTime(cross * rightLevel, time, 0.02);
  }, []);

  // "8D" in a two-channel player is a continuously moving equal-power stereo
  // image, not a fake multichannel output. A sine LFO keeps the movement smooth
  // at every crossover point and StereoPanner preserves perceived loudness as
  // the image crosses the centre.
  const ensureVirtual8dNodes = useCallback((ctx: AudioContext) => {
    if (virtual8dRef.current) return virtual8dRef.current;
    virtual8dRef.current = new SpatialOrbit(ctx);
    virtual8dRef.current.update(virtual8dSpeedRef.current, virtual8dDepthRef.current, advancedSettingsRef.current.trajectory);
    return virtual8dRef.current;
  }, []);

  const ensureNightCompressor = useCallback((ctx: AudioContext) => {
    if (!nightCompressorRef.current) {
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 18;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.015;
      compressor.release.value = 0.24;
      nightCompressorRef.current = compressor;
    }
    return nightCompressorRef.current;
  }, []);

  // Brick-wall safety net, sitting after the volume control so it only ever acts
  // on what actually reaches the DAC. With the EQ preamp and the voicing trim
  // doing their job it should almost never engage.
  const ensureLimiter = useCallback((ctx: AudioContext) => {
    if (!limiterRef.current) {
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      limiterRef.current = limiter;
    }
    return limiterRef.current;
  }, []);

  // Slow loudness levelling. The sources are mastered at noticeably different
  // levels, so without this every track change is a volume jump. The measurement
  // tap is K-weighted (BS.1770): a shelf for the head's response plus a subsonic
  // cut, so the meter hears the track roughly the way the listener does instead
  // of being dominated by whatever has the most bass.
  const ensureLoudnessNodes = useCallback((ctx: AudioContext) => {
    if (!loudnessGainRef.current) {
      loudnessGainRef.current = ctx.createGain();
      loudnessGainRef.current.gain.value = 1.0;
    }
    if (!meterRef.current) {
      const shelf = ctx.createBiquadFilter();
      shelf.type = 'highshelf';
      shelf.frequency.value = 1681;
      shelf.gain.value = 4;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 38;
      hp.Q.value = 0.5;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      shelf.connect(hp);
      hp.connect(analyser);
      meterRef.current = { shelf, hp, analyser };
    }
    return { loudnessGain: loudnessGainRef.current, meter: meterRef.current };
  }, []);

  const activateWebAudio = useCallback(() => {
    if (!audioRef.current) return;

    // Do not connect a mobile media element to AudioContext. See
    // needsNativeBackgroundAudio: a native element can continue through a
    // phone/tablet lock screen, whereas Web Audio is commonly suspended.
    if (!processingRef.current) return;

    let ctx = audioCtxRef.current;
    if (!ctx) {
      // A playback latency hint buys bigger render quanta, which is what keeps a
      // 31-band chain from glitching on a phone.
      ctx = new AudioContext({ latencyHint: 'playback' });
      audioCtxRef.current = ctx;
      setHardwareChannels(ctx.destination.maxChannelCount || 2);
    }

    if (!sourceNodeRef.current) {
      try {
        sourceNodeRef.current = ctx.createMediaElementSource(audioRef.current);
      } catch {
        return;
      }
    }

    const isSpeaker = outputModeRef.current === 'speaker';
    const useCrossfeed = crossfeedRefMode.current !== 'off';
    const useDeEsser = deEsserModeRef.current;
    const topology = `${isSpeaker ? 'spk' : 'hp'}|${useCrossfeed ? 'cf' : '-'}|${useDeEsser ? 'de' : '-'}|${virtual8d ? '8d' : '-'}|${nightMode ? 'night' : '-'}`;

    if (webAudioActiveRef.current && topologyRef.current === topology) {
      ctx.resume().catch(() => {});
      return;
    }

    const source = sourceNodeRef.current;
    const studio = advancedRef.current || (advancedRef.current = new AdvancedAudio(ctx));
    studio.update(advancedSettingsRef.current);
    const eq = equalizerRef.current;
    const highpass = ensureHighpass(ctx);
    const gainNode = ensureGainNode(ctx);
    const volumeGain = ensureVolumeGain(ctx);
    const envGain = ensureEnvGain(ctx);
    const limiter = ensureLimiter(ctx);
    const contour = ensureContourNodes(ctx);
    const { loudnessGain, meter } = ensureLoudnessNodes(ctx);

    const eqFilters = eq.filtersRef.current.length > 0 ? eq.filtersRef.current : eq.createFilters(ctx);
    const eqFirst = eqFilters[0];
    const eqLast = eqFilters[eqFilters.length - 1];
    const eqPreamp = eq.createPreamp(ctx);

    // Tear the old routing down before wiring the new one. Only the outputs of
    // each block need clearing; the wiring inside a block never changes.
    [source, highpass, eqLast, eqPreamp, contour.high, loudnessGain, gainNode, volumeGain, envGain, limiter]
      .forEach(disconnectSafe);
    if (crossfeedRef.current) disconnectSafe(crossfeedRef.current.output);
    if (deEsserRef.current) disconnectSafe(deEsserRef.current.output);
    if (voicingRef.current) disconnectSafe(voicingRef.current.output);
    if (spatialRef.current) disconnectSafe(spatialRef.current.output);
    if (virtual8dRef.current) disconnectSafe(virtual8dRef.current.output);
    if (nightCompressorRef.current) disconnectSafe(nightCompressorRef.current);
    disconnectSafe(studio.output);

    // source -> subsonic -> EQ -> EQ preamp -> [voicing] -> [de-esser]
    //        -> [crossfeed] -> loudness -> contour -> user gain -> volume
    //        -> fade envelope -> limiter -> out
    source.connect(gainNode);
    gainNode.connect(studio.input);
    studio.output.connect(highpass);
    highpass.connect(eqFirst);
    eqLast.connect(eqPreamp);

    let tail: AudioNode = eqPreamp;
    if (isSpeaker) {
      const voicing = ensureVoicingNodes(ctx);
      tail.connect(voicing.input);
      tail = voicing.output;
    }
    if (useDeEsser) {
      const de = ensureDeEsserNodes(ctx);
      tail.connect(de.input);
      tail = de.output;
    }

    if (useCrossfeed) {
      const cf = ensureCrossfeedNodes(ctx);
      tail.connect(cf.splitter);
      tail = cf.output;
    }

    const spatial = ensureSpatialNodes(ctx);
    tail.connect(spatial.input);
    tail = spatial.output;

    if (virtual8d) {
      const virtual = ensureVirtual8dNodes(ctx);
      tail.connect(virtual.input);
      tail = virtual.output;
    }

    if (nightMode) {
      const night = ensureNightCompressor(ctx);
      tail.connect(night);
      tail = night;
    }

    tail.connect(loudnessGain);
    loudnessGain.connect(contour.low);
    contour.high.connect(volumeGain);
    volumeGain.connect(envGain);
    const destinationTail = advancedSettingsRef.current.limiter ? limiter : envGain;
    if (advancedSettingsRef.current.limiter) envGain.connect(limiter);
    setActiveChannels(studio.connectDestination(destinationTail, advancedSettingsRef.current, ctx.destination.maxChannelCount || 2));

    // Measurement tap, ahead of the volume control so the leveller cannot end up
    // fighting the user's own volume changes. An analyser has no effect on what
    // passes through it.
    loudnessGain.connect(meter.shelf);

    // Volume now lives in the graph, so the element itself runs wide open.
    audioRef.current.volume = 1;
    volumeGain.gain.value = volumeRef.current * volumeRef.current;
    gainNode.gain.value = gainMultiplierRef.current;
    highpass.frequency.value = SUBSONIC_HZ[outputModeRef.current];
    applyCrossfeedParams(useCrossfeed ? crossfeedRefMode.current : 'off');
    applySpatialParams(spatialModeRef.current, balanceRef.current);
    applyContour();
    virtual8dRef.current?.update(virtual8dSpeedRef.current, virtual8dDepthRef.current, advancedSettingsRef.current.trajectory);

    webAudioActiveRef.current = true;
    topologyRef.current = topology;
    ctx.resume().catch(() => {});
  }, [
    disconnectSafe, ensureHighpass, ensureGainNode, ensureVolumeGain, ensureEnvGain,
    ensureLimiter, ensureContourNodes, ensureLoudnessNodes, ensureCrossfeedNodes,
    ensureDeEsserNodes, ensureVoicingNodes, ensureSpatialNodes, ensureVirtual8dNodes, ensureNightCompressor,
    applyCrossfeedParams, applySpatialParams, applyContour, nightMode,
    virtual8d,
  ]);

  const setAdvanced = useCallback((patch: Partial<AdvancedSettings>) => {
    const next = sanitizeAdvanced({ ...advancedSettingsRef.current, ...patch });
    advancedSettingsRef.current = next;
    setAdvancedState(next); saveAdvanced(next);
    advancedRef.current?.update(next);
    virtual8dRef.current?.update(virtual8dSpeedRef.current, virtual8dDepthRef.current, next.trajectory);
    // Only channel wiring changes require rebuilding; sliders update AudioParams.
    const routingKeys = ['system', 'routing', 'rearAmbience', 'rearDirect', 'rearInvert', 'splitBass', 'limiter'];
    if (routingKeys.some(key => key in patch)) {
      topologyRef.current = null;
      activateWebAudio();
    }
  }, [activateWebAudio]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const sync = () => { document.documentElement.dataset.theme = advanced.theme === 'auto' ? (media.matches ? 'light' : 'dark') : advanced.theme; };
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [advanced.theme]);

  const setProcessingEnabled = useCallback((enabled: boolean) => {
    processingRef.current = enabled;
    setProcessingState(enabled);
    if (enabled) {
      try { activateWebAudio(); } catch {
        processingRef.current = false; setProcessingState(false);
        addToast(t('toast.playFailed'), 'error');
      }
      return;
    }
    // A MediaElementSource attachment cannot be undone. Use a new native media
    // element to restore mobile lock-screen playback, preserving track/position.
    const old = audioRef.current;
    if (!old || !sourceNodeRef.current) return;
    const resume = !old.paused;
    const position = old.currentTime;
    old.pause();
    const replacement = new Audio();
    replacement.crossOrigin = 'anonymous'; replacement.preload = 'auto';
    replacement.setAttribute('playsinline', '');
    replacement.volume = volumeRef.current ** 2;
    replacement.addEventListener('loadedmetadata', () => { if (Number.isFinite(position)) replacement.currentTime = position; }, { once: true });
    if (old.getAttribute('src')) replacement.src = old.src;
    audioRef.current = replacement;
    sourceNodeRef.current.disconnect(); sourceNodeRef.current = null;
    old.removeAttribute('src'); old.load();
    webAudioActiveRef.current = false; topologyRef.current = null;
    audioCtxRef.current?.suspend().catch(() => {});
    setAudioRevision(n => n + 1);
    if (resume) replacement.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [activateWebAudio, addToast, t]);

  const getAudioMetrics = useCallback(() => {
    if (!processingRef.current || audioCtxRef.current?.state !== 'running') return null;
    return advancedRef.current?.measure(advancedSettingsRef.current) || null;
  }, []);

  const testChannel = useCallback((channel: number | number[]) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const channels = (Array.isArray(channel) ? channel : [channel]).filter(value => value >= 0 && value < ctx.destination.channelCount);
    if (!channels.length) return;
    const oscillator = ctx.createOscillator(); oscillator.frequency.value = 220;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const merger = ctx.createChannelMerger(ctx.destination.channelCount);
    oscillator.connect(gain); channels.forEach(value => gain.connect(merger, 0, value)); merger.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.025, now + 0.04);
    gain.gain.setValueAtTime(0.025, now + 0.35); gain.gain.linearRampToValueAtTime(0, now + 0.45);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); merger.disconnect(); };
    ctx.resume().catch(() => {}); oscillator.start(); oscillator.stop(now + 0.5);
  }, []);

  // Walk loudnessGain towards a common level. Deliberately slow (3 s time
  // constant over a 3 s measurement window, +/-7 dB of authority) so it levels
  // between tracks without audibly pumping inside one.
  useEffect(() => {
    const TARGET_RMS = 0.1;      // about -20 dBFS, K-weighted
    const MIN_RMS = 0.005;       // below this treat it as silence and hold
    const MAX_GAIN = 2.2;
    const MIN_GAIN = 0.45;
    const WINDOW = 6;            // ticks of 500 ms

    const history: number[] = [];

    const tick = () => {
      const meter = meterRef.current;
      const gain = loudnessGainRef.current;
      const ctx = audioCtxRef.current;
      if (!meter || !gain || !ctx || !isPlaying || !processingRef.current) return;
      if (advancedSettingsRef.current.smartMono) advancedRef.current?.measure(advancedSettingsRef.current);
      if (!advancedSettingsRef.current.normalize) { gain.gain.setTargetAtTime(1, ctx.currentTime, 0.2); return; }

      const buf = new Float32Array(meter.analyser.fftSize);
      meter.analyser.getFloatTimeDomainData(buf);

      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      if (rms < MIN_RMS) return;

      // rms here is already scaled by the current gain, so divide it back out.
      const current = gain.gain.value || 1;
      history.push(rms / current);
      if (history.length > WINDOW) history.shift();
      if (history.length < 3) return;

      const mean = Math.sqrt(history.reduce((a, v) => a + v * v, 0) / history.length);
      const wanted = Math.max(MIN_GAIN, Math.min(MAX_GAIN, TARGET_RMS / mean));
      // Ignore anything under half a dB; constant micro-adjustment is audible as
      // a slow breathing on sustained material.
      if (Math.abs(20 * Math.log10(wanted / current)) < 0.5) return;
      gain.gain.setTargetAtTime(wanted, ctx.currentTime, 3.0);
    };

    loudnessTimerRef.current = setInterval(tick, 500);
    return () => {
      if (loudnessTimerRef.current) clearInterval(loudnessTimerRef.current);
      loudnessTimerRef.current = null;
    };
  }, [isPlaying]);

  const proxyUrl = useCallback((url: string): string => {
    if (!url || url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) return url;
    return `${API.AUDIO_PROXY}?url=${encodeURIComponent(url)}`;
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.preload = 'auto';
      audioRef.current.setAttribute('playsinline', '');
      audioRef.current.volume = volumeRef.current * volumeRef.current;
    }
    const audio = audioRef.current;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    // Fading in from the `playing` event rather than from the play() call keeps
    // the envelope honest whichever route started playback - the transport
    // buttons, the lock screen, or the end of the previous track.
    const onPlaying = () => {
      failedTrackCountRef.current = 0;
      setIsPlaying(true);
      fadeEnv(1, 90);
    };
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      const skipped = failureSkipRef.current();
      addToast(skipped ? t('toast.playFailedNext') : t('toast.playFailed'), 'error');
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
    };
  }, [addToast, fadeEnv, t, audioRevision]);

  const fetchSongUrl = useCallback(async (song: Song): Promise<string | null> => {
    const cacheKey = `song_url_${song.sourceType}_${song.source}_${song.id}`;
    const cached = requestCache.get<string>(cacheKey);
    if (cached) return cached;

    const pending = songUrlRequestsRef.current.get(cacheKey);
    if (pending) return pending;

    const request = (async () => {
      let retries = 2;
      while (retries >= 0) {
        try {
          let url: string = '';

          if (song.sourceType === 'audius') {
            const res = await fetch(`${API.AUDIUS}?action=song&id=${encodeURIComponent(song.id)}`);
            const data = await res.json();
            if (data.code === 1 && data.data) {
              url = data.data.url;
              if (data.data.pic) {
                requestCache.set(`pic_${song.sourceType}_${song.source}_${song.id}`, data.data.pic, CACHE_TTL.PIC);
              }
            }
          } else if (song.sourceType === 'ccmixter') {
            const res = await fetch(`${API.CCMIXTER}?action=song&id=${encodeURIComponent(song.id)}`);
            const data = await res.json();
            if (data.code === 1 && data.data) {
              url = data.data.url || '';
              if (data.data.pic) {
                requestCache.set(`pic_${song.sourceType}_${song.source}_${song.id}`, data.data.pic, CACHE_TTL.PIC);
              }
            }
          } else if (song.sourceType === 'archive') {
            const res = await fetch(`${API.ARCHIVE}?action=song&id=${encodeURIComponent(song.id)}`);
            const data = await res.json();
            if (data.code === 1 && data.data) {
              url = data.data.url || '';
            }
          } else if (song.sourceType === 'openverse') {
            const res = await fetch(`${API.OPENVERSE}?action=song&id=${encodeURIComponent(song.id)}`);
            const data = await res.json();
            if (data.code === 1 && data.data) {
              url = data.data.url || '';
              if (data.data.pic) {
                requestCache.set(`pic_${song.sourceType}_${song.source}_${song.id}`, data.data.pic, CACHE_TTL.PIC);
              }
            }
          } else if (song.sourceType === 'wikimedia') {
            const res = await fetch(`${API.WIKIMEDIA}?action=song&id=${encodeURIComponent(song.id)}`);
            const data = await res.json();
            if (data.code === 1 && data.data) url = data.data.url || '';
          } else if (song.sourceType === 'gd') {
            const res = await fetch(`${API.GD}?types=url&source=${song.source}&id=${song.id}&br=320`);
            const data = await res.json();
            url = data.url || '';
          } else {
            const res = await fetch(
              `${API.SONG}?id=${song.id}&type=${song.source}` +
                `&name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist)}&fast=1`,
            );
            const data = await res.json();
            if (data.code === 1 && data.data) {
              url = data.data.url;
              if (data.data.pic) {
                requestCache.set(`pic_${song.sourceType}_${song.source}_${song.id}`, data.data.pic, CACHE_TTL.PIC);
              }
              if (data.data.lrc) {
                requestCache.set(`lyric_${song.sourceType}_${song.source}_${song.id}`, data.data.lrc, CACHE_TTL.LYRIC);
              }
            }
          }
          if (url) {
            requestCache.set(cacheKey, url, CACHE_TTL.SONG_URL);
            return url;
          }
          return null;
        } catch {
          retries--;
          if (retries < 0) return null;
          await new Promise((r) => setTimeout(r, 600));
        }
      }
      return null;
    })();

    songUrlRequestsRef.current.set(cacheKey, request);
    try {
      return await request;
    } finally {
      if (songUrlRequestsRef.current.get(cacheKey) === request) {
        songUrlRequestsRef.current.delete(cacheKey);
      }
    }
  }, []);

  const playSong = useCallback(async (song: Song, newQueue?: Song[], index?: number) => {
    const isAutomaticSkip = autoSkipInFlightRef.current;
    autoSkipInFlightRef.current = false;
    if (!isAutomaticSkip) failedTrackCountRef.current = 0;
    const requestId = ++playRequestRef.current;
    setLoading(true);
    setCurrentSong(song);
    setSongDetail(null);
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    // Duck before the source is swapped; `playing` brings the envelope back up.
    fadeEnv(0, 30);
    // Stop the previous title immediately. On native mobile playback the Web
    // Audio envelope is bypassed, so leaving it running made the UI and sound
    // disagree until the next URL had resolved.
    audioRef.current?.pause();
    setCurrentTime(0);
    setDuration(0);

    if (newQueue !== undefined && index !== undefined) {
      setQueue(newQueue);
      setQueueIndex(index);
    }

    const url = await fetchSongUrl(song);
    if (requestId !== playRequestRef.current) return;
    if (!url) {
      const skipped = failureSkipRef.current();
      addToast(skipped ? t('toast.urlFailedNext') : t('toast.urlFailed'), 'error');
      fadeEnv(1, 30);
      setLoading(false);
      return;
    }

    const detail: SongDetail = { url };
    setSongDetail(detail);

    if (audioRef.current) {
      audioRef.current.src = proxyUrl(url);
      audioRef.current.play().catch(() => {});
    }
    setLoading(false);
  }, [fetchSongUrl, addToast, proxyUrl, fadeEnv, t]);

  const pauseWithFade = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    if (!webAudioActiveRef.current) {
      audio.pause();
      return;
    }
    fadeEnv(0, 40);
    pauseTimerRef.current = setTimeout(() => {
      pauseTimerRef.current = null;
      audio.pause();
    }, 55);
  }, [fadeEnv]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      pauseWithFade();
    } else {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      fadeEnv(0, 0);
      audio.play().catch(() => {});
    }
  }, [isPlaying, pauseWithFade, fadeEnv]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const v = Math.max(0, Math.min(1, vol));
    setVolumeState(v);
    volumeRef.current = v;
    saveVolume(v);
    const perceptual = v * v;
    if (webAudioActiveRef.current && volumeGainRef.current && audioCtxRef.current) {
      volumeGainRef.current.gain.setTargetAtTime(perceptual, audioCtxRef.current.currentTime, 0.02);
      if (audioRef.current) audioRef.current.volume = 1;
    } else if (audioRef.current) {
      audioRef.current.volume = perceptual;
    }
    applyContour();
  }, [applyContour]);

  const setPlayMode = useCallback((mode: PlayMode) => {
    setPlayModeState(mode);
    savePlayMode(mode);
  }, []);

  const setGainMultiplier = useCallback((gain: number) => {
    const next = Math.max(0, Math.min(2, Number.isFinite(gain) ? gain : 1));
    setGainMultiplierState(next);
    gainMultiplierRef.current = next;
    saveGainMultiplier(next);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(next, audioCtxRef.current.currentTime, 0.02);
    }
    applyContour();
  }, [applyContour]);

  const toggleStereoWide = useCallback(() => {
    const next: SpatialMode = spatialModeRef.current === 'wide' ? 'off' : 'wide';
    spatialModeRef.current = next;
    setSpatialModeState(next);
    saveSpatialMode(next);
    applySpatialParams(next, balanceRef.current);
  }, [applySpatialParams]);

  const toggleMono = useCallback(() => {
    const next: SpatialMode = spatialModeRef.current === 'mono' ? 'off' : 'mono';
    spatialModeRef.current = next;
    setSpatialModeState(next);
    saveSpatialMode(next);
    applySpatialParams(next, balanceRef.current);
  }, [applySpatialParams]);

  const setBalance = useCallback((value: number) => {
    const next = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
    balanceRef.current = next;
    setBalanceState(next);
    saveBalance(next);
    applySpatialParams(spatialModeRef.current, next);
  }, [applySpatialParams]);

  const toggleNightMode = useCallback(() => {
    const next = !nightMode;
    setNightModeState(next);
    saveNightMode(next);
    duckThroughRebuild();
  }, [nightMode, duckThroughRebuild]);

  const toggleVirtual8d = useCallback(() => {
    const next = !virtual8d;
    setVirtual8dState(next);
    saveVirtual8d(next);
    duckThroughRebuild();
  }, [virtual8d, duckThroughRebuild]);

  const setVirtual8dSpeed = useCallback((value: number) => {
    const next = Math.max(0.04, Math.min(0.12, Number.isFinite(value) ? value : 0.075));
    virtual8dSpeedRef.current = next;
    setVirtual8dSpeedState(next);
    saveVirtual8dSpeed(next);
    const ctx = audioCtxRef.current;
    virtual8dRef.current?.update(next, virtual8dDepthRef.current, advancedSettingsRef.current.trajectory);
  }, []);

  const setVirtual8dDepth = useCallback((value: number) => {
    const next = Math.max(0.25, Math.min(0.85, Number.isFinite(value) ? value : 0.7));
    virtual8dDepthRef.current = next;
    setVirtual8dDepthState(next);
    saveVirtual8dDepth(next);
    const ctx = audioCtxRef.current;
    virtual8dRef.current?.update(virtual8dSpeedRef.current, next, advancedSettingsRef.current.trajectory);
  }, []);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIndex: number;
    if (playMode === 'shuffle') {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = (queueIndex + 1) % queue.length;
    }
    setQueueIndex(nextIndex);
    playSong(queue[nextIndex], queue, nextIndex);
  }, [queue, queueIndex, playMode, playSong]);

  const skipFailedTrack = useCallback((): boolean => {
    if (queue.length < 2 || failedTrackCountRef.current >= queue.length - 1) return false;
    const start = queueIndex >= 0 ? queueIndex : 0;
    const nextIndex = (start + 1) % queue.length;
    if (nextIndex === start) return false;
    failedTrackCountRef.current += 1;
    autoSkipInFlightRef.current = true;
    setQueueIndex(nextIndex);
    playSong(queue[nextIndex], queue, nextIndex);
    return true;
  }, [queue, queueIndex, playSong]);

  useEffect(() => {
    failureSkipRef.current = skipFailedTrack;
  }, [skipFailedTrack]);

  const playPrev = useCallback(() => {
    if (queue.length === 0) return;
    let prevIndex: number;
    if (playMode === 'shuffle') {
      prevIndex = Math.floor(Math.random() * queue.length);
    } else {
      prevIndex = (queueIndex - 1 + queue.length) % queue.length;
    }
    setQueueIndex(prevIndex);
    playSong(queue[prevIndex], queue, prevIndex);
  }, [queue, queueIndex, playMode, playSong]);

  useEffect(() => {
    mediaActionsRef.current = { next: playNext, prev: playPrev, pause: pauseWithFade };
  }, [playNext, playPrev, pauseWithFade]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (playMode === 'repeat-one') {
        fadeEnv(0, 0);
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        playNext();
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [playMode, playNext, fadeEnv, audioRevision]);

  const addToQueue = useCallback((songs: Song[]) => {
    setQueue((prev) => [...prev, ...songs]);
    addToast(t('toast.addedQueue', { count: songs.length }), 'success');
  }, [addToast, t]);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    if (index < queueIndex) {
      setQueueIndex((i) => i - 1);
    } else if (index === queueIndex) {
      setQueueIndex(-1);
    }
  }, [queueIndex]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueIndex(-1);
  }, []);

  const cycleCrossfeed = useCallback(() => {
    const next = CROSSFEED_ORDER[(CROSSFEED_ORDER.indexOf(crossfeedRefMode.current) + 1) % CROSSFEED_ORDER.length];
    const topologyChanges = (crossfeedRefMode.current === 'off') !== (next === 'off');
    crossfeedRefMode.current = next;
    setCrossfeedModeState(next);
    saveCrossfeedMode(next);
    applyCrossfeedParams(next);
    if (topologyChanges) duckThroughRebuild();
    const mode = next === 'off' ? t('audio.off') : next === 'light' ? t('audio.crossfeedLight') : next === 'medium' ? t('audio.crossfeedMedium') : t('audio.crossfeedStrong');
    addToast(t('toast.crossfeed', { mode }), next === 'off' ? 'info' : 'success');
  }, [applyCrossfeedParams, duckThroughRebuild, addToast, t]);

  const setCrossfeed = useCallback((mode: CrossfeedMode) => {
    crossfeedRefMode.current = mode; setCrossfeedModeState(mode); saveCrossfeedMode(mode);
    applyCrossfeedParams(mode);
  }, [applyCrossfeedParams]);

  const toggleDeEsser = useCallback(() => {
    const next = !deEsserModeRef.current;
    deEsserModeRef.current = next;
    setDeEsserState(next);
    saveDeEsser(next);
    duckThroughRebuild();
    addToast(next ? t('toast.deEsserOn') : t('toast.deEsserOff'), next ? 'success' : 'info');
  }, [duckThroughRebuild, addToast, t]);

  const toggleLoudnessComp = useCallback(() => {
    const next = !loudnessCompRef.current;
    loudnessCompRef.current = next;
    setLoudnessCompState(next);
    saveLoudnessComp(next);
    applyContour();
    addToast(next ? t('toast.loudnessOn') : t('toast.loudnessOff'), next ? 'success' : 'info');
  }, [applyContour, addToast, t]);

  const toggleOutputMode = useCallback(() => {
    const next: OutputMode = outputModeRef.current === 'speaker' ? 'headphone' : 'speaker';
    outputModeRef.current = next;
    setOutputModeState(next);
    saveOutputMode(next);
    if (highpassRef.current && audioCtxRef.current) {
      highpassRef.current.frequency.setTargetAtTime(SUBSONIC_HZ[next], audioCtxRef.current.currentTime, 0.05);
    }
    duckThroughRebuild();
    addToast(
      next === 'speaker' ? t('toast.speakerOn') : t('toast.headphoneOn'),
      next === 'speaker' ? 'success' : 'info',
    );
  }, [duckThroughRebuild, addToast, t]);

  // Rebuild the routing only when the topology actually changes. activateWebAudio
  // is a no-op resume when the shape of the graph is unchanged, so this can stay
  // in an effect without touching the signal path on every render.
  useEffect(() => {
    if (!isPlaying && !webAudioActiveRef.current) return;
    activateWebAudio();
  }, [isPlaying, outputMode, crossfeedMode, deEsser, virtual8d, nightMode, activateWebAudio]);

  useEffect(() => {
    if (queue.length < 2 || queueIndex < 0 || playMode === 'shuffle') return;
    const nextIndex = (queueIndex + 1) % queue.length;
    const nextSong = queue[nextIndex];
    if (!nextSong) return;
    // Let the current stream start first, then resolve exactly one adjacent URL.
    // The in-flight map prevents duplicate API calls from rapid state updates.
    const timer = setTimeout(() => { void fetchSongUrl(nextSong); }, 700);
    return () => clearTimeout(timer);
  }, [queue, queueIndex, playMode, fetchSongUrl]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    setMediaSessionAction('play', () => audioRef.current?.play().catch(() => {}));
    setMediaSessionAction('pause', () => mediaActionsRef.current.pause());
    setMediaSessionAction('previoustrack', () => mediaActionsRef.current.prev());
    setMediaSessionAction('nexttrack', () => mediaActionsRef.current.next());
    setMediaSessionAction('seekbackward', (details) => {
      if (!audioRef.current) return;
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (details.seekOffset || 15));
    });
    setMediaSessionAction('seekforward', (details) => {
      if (!audioRef.current) return;
      const duration = Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : Infinity;
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + (details.seekOffset || 15));
    });
    setMediaSessionAction('seekto', (details) => {
      if (audioRef.current && details.seekTime != null) {
        audioRef.current.currentTime = details.seekTime;
      }
    });
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong || !('MediaMetadata' in window)) return;

    const artworkUrl = currentSong.pic?.startsWith('http') ? currentSong.pic : undefined;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.name,
      artist: currentSong.artist,
      album: currentSong.album || '',
      artwork: artworkUrl ? [
        { src: artworkUrl, sizes: '96x96' },
        { src: artworkUrl, sizes: '128x128' },
        { src: artworkUrl, sizes: '192x192' },
        { src: artworkUrl, sizes: '256x256' },
        { src: artworkUrl, sizes: '384x384' },
        { src: artworkUrl, sizes: '512x512' },
      ] : [],
    });
  }, [currentSong]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !Number.isFinite(duration) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(Math.max(currentTime, 0), duration),
      });
    } catch {
      // Position state is optional and absent in older Safari versions.
    }
  }, [currentTime, duration]);

  return {
    currentSong,
    advanced, setAdvanced, processingEnabled, setProcessingEnabled,
    hardwareChannels, activeChannels, getAudioMetrics, testChannel,
    songDetail,
    isPlaying,
    currentTime,
    duration,
    volume,
    playMode,
    crossfeedMode,
    deEsser,
    loudnessComp,
    outputMode,
    gainMultiplier,
    spatialMode,
    nightMode,
    balance,
    virtual8d,
    virtual8dSpeed,
    virtual8dDepth,
    queue,
    queueIndex,
    loading,
    playSong,
    togglePlay,
    seek,
    setVolume,
    setPlayMode,
    setGainMultiplier,
    toggleStereoWide,
    toggleMono,
    setBalance,
    toggleNightMode,
    toggleVirtual8d,
    setVirtual8dSpeed,
    setVirtual8dDepth,
    cycleCrossfeed,
    setCrossfeed,
    toggleDeEsser,
    toggleLoudnessComp,
    toggleOutputMode,
    playNext,
    playPrev,
    addToQueue,
    removeFromQueue,
    clearQueue,
    activateWebAudio,
  };
}
