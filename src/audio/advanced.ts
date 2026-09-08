import { AdvancedSettings, SYSTEMS, TONE_HZ } from './settings';

const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-6));
export interface AudioMetrics {
  input: number[]; output: number[]; peak: number; rms: number;
  crest: number; centroid: number; peakHz: number; clipping: boolean; spectrum: number[]; lufs: number;
}

export class AdvancedAudio {
  input: GainNode;
  output: GainNode;
  private filters: BiquadFilterNode[];
  private trim: GainNode;
  private voice: BiquadFilterNode;
  private cross: GainNode[];
  private meters: AnalyserNode[];
  private weightedMeters: AnalyserNode[];
  private outputMeters: AnalyserNode[] = [];
  private routeNodes: AudioNode[] = [];
  private routeUpdates: Array<(settings: AdvancedSettings) => void> = [];
  private buffers: Float32Array<ArrayBuffer>[];
  private bins: Float32Array<ArrayBuffer>;
  private missingSince = 0;
  private smartSide = -1;
  private weightedBuffer = new Float32Array(32768);
  private lastMeasurementTime = -1;
  private cachedMetrics: AudioMetrics | null = null;
  constructor(private ctx: AudioContext) {
    this.input = ctx.createGain();
    this.input.channelCount = 2;
    this.input.channelCountMode = 'explicit';
    this.output = ctx.createGain();
    this.filters = TONE_HZ.map((frequency, i) => {
      const f = ctx.createBiquadFilter();
      f.type = i === 0 ? 'lowshelf' : i === 6 ? 'highshelf' : 'peaking';
      f.frequency.value = frequency; f.Q.value = 1;
      return f;
    });
    this.trim = ctx.createGain();
    this.voice = ctx.createBiquadFilter();
    this.voice.type = 'peaking'; this.voice.frequency.value = 1800; this.voice.Q.value = 0.7;
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    this.cross = [ctx.createGain(), ctx.createGain()];
    this.cross.forEach(g => g.gain.value = 0);
    this.input.connect(split);
    split.connect(merge, 0, 0); split.connect(merge, 1, 1);
    split.connect(this.cross[0], 0); this.cross[0].connect(merge, 0, 1);
    split.connect(this.cross[1], 1); this.cross[1].connect(merge, 0, 0);
    merge.connect(this.filters[0]);
    this.filters.forEach((f, i) => f.connect(this.filters[i + 1] || this.voice));
    this.voice.connect(this.trim).connect(this.output);
    this.meters = [0, 1].map(i => { const a = ctx.createAnalyser(); a.fftSize = 2048; split.connect(a, i); return a; });
    this.weightedMeters = [0, 1].map(i => {
      const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 1681; shelf.gain.value = 4;
      const highpass = ctx.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 38; highpass.Q.value = 0.5;
      const meter = ctx.createAnalyser(); meter.fftSize = 32768;
      split.connect(shelf, i); shelf.connect(highpass).connect(meter);
      return meter;
    });
    this.buffers = [new Float32Array(2048), new Float32Array(2048)];
    this.bins = new Float32Array(1024);
  }
  update(settings: AdvancedSettings) {
    const now = this.ctx.currentTime;
    this.filters.forEach((f, i) => f.gain.setTargetAtTime(settings.tone[i], now, 0.03));
    this.voice.gain.setTargetAtTime(settings.dialogue * 6, now, 0.03);
    // Keep useful headroom without summing every positive band (which could
    // attenuate an all-band preset to near silence even though bands overlap).
    const positiveBands = settings.tone.filter(gain => gain > 0);
    const boost = Math.min(20, Math.max(0, ...positiveBands) + (positiveBands.length > 2 ? 2 : 0) + settings.dialogue * 6);
    this.trim.gain.setTargetAtTime(Math.pow(10, -boost / 20), now, 0.03);
    this.meters.forEach(m => m.smoothingTimeConstant = settings.smoothing);
    this.routeUpdates.forEach(update => update(settings));
    if (!settings.smartMono) {
      this.cross.forEach(g => g.gain.setTargetAtTime(0, now, 0.04));
      this.smartSide = -1; this.missingSince = 0;
    }
  }
  connectDestination(tail: AudioNode, settings: AdvancedSettings, maxChannels: number) {
    this.routeNodes.forEach(node => node.disconnect());
    this.routeNodes = [];
    this.routeUpdates = [];
    this.outputMeters = [];
    const names = SYSTEMS[settings.system];
    let count: number = names.length <= maxChannels ? names.length : 2;
    // Some mobile browsers report a high maxChannelCount but reject changing
    // the destination. Fall back to stereo instead of breaking all playback.
    try {
      this.ctx.destination.channelCount = count;
      this.ctx.destination.channelInterpretation = 'discrete';
      count = Math.min(count, this.ctx.destination.channelCount || 2);
    } catch {
      count = 2;
    }
    const track = <T extends AudioNode>(node: T) => { this.routeNodes.push(node); return node; };
    const split = track(this.ctx.createChannelSplitter(2));
    tail.connect(split);
    const merge = track(this.ctx.createChannelMerger(count));
    const source = (left: number, right: number) => {
      const mix = track(this.ctx.createGain());
      [left, right].forEach((value, i) => {
        const g = track(this.ctx.createGain()); g.gain.value = value;
        split.connect(g, i); g.connect(mix);
      });
      return mix;
    };
    const outputs = count === 2 ? ['FL', 'FR'] : [...names];
    outputs.forEach((name, index) => {
      const right = name.endsWith('R');
      let node: AudioNode;
      if (name === 'FL' || name === 'FR') node = source(right ? 0 : 1, right ? 1 : 0);
      else if (name === 'C' || name.startsWith('LFE')) node = source(0.5, 0.5);
      else {
        const a = settings.rearAmbience;
        const reverse = right !== settings.rearInvert;
        node = settings.rearDirect ? source(reverse ? 0 : 1, reverse ? 1 : 0)
          : source(reverse ? (a - 1) * 0.5 : 0.5, reverse ? 0.5 : (a - 1) * 0.5);
        const delay = track(this.ctx.createDelay(0.2));
        delay.delayTime.value = (settings.rearDelay + (name.startsWith('B') ? 10 : 0)) / 1000;
        this.routeUpdates.push(s => delay.delayTime.setTargetAtTime((s.rearDelay + (name.startsWith('B') ? 10 : 0)) / 1000, this.ctx.currentTime, 0.04));
        node.connect(delay); node = delay;
      }
      if (name === 'C' || name.startsWith('LFE') || (settings.splitBass && outputs.some(n => n.startsWith('LFE')))) {
        const filter = track(this.ctx.createBiquadFilter());
        filter.type = name.startsWith('LFE') ? 'lowpass' : 'highpass';
        filter.frequency.value = name === 'C' ? settings.centerHz : settings.subHz;
        filter.Q.value = Math.SQRT1_2;
        this.routeUpdates.push(s => filter.frequency.setTargetAtTime(name === 'C' ? s.centerHz : s.subHz, this.ctx.currentTime, 0.04));
        node.connect(filter); node = filter;
      }
      const gain = track(this.ctx.createGain());
      gain.gain.value = settings.channelGains[index]; node.connect(gain); node = gain;
      this.routeUpdates.push(s => gain.gain.setTargetAtTime(s.channelGains[index], this.ctx.currentTime, 0.03));
      if (settings.limiter) {
        // Hard ceiling after channel gains: unlike a stereo compressor this
        // preserves every discrete output channel and cannot silently downmix.
        const ceiling = track(this.ctx.createWaveShaper());
        const curve = new Float32Array(4097);
        for (let i = 0; i < curve.length; i++) curve[i] = Math.max(-0.97, Math.min(0.97, i / 2048 - 1));
        ceiling.curve = curve; ceiling.oversample = 'none';
        node.connect(ceiling); node = ceiling;
      }
      const analyser = track(this.ctx.createAnalyser()); analyser.fftSize = 2048;
      node.connect(analyser); this.outputMeters.push(analyser);
      const target = settings.routing[index];
      if (target >= 0 && target < count) analyser.connect(merge, 0, target);
    });
    merge.connect(this.ctx.destination);
    return count;
  }
  measure(settings: AdvancedSettings): AudioMetrics {
    if (this.cachedMetrics && this.ctx.currentTime - this.lastMeasurementTime < 0.09) return this.cachedMetrics;
    this.lastMeasurementTime = this.ctx.currentTime;
    const rms: number[] = [];
    let peak = 0;
    this.meters.forEach((m, i) => {
      m.getFloatTimeDomainData(this.buffers[i]);
      let sum = 0;
      for (const v of this.buffers[i]) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
      rms.push(Math.sqrt(sum / this.buffers[i].length));
    });
    if (settings.smartMono) {
      const missing = rms[0] > 0.003 && rms[1] < 0.00003 ? 0 : rms[1] > 0.003 && rms[0] < 0.00003 ? 1 : -1;
      if (missing !== this.smartSide) { this.smartSide = missing; this.missingSince = this.ctx.currentTime; }
      const copy = missing >= 0 && this.ctx.currentTime - this.missingSince > 1;
      this.cross.forEach((g, i) => g.gain.setTargetAtTime(copy && i === missing ? 1 : 0, this.ctx.currentTime, 0.08));
    }
    this.meters[0].getFloatFrequencyData(this.bins);
    let weight = 0, weightedHz = 0, max = -Infinity, peakHz = 0;
    const spectrum: number[] = [];
    this.bins.forEach((value, i) => {
      const hz = i * this.ctx.sampleRate / 2048;
      const amplitude = Math.pow(10, value / 20);
      weight += amplitude; weightedHz += hz * amplitude;
      if (value > max) { max = value; peakHz = hz; }
    });
    for (let i = 0; i < 48; i++) {
      const bin = Math.min(1023, Math.round(Math.pow(1023, i / 47)));
      spectrum.push(Math.max(0, Math.min(1, (this.bins[bin] + 90) / 90)));
    }
    const output = this.outputMeters.map(m => {
      m.getFloatTimeDomainData(this.buffers[0]);
      let p = 0; for (const sample of this.buffers[0]) p = Math.max(p, Math.abs(sample));
      return db(p);
    });
    const level = Math.sqrt((rms[0] ** 2 + rms[1] ** 2) / 2);
    // A 400 ms K-weighted estimate; named as an estimate because native Biquad
    // coefficients differ slightly from BS.1770's reference K-weighting filter.
    let weightedPower = 0;
    const weighted = this.weightedBuffer;
    const windowSize = Math.min(32768, Math.round(this.ctx.sampleRate * 0.4));
    for (const meter of this.weightedMeters) {
      meter.getFloatTimeDomainData(weighted);
      for (let i = weighted.length - windowSize; i < weighted.length; i++) weightedPower += weighted[i] ** 2 / windowSize;
    }
    this.cachedMetrics = { input: rms.map(db), output, peak: db(peak), rms: db(level), crest: level > 1e-6 ? db(peak / level) : 0,
      centroid: weight > 1e-8 ? weightedHz / weight : 0, peakHz: max > -90 ? peakHz : 0,
      clipping: output.some(v => v >= -0.3), spectrum, lufs: Math.max(-120, -0.691 + 10 * Math.log10(Math.max(weightedPower, 1e-12))) };
    return this.cachedMetrics;
  }
}
