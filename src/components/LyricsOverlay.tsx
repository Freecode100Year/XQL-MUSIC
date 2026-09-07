import React, { useRef, useEffect } from 'react';
import { LyricLine, Song } from '../types';
import { useI18n } from '../i18n';

interface LyricsOverlayProps {
  visible: boolean;
  onClose: () => void;
  lyrics: LyricLine[];
  currentLineIndex: number;
  song: Song | null;
  coverUrl?: string;
}

export function LyricsOverlay({ visible, onClose, lyrics, currentLineIndex, song, coverUrl }: LyricsOverlayProps) {
  const { t } = useI18n();
  const lyricsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !lyricsRef.current || currentLineIndex < 0) return;
    const activeEl = lyricsRef.current.querySelector('.lyric-line-active');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLineIndex, visible]);

  if (!visible) return null;

  return (
    <div className="lyrics-overlay" onClick={onClose}>
      <div className="lyrics-overlay-content" onClick={(e) => e.stopPropagation()}>
        <button className="lyrics-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        <div className="lyrics-header">
          {coverUrl && <img src={coverUrl} alt="" className="lyrics-cover" />}
          <div className="lyrics-song-info">
            <h3>{song?.name || t('lyrics.unknownSong')}</h3>
            <p>{song?.artist || t('lyrics.unknownArtist')}</p>
          </div>
        </div>

        <div className="lyrics-scroll" ref={lyricsRef}>
          {lyrics.length > 0 ? (
            lyrics.map((line, i) => (
              <p
                key={i}
                className={`lyric-line ${i === currentLineIndex ? 'lyric-line-active' : ''}`}
              >
                {line.text}
              </p>
            ))
          ) : (
            <p className="lyrics-empty">{t('lyrics.empty')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
