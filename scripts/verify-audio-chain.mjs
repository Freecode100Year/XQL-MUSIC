// Numerical check of the audio chain's frequency-domain claims.
//
// The chain is built from Web Audio BiquadFilterNodes, whose coefficients are
// fixed by the Audio EQ Cookbook. That means every claim the comments in
// src/hooks make about flatness, headroom and compensation can be checked
// exactly, without a browser and without ears. Run it after touching any filter
// constant:  npm run verify:audio
//
// It reads the constants straight out of the source, so it cannot drift out of
// sync with what actually ships.
import fs from 'fs';

const FS = 48000;

function coeffs(type, f0, Q, gainDb) {
  const w0 = (2 * Math.PI * f0) / FS;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'peaking') {
    const alpha = sw / (2 * Q);
    b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A;
    a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A;
  } else if (type === 'lowshelf') {
    const alpha = (sw / 2) * Math.SQRT2;      // Web Audio fixes S = 1
    const sq = 2 * Math.sqrt(A) * alpha;
    b0 = A * ((A + 1) - (A - 1) * cw + sq);
    b1 = 2 * A * ((A - 1) - (A + 1) * cw);
    b2 = A * ((A + 1) - (A - 1) * cw - sq);
    a0 = (A + 1) + (A - 1) * cw + sq;
    a1 = -2 * ((A - 1) + (A + 1) * cw);
    a2 = (A + 1) + (A - 1) * cw - sq;
  } else if (type === 'highshelf') {
    const alpha = (sw / 2) * Math.SQRT2;
    const sq = 2 * Math.sqrt(A) * alpha;
    b0 = A * ((A + 1) + (A - 1) * cw + sq);
    b1 = -2 * A * ((A - 1) + (A + 1) * cw);
    b2 = A * ((A + 1) + (A - 1) * cw - sq);
    a0 = (A + 1) - (A - 1) * cw + sq;
    a1 = 2 * ((A - 1) - (A + 1) * cw);
    a2 = (A + 1) - (A - 1) * cw - sq;
  } else if (type === 'lowpass') {
    const alpha = sw / (2 * Q);
    b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2;
    a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
  } else if (type === 'highpass') {
    const alpha = sw / (2 * Q);
    b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2;
    a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
  } else throw new Error('unhandled filter type ' + type);
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

// H(e^jw) of one biquad as [re, im].
function resp([b0, b1, b2, a1, a2], f) {
  const w = (2 * Math.PI * f) / FS;
  const c1 = Math.cos(w), s1 = -Math.sin(w);
  const c2 = Math.cos(2 * w), s2 = -Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2, ni = b1 * s1 + b2 * s2;
  const dr = 1 + a1 * c1 + a2 * c2, di = a1 * s1 + a2 * s2;
  const d = dr * dr + di * di;
  return [(nr * dr + ni * di) / d, (ni * dr - nr * di) / d];
}
const mul = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]];
const add = (x, y) => [x[0] + y[0], x[1] + y[1]];
const sub = (x, y) => [x[0] - y[0], x[1] - y[1]];
const scale = (x, k) => [x[0] * k, x[1] * k];
const db = (x) => 20 * Math.log10(Math.max(Math.hypot(x[0], x[1]), 1e-12));

const FREQS = [];
for (let i = 0; i <= 900; i++) FREQS.push(20 * Math.pow(1000, i / 900)); // 20 Hz .. 20 kHz

const eqSrc = fs.readFileSync('src/hooks/useEqualizer.ts', 'utf8');
const playerSrc = fs.readFileSync('src/hooks/usePlayer.ts', 'utf8');
const num = (src, re) => parseFloat(src.match(re)[1]);

const EQ_FREQUENCIES = JSON.parse('[' +
  eqSrc.match(/EQ_FREQUENCIES = \[([\s\S]*?)\]/)[1].replace(/\s/g, '').replace(/,$/, '') + ']');
const EQ_Q = num(eqSrc, /EQ_Q = ([\d.]+)/);
const SKIRT_1 = num(eqSrc, /SKIRT_1 = ([\d.]+)/);
const SKIRT_2 = num(eqSrc, /SKIRT_2 = ([\d.]+)/);
const PREAMP_SAFETY_DB = num(eqSrc, /PREAMP_SAFETY_DB = ([\d.]+)/);

const presets = [];
const reP = /\{ name: '([^']+)', label: '([^']+)',[\s\S]*?gains: (Array\(31\)\.fill\(0\)|\[[^\]]*\])/g;
for (let m; (m = reP.exec(eqSrc));) {
  presets.push({
    label: m[2],
    gains: m[3].startsWith('Array')
      ? Array(31).fill(0)
      : JSON.parse('[' + m[3].slice(1, -1).replace(/\s/g, '').replace(/,$/, '') + ']'),
  });
}

function estimatePeakBoostDb(g) {
  let peak = 0;
  for (let i = 0; i < g.length; i++) {
    const s = g[i] + SKIRT_1 * ((g[i - 1] ?? 0) + (g[i + 1] ?? 0)) + SKIRT_2 * ((g[i - 2] ?? 0) + (g[i + 2] ?? 0));
    if (s > peak) peak = s;
  }
  return peak;
}

let fail = 0;
const bad = (m) => { console.log('  ✗ ' + m); fail++; };
const ok = (m) => console.log('  ✓ ' + m);

// ---------- 1. EQ cascade vs the preamp it is paired with ----------
console.log('\n[1] 31 段 EQ 级联真实峰值 vs 预衰减 (Q=' + EQ_Q + ', 安全余量 ' + PREAMP_SAFETY_DB + ' dB)');
console.log('    预设              真实峰值    预衰减    净残余');
let worstResidual = -99;
for (const p of presets) {
  const secs = EQ_FREQUENCIES.map((f, i) => coeffs('peaking', f, EQ_Q, p.gains[i]));
  let peak = -99;
  for (const f of FREQS) {
    let h = [1, 0];
    for (const s of secs) h = mul(h, resp(s, f));
    peak = Math.max(peak, db(h));
  }
  const est = estimatePeakBoostDb(p.gains);
  const trim = est > 0 ? -(est + PREAMP_SAFETY_DB) : 0;
  const residual = peak + trim;
  worstResidual = Math.max(worstResidual, residual);
  console.log('    ' + p.label.padEnd(16) + (peak >= 0 ? '+' : '') + peak.toFixed(2) + ' dB' +
    '     ' + trim.toFixed(2) + ' dB   ' + (residual >= 0 ? '+' : '') + residual.toFixed(2) + ' dB');
}
if (worstResidual > 0) bad('预衰减不足，最差 +' + worstResidual.toFixed(2) + ' dB 会越过满刻度');
else ok('所有预设经预衰减后均在满刻度以下，最差 ' + worstResidual.toFixed(2) + ' dB');

// ---------- 2. crossfeed centre / side response ----------
// Structure: direct path is a plain wire; the cross path is a lowpass scaled by
// `level`; a lowshelf on the merged output undoes the centre-image lift.
console.log('\n[2] 交叉馈送：中置像平坦度与两侧分离度');
const cfBody = playerSrc.match(/CROSSFEED_PARAMS[\s\S]*?= \{([\s\S]*?)\n\};/)[1];
const CF = {};
for (const m of cfBody.matchAll(
  /(\w+): \{ cutoff: ([\d.]+), level: ([\d.]+), compFreq: ([\d.]+), compDb: (-?[\d.]+) \}/g)) {
  CF[m[1]] = { cutoff: +m[2], level: +m[3], compFreq: +m[4], compDb: +m[5] };
}
for (const [mode, { cutoff, level, compFreq, compDb }] of Object.entries(CF)) {
  const lp = coeffs('lowpass', cutoff, 0.707, 0);
  const comp = coeffs('lowshelf', compFreq, 0.707, compDb);
  let mn = 99, mx = -99, sideMin = 99;
  for (const f of FREQS) {
    const C = scale(resp(lp, f), level);
    const S = resp(comp, f);
    const centre = db(mul(add([1, 0], C), S));
    mn = Math.min(mn, centre); mx = Math.max(mx, centre);
    sideMin = Math.min(sideMin, db(mul(sub([1, 0], C), S)));
  }
  const ripple = mx - mn;
  console.log('    ' + mode.padEnd(7) + ' lp ' + cutoff + ' Hz / cross ' + level +
    ' / 补偿 ' + compFreq + ' Hz ' + compDb + ' dB → 中置起伏 ' + ripple.toFixed(2) +
    ' dB [' + mn.toFixed(2) + '..' + mx.toFixed(2) + ']，两侧最低 ' + sideMin.toFixed(2) + ' dB');
  if (ripple > 1.2) bad(mode + ' 中置像起伏 ' + ripple.toFixed(2) + ' dB，人声会被染色');
}
if (!fail) ok('三档中置像起伏均 ≤ 1.2 dB');

// ---------- 3. de-esser crossover sums flat when the compressor is idle ----------
console.log('\n[3] 齿音抑制 LR4 分频（压缩器静止时）求和平坦度');
{
  const XO = num(playerSrc, /DEESS_CROSSOVER_HZ = (\d+)/);
  const lp = coeffs('lowpass', XO, 0.707, 0);
  const hp = coeffs('highpass', XO, 0.707, 0);
  let mn = 99, mx = -99;
  for (const f of FREQS) {
    const L = mul(resp(lp, f), resp(lp, f));
    const H = mul(resp(hp, f), resp(hp, f));
    const d = db(add(L, H));
    mn = Math.min(mn, d); mx = Math.max(mx, d);
  }
  console.log('    分频点 ' + XO + ' Hz → 求和 ' + mn.toFixed(3) + '..' + mx.toFixed(3) + ' dB');
  if (mx - mn > 0.3) bad('LR4 求和起伏 ' + (mx - mn).toFixed(2) + ' dB，开关该模块会改变音色');
  else ok('LR4 求和平坦，压缩器不动作时模块透明');
}

// ---------- 4. Marshall voicing vs its trim ----------
console.log('\n[4] 音箱外放 Marshall 曲线峰值 vs 配套削减');
{
  const specs = [...playerSrc.matchAll(
    /\{ type: '(\w+)', freq: ([\d.]+), q: ([\d.]+), gain: (-?[\d.]+) \}/g)]
    .map((x) => ({ type: x[1], freq: +x[2], q: +x[3], gain: +x[4] }));
  const trimDb = -num(playerSrc, /MARSHALL_TRIM = Math\.pow\(10, -(\d+) \/ 20\)/);
  const secs = specs.map((s) => coeffs(s.type, s.freq, s.q, s.gain));
  let peak = -99;
  for (const f of FREQS) {
    let h = [1, 0];
    for (const s of secs) h = mul(h, resp(s, f));
    peak = Math.max(peak, db(h));
  }
  console.log('    ' + specs.length + ' 段级联峰值 +' + peak.toFixed(2) + ' dB，削减 ' + trimDb +
    ' dB → 净 ' + (peak + trimDb).toFixed(2) + ' dB');
  if (peak + trimDb > 0) bad('Marshall 曲线净增益 +' + (peak + trimDb).toFixed(2) + ' dB，会顶限制器');
  else ok('Marshall 曲线净增益 ≤ 0 dB');
}

// ---------- 5. headroom at the limiter across the volume range ----------
// The optional loudness contour and the 1-2x boost are deliberate gain; the limiter is
// there to catch; what must not overflow on its own is EQ + equal-loudness.
console.log('\n[5] 各音量点上 EQ + 等响度补偿的净电平（限制器阈值 ' +
  num(playerSrc, /limiter\.threshold\.value = (-?[\d.]+)/) + ' dB）');
{
  for (const v of [1.0, 0.8, 0.5, 0.3, 0.1]) {
    const attenDb = 20 * Math.log10(v * v);
    const low = Math.min(6, Math.max(0, -attenDb * 0.35));
    const net = attenDb + low + worstResidual;
    console.log('    音量 ' + v.toFixed(1) + ' → 音量衰减 ' + attenDb.toFixed(1) +
      ' dB，等响度 +' + low.toFixed(1) + ' dB，净 ' + net.toFixed(1) + ' dB');
    if (net > 0) bad('音量 ' + v + ' 时净增益 +' + net.toFixed(1) + ' dB 超过满刻度');
  }
  if (!fail) ok('各音量点均在满刻度以下，限制器只作末级保护');
}

console.log('\n' + (fail ? '✗ ' + fail + ' 项未通过' : '✓ 全部通过'));
process.exit(fail ? 1 : 0);
