import React from 'react';
import { Song } from '../types';
import { useI18n } from '../i18n';

interface QueuePanelProps {
  visible: boolean;
  onClose: () => void;
  queue: Song[];
  queueIndex: number;
  onPlay: (index: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
}

export function QueuePanel({ visible, onClose, queue, queueIndex, onPlay, onRemove, onClear }: QueuePanelProps) {
  const { t } = useI18n();
  if (!visible) return null;

  return (
    <div className="queue-panel-overlay" onClick={onClose}>
      <div className="queue-panel" onClick={(e) => e.stopPropagation()}>
        <div className="queue-panel-header">
          <h3>{t('queue.title')}</h3>
          <div className="queue-panel-actions">
            <span className="queue-count">{t('queue.count', { count: queue.length })}</span>
            <button className="queue-clear-btn" onClick={onClear} disabled={queue.length === 0}>
              {t('search.clear')}
            </button>
            <button className="queue-close-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="queue-list">
          {queue.length === 0 ? (
            <div className="queue-empty">
              <p>{t('queue.empty')}</p>
              <p className="queue-empty-hint">{t('queue.emptyHint')}</p>
            </div>
          ) : (
            queue.map((song, i) => (
              <div
                key={`${song.id}-${song.source}-${i}`}
                className={`queue-item ${i === queueIndex ? 'queue-item-active' : ''}`}
                onClick={() => onPlay(i)}
              >
                <div className="queue-item-info">
                  <span className="queue-item-name">{song.name}</span>
                  <span className="queue-item-artist">{song.artist}</span>
                </div>
                <button
                  className="queue-item-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(i);
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
