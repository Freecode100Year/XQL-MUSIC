import { Page } from '../types';
import { CrossfeedMode, OutputMode } from '../utils/storage';

const CROSSFEED_LABELS: Record<CrossfeedMode, string> = {
  off: '关',
  light: '轻',
  medium: '中',
  strong: '强',
};

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
  onSetVolume: (value: number) => void;
  onSetGainMultiplier: (value: number) => void;
  onCycleCrossfeed: () => void;
  onToggleOutput: () => void;
  onShowEqualizer: () => void;
}

export function Sidebar({
  currentPage, setPage, mobileOpen, setMobileOpen, volume, gainMultiplier,
  crossfeedMode, outputMode, eqEnabled, onSetVolume, onSetGainMultiplier,
  onCycleCrossfeed, onToggleOutput, onShowEqualizer,
}: SidebarProps) {
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
            <span>发现音乐</span>
          </button>
          <button
            className={`sidebar-item ${currentPage === 'search' ? 'active' : ''}`}
            onClick={() => navigate('search')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <span>搜索</span>
          </button>

          <section className="sidebar-audio-controls" aria-label="播放设置">
            <div className="sidebar-audio-title">播放设置</div>

            <label className="sidebar-range-control">
              <span className="sidebar-control-header">
                <span>音量增强</span>
                <strong>{gainMultiplier.toFixed(1)}x</strong>
              </span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={gainMultiplier}
                onChange={(event) => onSetGainMultiplier(parseFloat(event.target.value))}
                aria-label="音量增强倍数"
              />
            </label>

            <button
              className="sidebar-audio-button"
              onClick={onCycleCrossfeed}
              disabled={outputMode === 'speaker'}
              title={outputMode === 'speaker' ? '音箱外放时无需交叉馈送' : '点击切换关、轻、中、强'}
            >
              <span>耳机交叉馈送</span>
              <strong>{outputMode === 'speaker' ? '不适用' : CROSSFEED_LABELS[crossfeedMode]}</strong>
            </button>

            <button
              className={`sidebar-audio-button ${outputMode === 'speaker' ? 'active' : ''}`}
              onClick={onToggleOutput}
              title="点击切换耳机与音箱外放模式"
            >
              <span>音箱外放</span>
              <strong>{outputMode === 'speaker' ? '开' : '关'}</strong>
            </button>

            <button
              className={`sidebar-audio-button ${eqEnabled ? 'active' : ''}`}
              onClick={onShowEqualizer}
              title="打开均衡器设置"
            >
              <span>均衡器</span>
              <strong>{eqEnabled ? '开' : '设置'}</strong>
            </button>

            <label className="sidebar-range-control">
              <span className="sidebar-control-header">
                <span>音量</span>
                <strong>{Math.round(volume * 100)}%</strong>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(event) => onSetVolume(parseFloat(event.target.value))}
                aria-label="播放音量"
              />
            </label>
          </section>
        </nav>
      </aside>
    </>
  );
}
