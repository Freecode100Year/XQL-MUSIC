import type { Trajectory } from './settings';

// The position signals run on the audio clock, including when rendering is
// throttled. This needs no animation frame or background JavaScript timer.
export class SpatialOrbit {
  input: GainNode;
  output: GainNode;
  panner: PannerNode;
  oscillator: OscillatorNode;
  lfoDepth: GainNode;
  private zOsc: OscillatorNode;
  private yOsc: OscillatorNode;
  private zDepth: GainNode;
  private yDepth: GainNode;
  constructor(private ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.panner = ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.rolloffFactor = 0;
    this.oscillator = ctx.createOscillator();
    this.zOsc = ctx.createOscillator();
    this.yOsc = ctx.createOscillator();
    this.zOsc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, -1]), new Float32Array([0, 0])));
    this.lfoDepth = ctx.createGain();
    this.zDepth = ctx.createGain();
    this.yDepth = ctx.createGain();
    this.oscillator.connect(this.lfoDepth).connect(this.panner.positionX);
    this.zOsc.connect(this.zDepth).connect(this.panner.positionZ);
    this.yOsc.connect(this.yDepth).connect(this.panner.positionY);
    this.input.connect(this.panner).connect(this.output);
    this.update(0.075, 0.78, 'circle');
    const start = ctx.currentTime;
    this.oscillator.start(start); this.zOsc.start(start); this.yOsc.start(start);
  }
  update(speed: number, depth: number, trajectory: Trajectory) {
    const now = this.ctx.currentTime;
    this.oscillator.frequency.setTargetAtTime(speed, now, 0.08);
    this.zOsc.frequency.setTargetAtTime(speed, now, 0.08);
    this.yOsc.frequency.setTargetAtTime(speed * 2, now, 0.08);
    this.lfoDepth.gain.setTargetAtTime(depth * 2, now, 0.08);
    this.zDepth.gain.setTargetAtTime(trajectory === 'pendulum' ? 0 : depth * 2, now, 0.08);
    this.yDepth.gain.setTargetAtTime(trajectory === 'orbital' ? depth : 0, now, 0.08);
    this.panner.positionZ.setTargetAtTime(trajectory === 'pendulum' ? -1 : 0, now, 0.08);
  }
  dispose() {
    for (const osc of [this.oscillator, this.zOsc, this.yOsc]) { osc.stop(); osc.disconnect(); }
    this.input.disconnect(); this.output.disconnect(); this.panner.disconnect();
  }
}
