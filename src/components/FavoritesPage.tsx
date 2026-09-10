import type { Song } from '../types';
import { SongList } from './SongList';
import { useI18n } from '../i18n';

interface FavoritesPageProps {
  songs: Song[];
  currentSong: Song | null;
  username: string;
  onPlay: (song: Song, index: number) => void;
  onPlaySequential: () => void;
  onPlayShuffle: () => void;
  onAddToQueue: (song: Song) => void;
  onDownload: (song: Song) => void;
}

export function FavoritesPage({
  songs, currentSong, username, onPlay, onPlaySequential, onPlayShuffle, onAddToQueue, onDownload,
}: FavoritesPageProps) {
  const { t } = useI18n();
  const masked = `${username.slice(0, 3)}****${username.slice(-4)}`;
  return (
    <div className="favorites-page page-transition">
      <div className="favorites-header">
        <div>
          <h2 className="section-title">❤️ {t('favorites.title')}</h2>
          <p>{t('favorites.owner', { username: masked })} · {t('queue.count', { count: songs.length })}</p>
        </div>
        <div className="favorites-actions">
          <button onClick={onPlaySequential} disabled={songs.length === 0}>{t('favorites.sequential')}</button>
          <button className="favorites-shuffle" onClick={onPlayShuffle} disabled={songs.length === 0}>{t('favorites.shuffle')}</button>
        </div>
      </div>
      {songs.length > 0 ? (
        <SongList
          songs={songs}
          currentSong={currentSong}
          onPlay={onPlay}
          onAddToQueue={onAddToQueue}
          onDownload={onDownload}
        />
      ) : (
        <div className="empty-state">
          <div className="favorites-empty-heart">♡</div>
          <p>{t('favorites.empty')}</p>
          <p className="empty-hint">{t('favorites.emptyHint')}</p>
        </div>
      )}
    </div>
  );
}
