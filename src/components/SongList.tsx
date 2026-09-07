import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Song } from '../types';
import { SongRow } from './SongRow';
import { useI18n } from '../i18n';

interface SongListProps {
  songs: Song[];
  currentSong: Song | null;
  onPlay: (song: Song, index: number) => void;
  onAddToQueue: (song: Song) => void;
  onDownload: (song: Song) => void;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

const ITEM_HEIGHT = 64;
const OVERSCAN = 5;

export function SongList({
  songs,
  currentSong,
  onPlay,
  onAddToQueue,
  onDownload,
  loading,
  hasMore,
  onLoadMore,
}: SongListProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
    const end = Math.min(songs.length, Math.ceil((scrollTop + clientHeight) / ITEM_HEIGHT) + OVERSCAN);
    setVisibleRange({ start, end });

    if (hasMore && onLoadMore && scrollTop + clientHeight >= container.scrollHeight - 200) {
      onLoadMore();
    }
  }, [songs.length, hasMore, onLoadMore]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    handleScroll();
  }, [songs.length]);

  if (loading && songs.length === 0) {
    return (
      <div className="song-list-skeleton">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton-cover shimmer" />
            <div className="skeleton-info">
              <div className="skeleton-name shimmer" />
              <div className="skeleton-artist shimmer" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!loading && songs.length === 0) {
    return null;
  }

  const useVirtualization = songs.length > 50;

  if (!useVirtualization) {
    return (
      <div className="song-list" ref={containerRef}>
        {songs.map((song, index) => (
          <SongRow
            key={`${song.id}-${song.source}-${index}`}
            song={song}
            index={index}
            isPlaying={currentSong?.id === song.id && currentSong?.source === song.source}
            onPlay={() => onPlay(song, index)}
            onAddToQueue={() => onAddToQueue(song)}
            onDownload={() => onDownload(song)}
          />
        ))}
        {loading && (
          <div className="loading-more">
            <div className="spinner" />
          </div>
        )}
        {hasMore && !loading && (
          <button className="load-more-btn" onClick={onLoadMore}>
            {t('search.more')}
          </button>
        )}
      </div>
    );
  }

  const totalHeight = songs.length * ITEM_HEIGHT;
  const visibleSongs = songs.slice(visibleRange.start, visibleRange.end);

  return (
    <div className="song-list" ref={containerRef}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: visibleRange.start * ITEM_HEIGHT, left: 0, right: 0 }}>
          {visibleSongs.map((song, i) => {
            const realIndex = visibleRange.start + i;
            return (
              <SongRow
                key={`${song.id}-${song.source}-${realIndex}`}
                song={song}
                index={realIndex}
                isPlaying={currentSong?.id === song.id && currentSong?.source === song.source}
                onPlay={() => onPlay(song, realIndex)}
                onAddToQueue={() => onAddToQueue(song)}
                onDownload={() => onDownload(song)}
              />
            );
          })}
        </div>
      </div>
      {loading && (
        <div className="loading-more">
          <div className="spinner" />
        </div>
      )}
      {hasMore && !loading && (
        <button className="load-more-btn" onClick={onLoadMore}>
          {t('search.more')}
        </button>
      )}
    </div>
  );
}
