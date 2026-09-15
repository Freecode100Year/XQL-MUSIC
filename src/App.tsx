import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Page, Song, ToastMessage } from './types';
import { generateId } from './utils/format';
import { usePlayer } from './hooks/usePlayer';
import { useSearch } from './hooks/useSearch';
import { useKeyboard } from './hooks/useKeyboard';
import { useLyrics } from './hooks/useLyrics';
import { useEqualizer } from './hooks/useEqualizer';
import { Layout } from './components/Layout';
import { HomePage } from './components/HomePage';
import { SearchPage } from './components/SearchPage';
import { Player } from './components/Player';
import { LyricsOverlay } from './components/LyricsOverlay';
import { QueuePanel } from './components/QueuePanel';
import { Equalizer } from './components/Equalizer';
import { Toast } from './components/Toast';
import { API, CACHE_TTL } from './config';
import { requestCache } from './utils/cache';
import { useI18n } from './i18n';
import { AudioStudio } from './components/AudioStudio';
import { FavoritesPage } from './components/FavoritesPage';
import { RegistrationModal } from './components/RegistrationModal';
import { useFavorites } from './hooks/useFavorites';

export default function App() {
  const { t } = useI18n();
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [showAudioStudio, setShowAudioStudio] = useState(false);
  const closeAudioStudio = useCallback(() => setShowAudioStudio(false), []);
  const openEqualizer = useCallback(() => setShowEqualizer(true), []);
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0);

  const addToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, text, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const eq = useEqualizer();
  // Stable bridge object: usePlayer keys its graph rebuild off this, and a fresh
  // object literal every render used to re-route the whole audio chain four times
  // a second while a track played.
  const eqBridge = useMemo(
    () => ({ filtersRef: eq.filtersRef, preampRef: eq.preampRef, createFilters: eq.createFilters, createPreamp: eq.createPreamp }),
    [eq.filtersRef, eq.preampRef, eq.createFilters, eq.createPreamp],
  );
  const player = usePlayer(addToast, eqBridge);
  const favorites = useFavorites();
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
      if (event.code === 'KeyU') { event.preventDefault(); setShowAudioStudio(v => !v); }
      if (event.code === 'KeyS') { event.preventDefault(); player.setProcessingEnabled(!player.processingEnabled); }
      if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault(); player.setGainMultiplier(player.gainMultiplier + (event.code === 'ArrowUp' ? 0.05 : -0.05));
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [player.setProcessingEnabled, player.processingEnabled, player.setGainMultiplier, player.gainMultiplier]);
  const searchHook = useSearch();

  const { lyrics, currentLineIndex } = useLyrics(player.currentSong, player.currentTime);

  useKeyboard({
    togglePlay: player.togglePlay,
    seek: player.seek,
    setVolume: player.setVolume,
    currentTime: player.currentTime,
    volume: player.volume,
  });

  const playSongInList = useCallback((song: Song, list: Song[], index: number) => {
    player.playSong(song, list, index);
  }, [player.playSong]);

  const handleDownload = useCallback(async (song: Song) => {
    if (song.sourceType === 'loc') {
      try {
        if (!song.audioUrl) throw new Error('Missing Library of Congress audio URL');
        const parsed = new URL(song.audioUrl);
        if (parsed.protocol !== 'https:' || parsed.hostname !== 'tile.loc.gov' || !parsed.pathname.startsWith('/streaming-services/')) {
          throw new Error('Invalid Library of Congress audio URL');
        }
        const response = await fetch(parsed.toString());
        if (!response.ok) throw new Error(`Download failed (${response.status})`);
        const blobUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `loc-${song.id}.mp3`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        addToast(t('toast.downloadOpened'), 'success');
      } catch {
        addToast(t('toast.downloadFailed'), 'error');
      }
      return;
    }

    let url = '';
    const cacheKey = `song_url_${song.sourceType}_${song.source}_${song.id}`;
    const cached = requestCache.get<string>(cacheKey);
    if (song.sourceType === 'openaudio') {
      url = `${API.OPENAUDIO}?action=download&id=${encodeURIComponent(song.id)}`;
    } else if (cached) {
      url = cached;
    } else {
      try {
        if (song.sourceType === 'audius') {
          const res = await fetch(`${API.AUDIUS}?action=song&id=${encodeURIComponent(song.id)}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url || '';
          }
        } else if (song.sourceType === 'ccmixter') {
          const res = await fetch(`${API.CCMIXTER}?action=song&id=${encodeURIComponent(song.id)}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url || '';
          }
        } else if (song.sourceType === 'archive') {
          const res = await fetch(`${API.ARCHIVE}?action=song&id=${encodeURIComponent(song.id)}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url || '';
          }
        } else if (song.sourceType === 'openverse') {
          const res = await fetch(`${API.OPENVERSE}?action=song&id=${encodeURIComponent(song.id)}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url || '';
          }
        } else if (song.sourceType === 'wikimedia') {
          const res = await fetch(`${API.WIKIMEDIA}?action=song&id=${encodeURIComponent(song.id)}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url || '';
          }
        } else if (song.sourceType === 'gd') {
          const res = await fetch(`${API.GD}?types=url&source=${song.source}&id=${song.id}&br=320`);
          const data = await res.json();
          url = data.url || '';
        } else {
          const res = await fetch(
            `${API.SONG}?id=${song.id}&type=${song.source}` +
              `&name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist)}`,
          );
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url || '';
          }
        }
        if (url) {
          requestCache.set(cacheKey, url, CACHE_TTL.SONG_URL);
        }
      } catch {
        addToast(t('toast.downloadFailed'), 'error');
        return;
      }
    }
    if (url) {
      if (song.sourceType === 'openaudio') {
        const link = document.createElement('a');
        link.href = url;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        window.open(url, '_blank');
      }
      addToast(t('toast.downloadOpened'), 'success');
    } else {
      addToast(t('toast.downloadUnavailable'), 'error');
    }
  }, [addToast, t]);

  const handleSearchFocus = useCallback(() => {
    setCurrentPage('search');
    setSearchFocusTrigger((n) => n + 1);
  }, []);

  const handleQueuePlay = useCallback((index: number) => {
    const song = player.queue[index];
    if (song) {
      player.playSong(song, player.queue, index);
    }
  }, [player]);

  const handleOpenFavorites = useCallback(() => {
    if (!favorites.username) {
      favorites.openRegistration();
      return;
    }
    setCurrentPage('favorites');
  }, [favorites.username, favorites.openRegistration]);

  const handleRegister = useCallback((username: string) => {
    const registered = favorites.register(username);
    if (registered) {
      addToast(t('toast.registered'), 'success');
      setCurrentPage('favorites');
    }
    return registered;
  }, [favorites.register, addToast, t]);

  const handleToggleFavorite = useCallback(() => {
    if (!player.currentSong) return;
    const added = favorites.toggleFavorite(player.currentSong);
    if (added === true) addToast(t('toast.favoriteAdded'), 'success');
    if (added === false) addToast(t('toast.favoriteRemoved'), 'info');
  }, [player.currentSong, favorites.toggleFavorite, addToast, t]);

  const playFavorites = useCallback((shuffle: boolean) => {
    const songs = favorites.favorites;
    if (songs.length === 0) return;
    const index = shuffle ? Math.floor(Math.random() * songs.length) : 0;
    player.setPlayMode(shuffle ? 'shuffle' : 'sequential');
    player.playSong(songs[index], songs, index);
  }, [favorites.favorites, player.setPlayMode, player.playSong]);

  const getCoverUrl = (): string => {
    if (!player.currentSong) return '';
    const song = player.currentSong;
    const cacheKey = `pic_${song.sourceType}_${song.source}_${song.id}`;
    const cached = requestCache.get<string>(cacheKey);
    if (cached) return cached;
    if (typeof song.pic === 'string' && song.pic.startsWith('http')) return song.pic;
    return '';
  };

  return (
    <>
      <Layout
        currentPage={currentPage}
        setPage={setCurrentPage}
        onSearchFocus={handleSearchFocus}
        volume={player.volume}
        gainMultiplier={player.gainMultiplier}
        crossfeedMode={player.crossfeedMode}
        outputMode={player.outputMode}
        eqEnabled={eq.enabled}
        spatialMode={player.spatialMode}
        nightMode={player.nightMode}
        balance={player.balance}
        virtual8d={player.virtual8d}
        virtual8dSpeed={player.virtual8dSpeed}
        virtual8dDepth={player.virtual8dDepth}
        onSetVolume={player.setVolume}
        onSetGainMultiplier={player.setGainMultiplier}
        onCycleCrossfeed={player.cycleCrossfeed}
        onToggleOutput={player.toggleOutputMode}
        onShowEqualizer={() => setShowEqualizer(true)}
        onShowAudioStudio={() => setShowAudioStudio(true)}
        processingEnabled={player.processingEnabled}
        onToggleMono={player.toggleMono}
        onSetBalance={player.setBalance}
        onToggleNightMode={player.toggleNightMode}
        onToggleVirtual8d={player.toggleVirtual8d}
        onSetVirtual8dSpeed={player.setVirtual8dSpeed}
        onSetVirtual8dDepth={player.setVirtual8dDepth}
        onOpenFavorites={handleOpenFavorites}
        onOpenRegistration={favorites.openRegistration}
      >
        {currentPage === 'home' && (
          <HomePage
            currentSong={player.currentSong}
            onPlay={playSongInList}
            onAddToQueue={(song) => player.addToQueue([song])}
            onDownload={handleDownload}
          />
        )}
        {currentPage === 'search' && (
          <SearchPage
            results={searchHook.results}
            loading={searchHook.loading}
            keyword={searchHook.keyword}
            platform={searchHook.platform}
            sourceStatus={searchHook.sourceStatus}
            hasMore={searchHook.hasMore}
            search={searchHook.search}
            searchImmediate={searchHook.searchImmediate}
            loadMore={searchHook.loadMore}
            changePlatform={searchHook.changePlatform}
            setKeyword={searchHook.setKeyword}
            currentSong={player.currentSong}
            onPlay={(song, index) => playSongInList(song, searchHook.results, index)}
            onAddToQueue={(song) => player.addToQueue([song])}
            onDownload={handleDownload}
            playSongInList={playSongInList}
            focusTrigger={searchFocusTrigger}
          />
        )}
        {currentPage === 'favorites' && favorites.username && (
          <FavoritesPage
            songs={favorites.favorites}
            currentSong={player.currentSong}
            username={favorites.username}
            onPlay={(song, index) => playSongInList(song, favorites.favorites, index)}
            onPlaySequential={() => playFavorites(false)}
            onPlayShuffle={() => playFavorites(true)}
            onAddToQueue={(song) => player.addToQueue([song])}
            onDownload={handleDownload}
          />
        )}
      </Layout>

      <Player
        currentSong={player.currentSong}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        playMode={player.playMode}
        loading={player.loading}
        onTogglePlay={player.togglePlay}
        onSeek={player.seek}
        onSetPlayMode={player.setPlayMode}
        onNext={player.playNext}
        onPrev={player.playPrev}
        onShowLyrics={() => setShowLyrics(true)}
        onShowQueue={() => setShowQueue(true)}
        isFavorite={favorites.isFavorite(player.currentSong)}
        onToggleFavorite={handleToggleFavorite}
      />

      <LyricsOverlay
        visible={showLyrics}
        onClose={() => setShowLyrics(false)}
        lyrics={lyrics}
        currentLineIndex={currentLineIndex}
        song={player.currentSong}
        coverUrl={getCoverUrl()}
      />

      <QueuePanel
        visible={showQueue}
        onClose={() => setShowQueue(false)}
        queue={player.queue}
        queueIndex={player.queueIndex}
        onPlay={handleQueuePlay}
        onRemove={player.removeFromQueue}
        onClear={player.clearQueue}
      />

      <Equalizer
        visible={showEqualizer}
        onClose={() => setShowEqualizer(false)}
        gains={eq.gains}
        enabled={eq.enabled}
        bypassed={eq.bypassed}
        preset={eq.preset}
        onSetBandGain={eq.setBandGain}
        onReset={eq.reset}
        onSetEnabled={(on) => {
          eq.setEnabled(on);
          if (on && player.isPlaying) {
            player.activateWebAudio();
          }
        }}
        onSetBypassed={eq.setBypassed}
        onApplyPreset={eq.applyPreset}
        deEsser={player.deEsser}
        loudnessComp={player.loudnessComp}
        outputMode={player.outputMode}
        onToggleDeEsser={player.toggleDeEsser}
        onToggleLoudnessComp={player.toggleLoudnessComp}
      />

      {showAudioStudio && <AudioStudio player={player} eq={eq} onClose={closeAudioStudio} onOpenEqualizer={openEqualizer} />}
      <RegistrationModal
        visible={favorites.registrationOpen}
        onClose={favorites.closeRegistration}
        onRegister={handleRegister}
      />
      <Toast toasts={toasts} removeToast={removeToast} />
    </>
  );
}
