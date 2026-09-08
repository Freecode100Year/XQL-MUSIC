import React, { useEffect, useRef, useState } from 'react';
import type { usePlayer } from '../hooks/usePlayer';
import type { useEqualizer } from '../hooks/useEqualizer';
import { useI18n } from '../i18n';
import { AdvancedSettings, DEFAULT_ADVANCED, sanitizeAdvanced, SYSTEMS, System, TONE_HZ, Trajectory, bounded } from '../audio/settings';
import type { AudioMetrics } from '../audio/advanced';

type Player = ReturnType<typeof usePlayer>;
type Equalizer = ReturnType<typeof useEqualizer>;
interface Preset {
  name: string; advanced: AdvancedSettings; gain: number; balance: number;
  night: boolean; mono: boolean; wide: boolean; virtual: boolean; speed: number; depth: number;
  crossfeed: string; deEsser: boolean; loudness: boolean; output: string; volume: number;
  eqEnabled: boolean; eqGains: number[];
}
const PRESETS_KEY = 'xql_audio_presets_v1';
function sanitizePreset(value: unknown): Preset {
  if (!value || typeof value !== 'object') throw new Error('Invalid preset');
  const x = value as Record<string, unknown>;
  if (typeof x.name !== 'string' || !x.name.trim() || !x.advanced || typeof x.advanced !== 'object') throw new Error('Invalid preset');
  return {
    name: x.name.trim().slice(0, 60), advanced: sanitizeAdvanced(x.advanced),
    gain: bounded(x.gain, 1, 0, 3), balance: bounded(x.balance, 0, -1, 1),
    night: x.night === true, mono: x.mono === true, wide: x.wide === true, virtual: x.virtual === true,
    speed: bounded(x.speed, 0.075, 0.03, 0.2), depth: bounded(x.depth, 0.78, 0.15, 1),
    crossfeed: ['off', 'light', 'medium', 'strong'].includes(String(x.crossfeed)) ? String(x.crossfeed) : 'off',
    deEsser: x.deEsser === true, loudness: x.loudness === true, output: x.output === 'speaker' ? 'speaker' : 'headphone',
    volume: bounded(x.volume, 0.8, 0, 1), eqEnabled: x.eqEnabled === true,
    eqGains: Array.from({ length: 31 }, (_, i) => bounded(Array.isArray(x.eqGains) ? x.eqGains[i] : undefined, 0, -20, 20)),
  };
}
function loadPresets(): Preset[] {
  try { const values = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); return Array.isArray(values) ? values.slice(0, 30).map(sanitizePreset) : []; } catch { return []; }
}

export function AudioStudio({ player: p, eq, onClose, onOpenEqualizer }: {
  player: Player; eq: Equalizer; onClose: () => void; onOpenEqualizer: () => void;
}) {
  const { locale } = useI18n();
  const tx = (zh: string, en: string) => locale === 'zh-CN' ? zh : en;
  const [tab, setTab] = useState('sound');
  const [presets, setPresets] = useState(loadPresets);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [metrics, setMetrics] = useState<AudioMetrics | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const a = p.advanced;
  const put = (patch: Partial<AdvancedSettings>) => p.setAdvanced(patch);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]') || []).filter(e => e.getClientRects().length);
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);

  useEffect(() => {
    if (tab !== 'analysis') return;
    let frame = 0, last = 0, lastText = 0, quietSince = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (document.hidden) return;
      const fps = a.fps || (window.innerWidth < 768 ? 15 : 30);
      if (now - last < 1000 / fps) return;
      last = now;
      const result = p.getAudioMetrics();
      if (now - lastText > 200) { setMetrics(result); lastText = now; }
      if (!result || !canvas.current) return;
      if (result.rms < -70) { if (!quietSince) quietSince = now; } else quietSince = 0;
      if (a.silenceSave && quietSince && now - quietSince > a.silenceSeconds * 1000) return;
      const ctx = canvas.current.getContext('2d');
      if (!ctx) return;
      const { width, height } = canvas.current;
      ctx.clearRect(0, 0, width, height);
      result.spectrum.forEach((value, i) => {
        ctx.fillStyle = `hsl(${190 + i * 1.8}, 80%, 55%)`;
        ctx.fillRect(i * width / 48, height * (1 - value), width / 48 - 2, height * value);
      });
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [tab, p.getAudioMetrics, a.fps, a.silenceSave, a.silenceSeconds]);

  const toggle = (label: string, enabled: boolean, action: () => void, hint?: string) => (
    <button type="button" className={`studio-toggle ${enabled ? 'active' : ''}`} aria-pressed={enabled} onClick={action}>
      <span>{label}{hint && <small>{hint}</small>}</span><strong>{enabled ? tx('开启', 'On') : tx('关闭', 'Off')}</strong>
    </button>
  );
  const range = (label: string, value: number, min: number, max: number, step: number, change: (n: number) => void, unit = '') => (
    <label className="studio-range"><span>{label}<output>{Number(value.toFixed(2))}{unit}</output></span>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e => change(Number(e.target.value))} />
      <small>{min}{unit} <span>{max}{unit}</span></small>
    </label>
  );
  const snapshot = (label: string): Preset => ({ name: label, advanced: a, gain: p.gainMultiplier, balance: p.balance,
    night: p.nightMode, mono: p.spatialMode === 'mono', wide: p.spatialMode === 'wide', virtual: p.virtual8d,
    speed: p.virtual8dSpeed, depth: p.virtual8dDepth, crossfeed: p.crossfeedMode,
    deEsser: p.deEsser, loudness: p.loudnessComp, output: p.outputMode, volume: p.volume,
    eqEnabled: eq.enabled, eqGains: [...eq.gains] });
  const persist = (items: Preset[]) => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(items)); setPresets(items);
  };
  const apply = (preset: Preset) => {
    p.setAdvanced(preset.advanced); p.setGainMultiplier(preset.gain); p.setBalance(preset.balance);
    p.setVolume(preset.volume);
    if (p.nightMode !== preset.night) p.toggleNightMode();
    if (p.virtual8d !== preset.virtual) p.toggleVirtual8d();
    if (preset.mono && p.spatialMode !== 'mono') p.toggleMono();
    else if (!preset.mono && preset.wide && p.spatialMode !== 'wide') p.toggleStereoWide();
    else if (!preset.mono && !preset.wide) { if (p.spatialMode === 'wide') p.toggleStereoWide(); if (p.spatialMode === 'mono') p.toggleMono(); }
    if (p.outputMode !== preset.output) p.toggleOutputMode();
    if (p.deEsser !== preset.deEsser) p.toggleDeEsser();
    if (p.loudnessComp !== preset.loudness) p.toggleLoudnessComp();
    p.setCrossfeed(preset.crossfeed as 'off' | 'light' | 'medium' | 'strong');
    p.setVirtual8dSpeed(preset.speed); p.setVirtual8dDepth(preset.depth);
    eq.setCurve(preset.eqGains, preset.eqEnabled);
    setNotice(tx('已应用：', 'Applied: ') + preset.name);
  };
  const factory = (mode: string) => {
    const preset = sanitizePreset({ ...snapshot(mode), advanced: { ...DEFAULT_ADVANCED, theme: a.theme, remember: a.remember },
      gain: 1, balance: 0, night: false, mono: false, wide: false, virtual: false,
      crossfeed: 'off', deEsser: false, loudness: false, eqEnabled: false, eqGains: Array(31).fill(0) });
    if (mode === 'Music') { preset.wide = true; preset.advanced.tone = [2, 0, -1, 0, 1, 0, 1]; }
    if (mode === 'Cinema') { preset.night = true; preset.advanced.dialogue = 0.4; preset.advanced.tone = [3, 1, 0, 0, 1, 0, 0]; }
    if (mode === 'Voice') { preset.mono = true; preset.deEsser = true; preset.advanced.dialogue = 0.7; preset.advanced.tone = [-3, -1, 0, 2, 1, -1, -2]; }
    if (mode === 'Gaming') { preset.advanced.tone = [-2, -1, 0, 1, 2, 1, 0]; preset.advanced.dialogue = 0.3; }
    if (mode === '8D') { preset.virtual = true; preset.advanced.trajectory = 'circle'; }
    apply(preset);
  };
  const exportPresets = () => {
    const blob = new Blob([JSON.stringify({ format: 'xql-audio-presets', version: 1, presets: [snapshot(tx('当前设置', 'Current settings')), ...presets] }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'xql-audio-presets.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importPresets = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error('Too large');
      const data = JSON.parse(await file.text());
      if (data.format !== 'xql-audio-presets' || data.version !== 1 || !Array.isArray(data.presets) || data.presets.length > 30) throw new Error('Invalid format');
      const imported = data.presets.map(sanitizePreset);
      persist([...presets, ...imported].slice(-30)); setNotice(tx('预设已导入，选择一个即可应用。', 'Presets imported. Select one to apply.'));
    } catch { setNotice(tx('导入失败：请使用本网站导出的预设文件（小于 1 MB）。', 'Import failed: use a preset exported by this site (under 1 MB).')); }
  };

  return <div className="studio-overlay" onClick={onClose}>
    <div className="studio-panel" role="dialog" aria-modal="true" aria-labelledby="studio-title" tabIndex={-1} ref={dialog} onClick={e => e.stopPropagation()}>
      <header className="studio-header"><div><small>XQL MUSIC</small><h2 id="studio-title">{tx('音频增强器', 'Audio enhancer')}</h2></div>
        <button type="button" className="studio-close" aria-label={tx('关闭面板', 'Close panel')} onClick={onClose}>×</button></header>
      <div className="studio-master">{toggle(tx('启用音效处理', 'Enable audio effects'), p.processingEnabled, () => p.setProcessingEnabled(!p.processingEnabled))}
        <p>{p.processingEnabled ? tx('音效模式 · 戴上耳机体验 8D；手机锁屏可能暂停音效播放。', 'Effects mode · Headphones recommended. Mobile lock screens may suspend effects playback.') : tx('原生播放 · 锁屏优先；开启音效后下面的调节才会生效。', 'Native playback · Lock-screen priority. Enable effects to hear these controls.')}</p>
      </div>
      <nav className="studio-tabs" aria-label={tx('音频设置分类', 'Audio settings sections')}>
        {[['sound', '声音', 'Sound'], ['channels', '声道', 'Channels'], ['presets', '预设', 'Presets'], ['analysis', '分析', 'Analysis'], ['settings', '设置', 'Settings']].map(([id, zh, en]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{tx(zh, en)}</button>)}
      </nav>
      <div className="studio-scroll">
        {notice && <p className="studio-notice" role="status">{notice}</p>}
        {tab === 'sound' && <>
          <section className="studio-system"><small>{tx('音频系统', 'Audio system')}</small><h3>{p.virtual8d ? tx('2 声道 · 8D 虚拟', '2 channels · Virtual 8D') : a.system + tx(' 声道', ' channels')}</h3>
            <div className="studio-actions"><button onClick={() => { if (p.virtual8d) p.toggleVirtual8d(); put({ system: '2.0' }); }}>{tx('立体声', 'Stereo')}</button><button onClick={() => { if (!p.virtual8d) p.toggleVirtual8d(); put({ system: '2.0' }); }}>8D · HRTF</button><button onClick={() => setTab('channels')}>{tx('环绕声', 'Surround')}</button></div>
          </section>
          {range(tx('预放大（输入）', 'Input pre-amplification'), p.gainMultiplier * 100, 0, 300, 1, n => p.setGainMultiplier(n / 100), '%')}
          {range(tx('播放音量', 'Playback volume'), p.volume * 100, 0, 100, 1, n => p.setVolume(n / 100), '%')}
          {toggle(tx('2 声道 8D 虚拟', '2-channel virtual 8D'), p.virtual8d, () => { if (!p.virtual8d) put({ system: '2.0' }); p.toggleVirtual8d(); })}
          {p.virtual8d && <section className="studio-card">
            <label>{tx('移动轨迹', 'Trajectory')}<select value={a.trajectory} onChange={e => put({ trajectory: e.target.value as Trajectory })}><option value="circle">{tx('环绕', 'Circular')}</option><option value="orbital">{tx('空间轨道', 'Orbital')}</option><option value="pendulum">{tx('左右钟摆', 'Pendulum')}</option></select></label>
            {range(tx('旋转速度', 'Rotation speed'), p.virtual8dSpeed * 60, 1.8, 12, 0.3, n => p.setVirtual8dSpeed(n / 60), tx(' 次/分', ' cycles/min'))}
            {range(tx('空间幅度', 'Spatial depth'), p.virtual8dDepth * 100, 15, 100, 1, n => p.setVirtual8dDepth(n / 100), '%')}
          </section>}
          {toggle(tx('立体声增强', 'Stereo widening'), p.spatialMode === 'wide', p.toggleStereoWide)}
          {toggle(tx('单声道', 'Mono'), p.spatialMode === 'mono', p.toggleMono)}
          {toggle(tx('智能补全单侧声音', 'Smart mono recovery'), a.smartMono, () => put({ smartMono: !a.smartMono }), tx('持续一秒仅一侧有声时复制到另一侧', 'Copies a channel when the other has been silent for one second'))}
          {range(tx('左右平衡', 'Left / right balance'), p.balance * 100, -100, 100, 1, n => p.setBalance(n / 100))}
          <button className="studio-secondary" onClick={() => p.setBalance(0)}>{tx('恢复居中', 'Center balance')}</button>
          {toggle(tx('夜间模式', 'Night mode'), p.nightMode, p.toggleNightMode)}
          {range(tx('人声清晰度', 'Voice clarity'), a.dialogue * 100, 0, 100, 1, n => put({ dialogue: n / 100 }), '%')}
          {toggle(tx('自动音量均衡', 'Automatic loudness leveling'), a.normalize, () => put({ normalize: !a.normalize }))}
          {toggle(tx('峰值限制器', 'Peak limiter'), a.limiter, () => put({ limiter: !a.limiter }))}
          {toggle(tx('耳机交叉馈送 · ', 'Headphone crossfeed · ') + p.crossfeedMode, p.crossfeedMode !== 'off', p.cycleCrossfeed)}
          {toggle(tx('齿音抑制', 'De-esser'), p.deEsser, p.toggleDeEsser)}
          {toggle(tx('等响度补偿', 'Loudness compensation'), p.loudnessComp, p.toggleLoudnessComp)}
          {toggle(tx('音箱外放曲线', 'Speaker voicing'), p.outputMode === 'speaker', p.toggleOutputMode)}
          <h3>{tx('7 段快速均衡器', '7-band quick EQ')}</h3>
          {TONE_HZ.map((frequency, i) => <React.Fragment key={frequency}>{range(`${frequency} Hz`, a.tone[i], -12, 12, 0.5, n => put({ tone: a.tone.map((v, j) => i === j ? n : v) }), ' dB')}</React.Fragment>)}
          <div className="studio-actions"><button onClick={() => put({ tone: Array(7).fill(0) })}>{tx('重置 7 段', 'Reset 7 bands')}</button><button onClick={() => { onClose(); onOpenEqualizer(); }}>{tx('打开 31 段精细均衡器', 'Open 31-band equalizer')}</button></div>
        </>}
        {tab === 'channels' && <>
          <p>{tx('设备报告最大声道数：', 'Reported hardware channels: ')}{p.hardwareChannels} · {tx('当前输出：', 'Current output: ')}{p.activeChannels}</p>
          <p className="studio-hint">{tx('环绕声由立体声上混生成。HDMI / SPDIF 的实际输出取决于系统和接收器；网页不能强制突破设备报告的声道数。', 'Surround is upmixed from stereo. HDMI / SPDIF output depends on your system and receiver; the website cannot override reported hardware limits.')}</p>
          <label>{tx('音频系统', 'Audio system')}<select value={a.system} onChange={e => { put({ system: e.target.value as System }); if (p.virtual8d && e.target.value !== '2.0') p.toggleVirtual8d(); }}>
            {Object.entries(SYSTEMS).map(([system, channels]) => <option key={system} value={system} disabled={channels.length > p.hardwareChannels}>{system} — {channels.length} {tx('声道', 'channels')}{channels.length > p.hardwareChannels ? tx('（设备不支持）', ' (unavailable)') : ''}</option>)}
          </select></label>
          <p className="studio-hint">{tx('先启用音效以检测声卡。测试音为短促低音量提示；每行对应一个物理输出。', 'Enable effects to detect hardware. Test tones are brief and quiet. Each row maps to a physical output.')}</p>
          {SYSTEMS[a.system].map((channel, i) => <section className="studio-card" key={channel}>
            {range(channel, a.channelGains[i] * 100, 0, 200, 1, n => put({ channelGains: a.channelGains.map((v, j) => i === j ? n / 100 : v) }), '%')}
            <label>{tx('路由到输出', 'Route to output')}<select value={a.routing[i]} onChange={e => {
              const target = Number(e.target.value), routing = [...a.routing];
              const other = target < 0 ? -1 : routing.findIndex((v, j) => j !== i && v === target);
              if (other >= 0) routing[other] = routing[i]; routing[i] = target; put({ routing });
            }}><option value={-1}>{tx('静音 / 不分配', 'Mute / unassigned')}</option>{SYSTEMS[a.system].map((name, j) => <option key={j} value={j}>{j + 1} · {name}</option>)}</select></label>
            <button className="studio-secondary" disabled={!p.processingEnabled || a.routing[i] < 0 || a.routing[i] >= p.activeChannels} onClick={() => p.testChannel(a.routing[i])}>{tx('测试这个输出', 'Test this output')}</button>
          </section>)}
          <button className="studio-secondary" onClick={() => put({ routing: [...DEFAULT_ADVANCED.routing], channelGains: [...DEFAULT_ADVANCED.channelGains] })}>{tx('重置路由与声道音量', 'Reset routing and channel levels')}</button>
          <h3>{tx('中置与低音炮滤波', 'Center / subwoofer filters')}</h3>
          {range(tx('中置高通', 'Center high-pass'), a.centerHz, 40, 1000, 10, n => put({ centerHz: n }), ' Hz')}
          {range(tx('低音炮低通', 'Subwoofer low-pass'), a.subHz, 40, 250, 5, n => put({ subHz: n }), ' Hz')}
          {toggle(tx('主音箱分离低频', 'Bass management'), a.splitBass, () => put({ splitBass: !a.splitBass }))}
          <h3>{tx('后置音箱', 'Rear speakers')}</h3>
          {range(tx('后置延迟', 'Rear delay'), a.rearDelay, 0, 100, 1, n => put({ rearDelay: n }), ' ms')}
          {range(tx('后置氛围', 'Rear ambience'), a.rearAmbience * 100, 0, 100, 1, n => put({ rearAmbience: n / 100 }), '%')}
          {toggle(tx('后置直送前置音频', 'Direct front signal to rear'), a.rearDirect, () => put({ rearDirect: !a.rearDirect }))}
          {toggle(tx('交换后置左右', 'Swap rear left / right'), a.rearInvert, () => put({ rearInvert: !a.rearInvert }))}
        </>}
        {tab === 'presets' && <>
          <h3>{tx('内置音频模式', 'Built-in audio modes')}</h3>
          <div className="studio-actions">{[['Default','默认'],['Music','音乐'],['Cinema','影院'],['Voice','人声 / 播客'],['Gaming','游戏'],['8D','8D 环绕']].map(([id, zh]) => <button key={id} onClick={() => factory(id)}>{tx(zh, id)}</button>)}</div>
          <label>{tx('保存当前全部音频设置', 'Save all current audio settings')}<input maxLength={60} placeholder={tx('预设名称', 'Preset name')} value={name} onChange={e => setName(e.target.value)} /></label>
          <button className="studio-secondary" disabled={!name.trim() || presets.length >= 29} onClick={() => { try { persist([...presets, snapshot(name.trim())]); setName(''); setNotice(tx('预设已保存', 'Preset saved')); } catch { setNotice(tx('设备储存不可用', 'Device storage unavailable')); } }}>{tx('保存预设', 'Save preset')}</button>
          {presets.map((preset, i) => <div className="studio-preset" key={i}><button onClick={() => apply(preset)}>{preset.name}</button><button aria-label={tx('删除 ', 'Delete ') + preset.name} onClick={() => { try { persist(presets.filter((_, j) => j !== i)); } catch { setNotice(tx('删除失败', 'Could not delete')); } }}>×</button></div>)}
          <div className="studio-actions"><button onClick={exportPresets}>{tx('导出预设', 'Export presets')}</button><label className="studio-import">{tx('导入预设', 'Import presets')}<input type="file" accept=".json,application/json" onChange={e => { void importPresets(e.target.files?.[0]); e.target.value = ''; }} /></label></div>
          <p className="studio-hint">{tx('导出文件可在其它设备导入，不需要注册或登录。', 'Import the exported file on another device. No account required.')}</p>
        </>}
        {tab === 'analysis' && <>
          <p>{!metrics ? tx('等待音效播放。请先启用音效并播放歌曲。', 'Waiting for effects playback. Enable effects and play a song.') : tx('实时音频分析', 'Live audio analysis')}</p>
          <canvas ref={canvas} width={640} height={180} aria-label={tx('输入频谱', 'Input spectrum')} />
          {metrics && <>
            <p>{tx('瞬时响度估算（400 ms）', 'Momentary loudness estimate (400 ms)')}: {metrics.lufs.toFixed(1)} LUFS</p>
            <div className="studio-metrics">{[[tx('输入峰值','Input peak'), metrics.peak.toFixed(1) + ' dBFS'], ['RMS', metrics.rms.toFixed(1) + ' dBFS'], [tx('峰均比','Crest factor'), metrics.crest.toFixed(1) + ' dB'], [tx('峰值频率','Peak frequency'), Math.round(metrics.peakHz) + ' Hz'], [tx('频谱重心','Spectral centroid'), Math.round(metrics.centroid) + ' Hz'], [tx('输出削波','Output clipping'), metrics.clipping ? tx('检测到','Detected') : tx('无','None')]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
            <h3>{tx('输入电平', 'Input levels')}</h3>{metrics.input.map((v, i) => <label key={i}>{i ? 'R' : 'L'} · {v.toFixed(1)} dBFS<meter min={-90} max={0} value={v} /></label>)}
            <h3>{tx('输出峰值', 'Output peaks')}</h3>{metrics.output.map((v, i) => <label key={i}>{i + 1} · {v.toFixed(1)} dBFS<meter min={-90} max={0} value={v} /></label>)}
          </>}
          <p className="studio-hint">{tx('响度为 K 加权估算，其它指标为采样峰值、RMS 和峰均比，供调音参考。', 'Loudness is a K-weighted estimate; sample peak, RMS and crest factor are provided for tuning reference.')}</p>
        </>}
        {tab === 'settings' && <>
          <label>{tx('主题', 'Theme')}<select value={a.theme} onChange={e => put({ theme: e.target.value as AdvancedSettings['theme'] })}><option value="auto">{tx('跟随系统', 'System')}</option><option value="dark">{tx('深色', 'Dark')}</option><option value="light">{tx('浅色', 'Light')}</option></select></label>
          <label>{tx('频谱刷新率', 'Visualizer frame rate')}<select value={a.fps} onChange={e => put({ fps: Number(e.target.value) })}>{[0,15,30,60].map(n => <option key={n} value={n}>{n ? n + ' FPS' : tx('自动', 'Auto')}</option>)}</select></label>
          {range(tx('频谱平滑', 'Spectrum smoothing'), a.smoothing, 0, 0.95, 0.05, n => put({ smoothing: n }))}
          {toggle(tx('静音时暂停频谱绘制', 'Pause spectrum drawing during silence'), a.silenceSave, () => put({ silenceSave: !a.silenceSave }))}
          {range(tx('静音等待', 'Silence timeout'), a.silenceSeconds, 2, 60, 1, n => put({ silenceSeconds: n }), tx(' 秒', ' s'))}
          {toggle(tx('记住增强器设置', 'Remember enhancer settings'), a.remember, () => put({ remember: !a.remember }))}
          <p>{tx('页面语言跟随浏览器首选语言。声音设置保存在本机。', 'Page language follows browser preferences. Audio settings stay on this device.')}</p>
          <p className="studio-hint">{tx('快捷键（网页获得焦点时）：Alt + Shift + U 打开面板；Alt + Shift + S 启停音效；Alt + Shift + ↑ / ↓ 调节预放大。', 'While this page is focused: Alt + Shift + U opens the panel; Alt + Shift + S toggles effects; Alt + Shift + ↑ / ↓ adjusts preamp.')}</p>
          <p className="studio-hint">{tx('本面板只处理本网站音乐。Chrome 跨标签页捕获、工具栏闪烁、Google 账号同步属于扩展权限；网页版用本站处理、状态提示和预设导入导出替代。', 'This panel processes this site’s music. Cross-tab capture, toolbar blinking and Google account sync require extension privileges; this version uses site audio, visible status and preset import/export.')}</p>
        </>}
        <div className="studio-bottom">{tx('所有选项已显示', 'End of settings')}</div>
      </div>
    </div>
  </div>;
}
