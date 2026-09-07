import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { EQ_LABELS, EQ_PRESETS, EqPreset, estimatePeakBoostDb, preampGainFor } from '../hooks/useEqualizer';
import { OutputMode } from '../utils/storage';
import { TranslationKey, useI18n } from '../i18n';

interface EqualizerProps {
  visible: boolean;
  onClose: () => void;
  gains: number[];
  enabled: boolean;
  bypassed: boolean;
  preset: string;
  onSetBandGain: (index: number, gain: number) => void;
  onReset: () => void;
  onSetEnabled: (on: boolean) => void;
  onSetBypassed: (on: boolean) => void;
  onApplyPreset: (name: string) => void;
  deEsser: boolean;
  loudnessComp: boolean;
  outputMode: OutputMode;
  onToggleDeEsser: () => void;
  onToggleLoudnessComp: () => void;
}

const DB_MARKS = [20, 10, 0, -10, -20];
const BAND_COUNT = 31;
const STEP = 0.5;

function generateCurvePaths(gains: number[]): { line: string; fill: string } {
  const points = gains.map((g, i) => ({ x: i + 0.5, y: 20 - g }));
  if (points.length < 2) return { line: '', fill: '' };
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const fillD = d + ` L ${last.x.toFixed(2)} 20 L ${first.x.toFixed(2)} 20 Z`;
  return { line: d, fill: fillD };
}

export const Equalizer = React.memo(function Equalizer({
  visible, onClose, gains, enabled, bypassed, preset,
  onSetBandGain, onReset, onSetEnabled, onSetBypassed, onApplyPreset,
  deEsser, loudnessComp, outputMode, onToggleDeEsser, onToggleLoudnessComp,
}: EqualizerProps) {
  const { t, locale } = useI18n();
  const [hoveredBand, setHoveredBand] = useState<number | null>(null);
  const gainsRef = useRef(gains);
  gainsRef.current = gains;
  const repeatRef = useRef<{ timeout?: number; interval?: number }>({});

  const stopRepeat = useCallback(() => {
    if (repeatRef.current.timeout) {
      clearTimeout(repeatRef.current.timeout);
      repeatRef.current.timeout = undefined;
    }
    if (repeatRef.current.interval) {
      clearInterval(repeatRef.current.interval);
      repeatRef.current.interval = undefined;
    }
  }, []);

  useEffect(() => {
    const handleUp = () => stopRepeat();
    window.addEventListener('pointerup', handleUp);
    return () => {
      stopRepeat();
      window.removeEventListener('pointerup', handleUp);
    };
  }, [stopRepeat]);

  const adjustOnce = useCallback((index: number, dir: 1 | -1) => {
    const cur = gainsRef.current[index];
    const next = Math.round(Math.max(-20, Math.min(20, cur + dir * STEP)) * 2) / 2;
    if (next === cur) return;
    const updated = [...gainsRef.current];
    updated[index] = next;
    gainsRef.current = updated;
    onSetBandGain(index, next);
  }, [onSetBandGain]);

  const handlePointerDown = useCallback((index: number, dir: 1 | -1) => {
    stopRepeat();
    adjustOnce(index, dir);
    repeatRef.current.timeout = window.setTimeout(() => {
      repeatRef.current.timeout = undefined;
      repeatRef.current.interval = window.setInterval(() => adjustOnce(index, dir), 80);
    }, 350);
  }, [adjustOnce, stopRepeat]);

  const handleDoubleClick = useCallback((index: number) => {
    onSetBandGain(index, 0);
  }, [onSetBandGain]);

  const curvePaths = useMemo(() => generateCurvePaths(gains), [gains]);
  const safety = useMemo(() => {
    const peak = estimatePeakBoostDb(gains);
    const preamp = 20 * Math.log10(preampGainFor(gains, enabled));
    return { peak, preamp };
  }, [gains, enabled]);

  const startCompare = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    onSetBypassed(true);
  }, [onSetBypassed]);

  const stopCompare = useCallback(() => onSetBypassed(false), [onSetBypassed]);

  if (!visible) return null;

  return (
    <div className="eq-overlay" onClick={onClose}>
      <div className="eq-panel" onClick={(e) => e.stopPropagation()}>
        <div className="eq-header">
          <div className="eq-title-row">
            <h3>{t('eq.title')}<span className="eq-subtitle">{t('eq.subtitle')}</span></h3>
            <div className="eq-header-actions">
              <label className="eq-toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => onSetEnabled(e.target.checked)}
                />
                <span className="eq-toggle-slider" />
                <span className="eq-toggle-label">{enabled ? 'ON' : 'OFF'}</span>
              </label>
              <button className="eq-reset-btn" onClick={onReset} title={t('eq.reset')}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                </svg>
              </button>
              <button
                className={`eq-compare-btn ${bypassed ? 'active' : ''}`}
                onPointerDown={startCompare}
                onPointerUp={stopCompare}
                onPointerCancel={stopCompare}
                onLostPointerCapture={stopCompare}
                disabled={!enabled}
                title={t('eq.compareTitle')}
              >
                {bypassed ? t('eq.comparing') : t('eq.compare')}
              </button>
              <button className="eq-close-btn" onClick={onClose}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          </div>
          <div className="eq-presets">
            {EQ_PRESETS.map((p: EqPreset) => (
              <button
                key={p.name}
                className={`eq-preset-btn ${preset === p.name ? 'active' : ''}`}
                onClick={() => onApplyPreset(p.name)}
                title={locale === 'zh-CN' ? p.hint : t('eq.presetHint')}
              >
                {t(`eq.preset.${p.name}` as TranslationKey)}
              </button>
            ))}
          </div>
          <p className="eq-note">
            {t('eq.note')}
          </p>
          {enabled && (
            <div className="eq-safety">
              {bypassed
                ? t('eq.bypassNotice')
                : safety.peak > 0
                  ? t('eq.preampNotice', { value: safety.preamp.toFixed(1) })
                  : t('eq.noPreampNotice')}
            </div>
          )}
          <div className="eq-switch-row">
            <button
              className={`eq-switch ${deEsser && outputMode === 'headphone' ? 'active' : ''}`}
              onClick={onToggleDeEsser}
              disabled={outputMode === 'speaker'}
              title={t('eq.deEsserTitle')}
            >
              {t('eq.deEsser')}
            </button>
            <button
              className={`eq-switch ${loudnessComp ? 'active' : ''}`}
              onClick={onToggleLoudnessComp}
              title={t('eq.loudnessTitle')}
            >
              {t('eq.loudness')}
            </button>
            {outputMode === 'speaker' && (
              <span className="eq-switch-hint">{t('eq.speakerNotice')}</span>
            )}
          </div>
        </div>

        <div className={`eq-body ${!enabled ? 'eq-body-disabled' : ''}`}>
          <div className="eq-db-axis">
            {DB_MARKS.map(db => (
              <span key={db} className="eq-db-label">{db > 0 ? `+${db}` : db}</span>
            ))}
          </div>

          <div className="eq-adj-row eq-adj-row-plus">
            {gains.map((_, i) => (
              <button
                key={i}
                className={`eq-adj-btn ${hoveredBand === i ? 'eq-adj-active' : ''}`}
                onMouseEnter={() => setHoveredBand(i)}
                onMouseLeave={() => setHoveredBand(null)}
                onPointerDown={(e) => { e.preventDefault(); handlePointerDown(i, 1); }}
                onDoubleClick={() => handleDoubleClick(i)}
                disabled={!enabled}
              >
                +
              </button>
            ))}
          </div>

          <div className="eq-chart" onMouseLeave={() => setHoveredBand(null)}>
            {hoveredBand !== null && (
              <div
                className="eq-chart-tooltip"
                style={{
                  left: `${((hoveredBand + 0.5) / BAND_COUNT) * 100}%`,
                  top: `${((20 - gains[hoveredBand]) / 40) * 100}%`,
                }}
              >
                <span className="eq-chart-tooltip-freq">{EQ_LABELS[hoveredBand]}</span>
                <span className="eq-chart-tooltip-db">
                  {gains[hoveredBand] > 0 ? '+' : ''}{gains[hoveredBand].toFixed(1)} dB
                </span>
              </div>
            )}
            <svg
              viewBox={`0 0 ${BAND_COUNT} 40`}
              preserveAspectRatio="none"
              className="eq-curve-svg"
            >
              <defs>
                <linearGradient id="eqCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fa2d48" stopOpacity="0.25" />
                  <stop offset="50%" stopColor="#fa2d48" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#fa2d48" stopOpacity="0.25" />
                </linearGradient>
              </defs>
              {DB_MARKS.map(db => (
                <line
                  key={db}
                  x1={0} y1={20 - db} x2={BAND_COUNT} y2={20 - db}
                  stroke={db === 0 ? 'rgba(160,160,176,0.5)' : 'rgba(42,42,74,0.5)'}
                  strokeWidth={db === 0 ? '0.12' : '0.06'}
                />
              ))}
              {hoveredBand !== null && (
                <line
                  x1={hoveredBand + 0.5} y1={0}
                  x2={hoveredBand + 0.5} y2={40}
                  stroke="rgba(250,45,72,0.3)"
                  strokeWidth="0.06"
                  strokeDasharray="0.4 0.2"
                />
              )}
              <path d={curvePaths.fill} fill="url(#eqCurveGrad)" />
              <path
                d={curvePaths.line}
                fill="none"
                stroke="#fa2d48"
                strokeWidth="0.15"
                opacity="0.9"
              />
              {gains.map((g, i) => (
                <circle
                  key={i}
                  cx={i + 0.5}
                  cy={20 - g}
                  r={hoveredBand === i ? 0.55 : 0.3}
                  fill={hoveredBand === i ? '#ff4d6a' : '#fa2d48'}
                  opacity={hoveredBand === i ? 1 : 0.5}
                />
              ))}
              {gains.map((_, i) => (
                <rect
                  key={`z${i}`}
                  x={i} y={0} width={1} height={40}
                  fill="transparent"
                  onMouseEnter={() => setHoveredBand(i)}
                  style={{ cursor: enabled ? 'crosshair' : 'default' }}
                />
              ))}
            </svg>
          </div>

          <div className="eq-adj-row eq-adj-row-minus">
            {gains.map((_, i) => (
              <button
                key={i}
                className={`eq-adj-btn ${hoveredBand === i ? 'eq-adj-active' : ''}`}
                onMouseEnter={() => setHoveredBand(i)}
                onMouseLeave={() => setHoveredBand(null)}
                onPointerDown={(e) => { e.preventDefault(); handlePointerDown(i, -1); }}
                onDoubleClick={() => handleDoubleClick(i)}
                disabled={!enabled}
              >
                −
              </button>
            ))}
          </div>

          <div className="eq-freq-row">
            {EQ_LABELS.map((label, i) => (
              <span
                key={i}
                className={`eq-freq-label ${hoveredBand === i ? 'eq-freq-active' : ''}`}
                onMouseEnter={() => setHoveredBand(i)}
                onMouseLeave={() => setHoveredBand(null)}
              >
                {label}
              </span>
            ))}
          </div>

          {!enabled && <div className="eq-disabled-overlay" />}
        </div>
      </div>
    </div>
  );
});
