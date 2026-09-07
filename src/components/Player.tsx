import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Song, PlayMode } from '../types';
import { formatTime } from '../utils/format';
import { API, CACHE_TTL } from '../config';
import { requestCache } from '../utils/cache';
import { useI18n } from '../i18n';

interface PlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playMode: PlayMode;
  loading: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSetPlayMode: (mode: PlayMode) => void;
  onNext: () => void;
  onPrev: () => void;
  onShowLyrics: () => void;
  onShowQueue: () => void;
}

export function Player({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  playMode,
  loading,
  onTogglePlay,
  onSeek,
  onSetPlayMode,
  onNext,
  onPrev,
  onShowLyrics,
  onShowQueue,
}: PlayerProps) {
  const { t } = useI18n();
  const [coverUrl, setCoverUrl] = useState('');
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (!currentSong) {
      setCoverUrl('');
      return;
    }
    setCoverUrl('');
    const loadCover = async () => {
      const cacheKey = `pic_${currentSong.sourceType}_${currentSong.source}_${currentSong.id}`;
      const cached = requestCache.get<string>(cacheKey);
      if (cached) {
        setCoverUrl(cached);
        return;
      }

      if (currentSong.pic && currentSong.pic.startsWith('http')) {
        setCoverUrl(currentSong.pic);
        return;
      }

      if (currentSong.pic && (currentSong.source === 'wy' || currentSong.source === 'netease')) {
        try {
          const res = await fetch(`${API.GD}?types=pic&source=netease&id=${currentSong.pic}&size=300`);
          const data = await res.json();
          if (data.url) {
            requestCache.set(cacheKey, data.url, CACHE_TTL.PIC);
            setCoverUrl(data.url);
          }
        } catch {}
        return;
      }

      if (currentSong.sourceType === 'gd') {
        try {
          const res = await fetch(`${API.GD}?types=pic&source=${currentSong.source}&id=${currentSong.pic_id || currentSong.id}&size=300`);
          const data = await res.json();
          if (data.url) {
            requestCache.set(cacheKey, data.url, CACHE_TTL.PIC);
            setCoverUrl(data.url);
          }
        } catch {}
      }
    };
    loadCover();
  }, [currentSong]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  }, [duration, onSeek]);

  const handleProgressHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(ratio * duration);
    setHoverPos(ratio * 100);
  }, [duration]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 80) {
      if (diff > 0) {
        onPrev();
      } else {
        onNext();
      }
    }
  };

  const cyclePlayMode = () => {
    const modes: PlayMode[] = ['sequential', 'repeat-one', 'shuffle'];
    const idx = modes.indexOf(playMode);
    onSetPlayMode(modes[(idx + 1) % modes.length]);
  };

  const playModeIcon = () => {
    switch (playMode) {
      case 'repeat-one':
        return (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
            <text x="12" y="14.5" textAnchor="middle" fontSize="7" fill="currentColor">1</text>
          </svg>
        );
      case 'shuffle':
        return (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
          </svg>
        );
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`player ${currentSong ? 'player-visible' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="player-progress"
        ref={progressRef}
        onClick={handleProgressClick}
        onMouseMove={handleProgressHover}
        onMouseLeave={() => setHoverTime(null)}
      >
        <div className="player-progress-bar" style={{ width: `${progress}%` }}>
          <div className="player-progress-thumb" />
        </div>
        {hoverTime !== null && (
          <div className="player-progress-tooltip" style={{ left: `${hoverPos}%` }}>
            {formatTime(hoverTime)}
          </div>
        )}
      </div>

      <div className="player-content">
        <div className="player-left" onClick={onShowLyrics}>
          <div className="player-cover">
            {coverUrl ? (
              <img src={coverUrl} alt="" onError={() => setCoverUrl('')} />
            ) : (
              <div className="player-cover-placeholder">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" opacity="0.4">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
          </div>
          <div className="player-info">
            <span className="player-song-name">{currentSong?.name || t('player.notPlaying')}</span>
            <span className="player-artist">{currentSong?.artist || t('player.chooseSong')}</span>
          </div>
        </div>

        <div className="player-center">
          <button className="player-btn" onClick={cyclePlayMode} title={playMode}>
            {playModeIcon()}
          </button>
          <button className="player-btn" onClick={onPrev}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <button className="player-btn player-btn-play" onClick={onTogglePlay} disabled={!currentSong}>
            {loading ? (
              <div className="spinner-small" />
            ) : isPlaying ? (
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button className="player-btn" onClick={onNext}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
          <button className="player-btn" onClick={onShowQueue}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
            </svg>
          </button>
        </div>

        <div className="player-right">
          <span className="player-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
