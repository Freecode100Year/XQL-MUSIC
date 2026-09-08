import { Page } from '../types';
import { CrossfeedMode, OutputMode, SpatialMode } from '../utils/storage';
import { useI18n } from '../i18n';

interface SidebarProps {
  currentPage: Page;
  setPage: (page: Page) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  volume: number;
  gainMultiplier: number;
  crossfeedMode: CrossfeedMode;
  outputMode: OutputMode;
  eqEnabled: boolean;
  spatialMode: SpatialMode;
  nightMode: boolean;
  balance: number;
  virtual8d: boolean;
  virtual8dSpeed: number;
  virtual8dDepth: number;
  onSetVolume: (value: number) => void;
  onSetGainMultiplier: (value: number) => void;
  onCycleCrossfeed: () => void;
  onToggleOutput: () => void;
  onShowEqualizer: () => void;
  onShowAudioStudio: () => void;
  processingEnabled: boolean;
  onToggleStereoWide: () => void;
  onToggleMono: () => void;
  onSetBalance: (value: number) => void;
  onToggleNightMode: () => void;
  onToggleVirtual8d: () => void;
  onSetVirtual8dSpeed: (value: number) => void;
  onSetVirtual8dDepth: (value: number) => void;
}

export function Sidebar({
  currentPage, setPage, mobileOpen, setMobileOpen, volume, gainMultiplier,
  crossfeedMode, outputMode, eqEnabled, onSetVolume, onSetGainMultiplier,
  onCycleCrossfeed, onToggleOutput, onShowEqualizer, spatialMode, nightMode,
  balance, onToggleStereoWide, onToggleMono, onSetBalance, onToggleNightMode,
  virtual8d, onToggleVirtual8d,
  virtual8dSpeed, virtual8dDepth, onSetVirtual8dSpeed, onSetVirtual8dDepth,
  onShowAudioStudio, processingEnabled,
}: SidebarProps) {
  const { t } = useI18n();
  const crossfeedLabels: Record<CrossfeedMode, string> = {
    off: t('audio.off'), light: t('audio.crossfeedLight'),
    medium: t('audio.crossfeedMedium'), strong: t('audio.crossfeedStrong'),
  };
  const navigate = (page: Page) => {
    setPage(page);
    setMobileOpen(false);
  };

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <svg viewBox="0 0 64 64" width="32" height="32">
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#fa2d48' }} />
                <stop offset="100%" style={{ stopColor: '#e91e3a' }} />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="14" fill="url(#logoGrad)" />
            <path d="M44 16v22a8 8 0 1 1-4-6.93V22H28v18a8 8 0 1 1-4-6.93V16h20z" fill="white" />
          </svg>
          <span className="sidebar-title">XQL MUSIC</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-item ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => navigate('home')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            <span>{t('nav.home')}</span>
          </button>
          <button
            className={`sidebar-item ${currentPage === 'search' ? 'active' : ''}`}
            onClick={() => navigate('search')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <span>{t('nav.search')}</span>
          </button>

          <section className="sidebar-audio-controls" aria-label={t('audio.settings')}>
            <div className="sidebar-audio-title">{t('audio.settings')}</div>
            <button className="sidebar-audio-button active" onClick={onShowAudioStudio}>
              <span>{t('studio.open')}</span><strong>›</strong>
            </button>
            {!processingEnabled && <p className="sidebar-studio-hint">{t('studio.native')}</p>}

            <label className="sidebar-range-control">
              <span className="sidebar-control-header">
                <span>{t('audio.gain')}</span>
                <strong>{Math.round(gainMultiplier * 100)}%</strong>
              </span>
              <input
                type="range"
                min="0"
                max="3"
                step="0.01"
                value={gainMultiplier}
                onChange={(event) => onSetGainMultiplier(parseFloat(event.target.value))}
                aria-label={t('audio.gainLabel')}
              />
            </label>

            <button
              className="sidebar-audio-button"
              onClick={onCycleCrossfeed}
              disabled={outputMode === 'speaker'}
              title={outputMode === 'speaker' ? t('audio.crossfeedUnavailable') : t('audio.crossfeedCycle')}
            >
              <span>{t('audio.crossfeed')}</span>
              <strong>{outputMode === 'speaker' ? t('audio.na') : crossfeedLabels[crossfeedMode]}</strong>
            </button>

            <button
              className={`sidebar-audio-button ${outputMode === 'speaker' ? 'active' : ''}`}
              onClick={onToggleOutput}
              title={t('audio.outputToggle')}
            >
              <span>{t('audio.speaker')}</span>
              <strong>{outputMode === 'speaker' ? t('audio.on') : t('audio.off')}</strong>
            </button>

            <button
              className={`sidebar-audio-button ${eqEnabled ? 'active' : ''}`}
              onClick={onShowEqualizer}
              title={t('audio.eqOpen')}
            >
              <span>{t('audio.equalizer')}</span>
              <strong>{eqEnabled ? t('audio.on') : t('audio.setup')}</strong>
            </button>

            <label className="sidebar-range-control">
              <span className="sidebar-control-header">
                <span>{t('audio.volume')}</span>
                <strong>{Math.round(volume * 100)}%</strong>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(event) => onSetVolume(parseFloat(event.target.value))}
                aria-label={t('audio.volumeLabel')}
              />
            </label>

            <div className="sidebar-audio-title sidebar-booster-title">{t('booster.title')}</div>
            <button
              className={`sidebar-audio-button ${spatialMode === 'wide' ? 'active' : ''}`}
              onClick={onToggleStereoWide}
              title={t('booster.stereoTitle')}
            >
              <span>{t('booster.stereo')}</span>
              <strong>{spatialMode === 'wide' ? t('audio.on') : t('audio.off')}</strong>
            </button>
            <button
              className={`sidebar-audio-button ${spatialMode === 'mono' ? 'active' : ''}`}
              onClick={onToggleMono}
              title={t('booster.monoTitle')}
            >
              <span>{t('booster.mono')}</span>
              <strong>{spatialMode === 'mono' ? t('audio.on') : t('audio.off')}</strong>
            </button>
            <button
              className={`sidebar-audio-button ${nightMode ? 'active' : ''}`}
              onClick={onToggleNightMode}
              title={t('booster.nightTitle')}
            >
              <span>{t('booster.night')}</span>
              <strong>{nightMode ? t('audio.on') : t('audio.off')}</strong>
            </button>
            <button
              className={`sidebar-audio-button ${virtual8d ? 'active' : ''}`}
              onClick={onToggleVirtual8d}
              title={t('booster.virtual8dTitle')}
            >
              <span>{t('booster.virtual8d')}</span>
              <strong>{virtual8d ? t('audio.on') : t('audio.off')}</strong>
            </button>
            {virtual8d && (
              <>
                <label className="sidebar-range-control">
                  <span className="sidebar-control-header">
                    <span>{t('booster.virtual8dSpeed')}</span>
                    <strong>{t('booster.perMinute', { count: (virtual8dSpeed * 60).toFixed(1) })}</strong>
                  </span>
                  <input
                    type="range"
                    min="0.03"
                    max="0.2"
                    step="0.005"
                    value={virtual8dSpeed}
                    onChange={(event) => onSetVirtual8dSpeed(parseFloat(event.target.value))}
                    aria-label={t('booster.virtual8dSpeedLabel')}
                  />
                </label>
                <label className="sidebar-range-control">
                  <span className="sidebar-control-header">
                    <span>{t('booster.virtual8dDepth')}</span>
                    <strong>{Math.round(virtual8dDepth * 100)}%</strong>
                  </span>
                  <input
                    type="range"
                    min="0.15"
                    max="1"
                    step="0.01"
                    value={virtual8dDepth}
                    onChange={(event) => onSetVirtual8dDepth(parseFloat(event.target.value))}
                    aria-label={t('booster.virtual8dDepthLabel')}
                  />
                </label>
              </>
            )}
            <label className="sidebar-range-control">
              <span className="sidebar-control-header">
                <span>{t('booster.balance')}</span>
                <strong>{balance === 0 ? t('booster.center') : balance < 0 ? t('booster.left') : t('booster.right')}</strong>
              </span>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={balance}
                onChange={(event) => onSetBalance(parseFloat(event.target.value))}
                aria-label={t('booster.balanceLabel')}
              />
            </label>
          </section>
        </nav>
      </aside>
    </>
  );
}
