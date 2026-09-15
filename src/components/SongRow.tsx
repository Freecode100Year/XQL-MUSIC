import React, { useRef, useEffect, useState } from 'react';
import { Song } from '../types';
import { API, CACHE_TTL } from '../config';
import { requestCache } from '../utils/cache';
import { useI18n } from '../i18n';

interface SongRowProps {
  song: Song;
  index: number;
  isPlaying: boolean;
  onPlay: () => void;
  onAddToQueue: () => void;
  onDownload: () => void;
}

export const SongRow = React.memo(function SongRow({ song, index, isPlaying, onPlay, onAddToQueue, onDownload }: SongRowProps) {
  const { t } = useI18n();
  const imgRef = useRef<HTMLDivElement>(null);
  const [imgSrc, setImgSrc] = useState<string>('');
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (!song) return;
    setImgSrc('');
    setImgLoaded(false);

    const loadPic = async () => {
      if (!song.pic) return;

      if (song.pic.startsWith('http')) {
        setImgSrc(song.pic);
        return;
      }

      if (song.source === 'wy' || song.source === 'netease') {
        const cacheKey = `pic_netease_${song.pic}`;
        const cached = requestCache.get<string>(cacheKey);
        if (cached) {
          setImgSrc(cached);
          return;
        }
        try {
          const res = await fetch(`${API.GD}?types=pic&source=netease&id=${song.pic}&size=300`);
          const data = await res.json();
          if (data.url) {
            requestCache.set(cacheKey, data.url, CACHE_TTL.PIC);
            setImgSrc(data.url);
          }
        } catch {}
        return;
      }

      if (song.sourceType === 'gd' && song.pic_id) {
        const cacheKey = `pic_${song.sourceType}_${song.source}_${song.id}`;
        const cached = requestCache.get<string>(cacheKey);
        if (cached) {
          setImgSrc(cached);
          return;
        }
        try {
          const res = await fetch(`${API.GD}?types=pic&source=${song.source}&id=${song.pic_id || song.id}&size=300`);
          const data = await res.json();
          if (data.url) {
            requestCache.set(cacheKey, data.url, CACHE_TTL.PIC);
            setImgSrc(data.url);
          }
        } catch {}
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadPic();
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [song]);

  return (
    <div className={`song-row ${isPlaying ? 'song-row-active' : ''}`} onClick={onPlay}>
      <div className="song-row-index">
        {isPlaying ? (
          <div className="playing-indicator">
            <span /><span /><span />
          </div>
        ) : (
          <span className="song-num">{index + 1}</span>
        )}
      </div>
      <div className="song-row-cover" ref={imgRef}>
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgSrc('');
              setImgLoaded(false);
            }}
            className={imgLoaded ? 'loaded' : ''}
          />
        ) : (
          <div className="song-cover-placeholder">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" opacity="0.3">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
      </div>
      <div className="song-row-info">
        <span className="song-row-name">{song.name}</span>
        <span className="song-row-artist">{song.artist}{song.album ? ` - ${song.album}` : ''}</span>
      </div>
      <div className="song-row-actions" onClick={(e) => e.stopPropagation()}>
        <button className="action-btn" onClick={onAddToQueue} title={t('song.addQueue')}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
          </svg>
        </button>
        <button className="action-btn" onClick={onDownload} title={t('song.download')}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </svg>
        </button>
      </div>
      <div className="song-row-source">
        <span className={`source-badge source-badge-${song.source}`}>{
          song.source === 'wy' || song.source === 'netease' ? t('source.wy')
            : song.source === 'ia' ? t('source.archive')
              : song.source === 'jm' ? t('source.jamendo')
                : song.source === 'fs' ? t('source.freesound')
                  : song.source === 'wm' ? t('source.wikimedia')
                    : song.source === 'oa' ? t('source.openaudio')
                      : song.source === 'loc' ? t('source.loc')
                        : song.source
        }</span>
      </div>
    </div>
  );
});
