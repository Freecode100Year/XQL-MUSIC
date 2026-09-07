import React, { useRef, useEffect } from 'react';
import { Song } from '../types';
import { PLATFORMS } from '../config';
import { SourceStatus } from '../hooks/useSearch';
import { getSearchHistory, clearSearchHistory } from '../utils/storage';
import { SongList } from './SongList';
import { useI18n } from '../i18n';

interface SearchPageProps {
  results: Song[];
  loading: boolean;
  keyword: string;
  platform: string;
  sourceStatus: Record<string, SourceStatus>;
  hasMore: boolean;
  search: (kw: string, plat?: string) => void;
  searchImmediate: (kw: string, plat?: string) => void;
  loadMore: () => void;
  changePlatform: (plat: string) => void;
  setKeyword: (kw: string) => void;
  currentSong: Song | null;
  onPlay: (song: Song, index: number) => void;
  onAddToQueue: (song: Song) => void;
  onDownload: (song: Song) => void;
  playSongInList: (song: Song, list: Song[], index: number) => void;
  focusTrigger: number;
}

export function SearchPage({
  results,
  loading,
  keyword,
  platform,
  sourceStatus,
  hasMore,
  search,
  searchImmediate,
  loadMore,
  changePlatform,
  setKeyword,
  currentSong,
  onPlay,
  onAddToQueue,
  onDownload,
  playSongInList,
  focusTrigger,
}: SearchPageProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const history = getSearchHistory();

  useEffect(() => {
    if (focusTrigger > 0 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focusTrigger]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      searchImmediate(keyword);
    }
  };

  const handleHistoryClick = (kw: string) => {
    setKeyword(kw);
    searchImmediate(kw);
  };

  const handleClearHistory = () => {
    clearSearchHistory();
  };

  return (
    <div className="search-page page-transition">
      <form className="search-form" onSubmit={handleSubmit}>
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="search-icon">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder={t('search.placeholder')}
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              search(e.target.value);
            }}
          />
          {keyword && (
            <button type="button" className="search-clear" onClick={() => { setKeyword(''); }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          )}
        </div>
        <button type="submit" className="search-btn">{t('search.submit')}</button>
      </form>

      <div className="platform-tabs">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            className={`platform-tab ${platform === p.key ? 'active' : ''}`}
            onClick={() => changePlatform(p.key)}
          >
            {p.key === 'all' ? t('source.all') : p.key === 'wy' ? t('source.wy') : p.key === 'ia' ? t('source.ia') : p.key === 'wm' ? t('source.wikimedia') : p.label}
            {p.key !== 'all' && sourceStatus[p.key] && sourceStatus[p.key] !== 'idle' && (
              <span
                className={`source-status source-status-${sourceStatus[p.key]}`}
                title={sourceStatus[p.key] === 'error' ? t('search.sourceError') : sourceStatus[p.key] === 'loading' ? t('search.sourceLoading') : t('search.sourceReady')}
                aria-label={sourceStatus[p.key] === 'error' ? t('search.sourceError') : undefined}
              />
            )}
          </button>
        ))}
      </div>

      {!keyword && history.length > 0 && (
        <div className="search-history">
          <div className="search-history-header">
            <span>{t('search.history')}</span>
            <button onClick={handleClearHistory}>{t('search.clear')}</button>
          </div>
          <div className="search-history-tags">
            {history.map((h) => (
              <button key={h} className="history-tag" onClick={() => handleHistoryClick(h)}>
                {h}
              </button>
            ))}
          </div>
        </div>
      )}

      <SongList
        songs={results}
        currentSong={currentSong}
        onPlay={(song, index) => playSongInList(song, results, index)}
        onAddToQueue={onAddToQueue}
        onDownload={onDownload}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />

      {!loading && keyword && results.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" opacity="0.3">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <p>{t('search.none')}</p>
        </div>
      )}
    </div>
  );
}
