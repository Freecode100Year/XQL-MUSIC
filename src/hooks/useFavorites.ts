import { useCallback, useMemo, useState } from 'react';
import type { Song } from '../types';
import { getFavorites, getRegisteredUsername, registerUsername, setFavorites } from '../utils/storage';

const songKey = (song: Song) => `${song.sourceType}:${song.source}:${song.id}`;

export function useFavorites() {
  const [username, setUsername] = useState<string | null>(getRegisteredUsername);
  const [favorites, setFavoritesState] = useState<Song[]>(() => {
    const savedUser = getRegisteredUsername();
    return savedUser ? getFavorites(savedUser) : [];
  });
  const [registrationOpen, setRegistrationOpen] = useState(false);

  const register = useCallback((value: string) => {
    if (!registerUsername(value)) return false;
    setUsername(value);
    setFavoritesState(getFavorites(value));
    setRegistrationOpen(false);
    return true;
  }, []);

  const toggleFavorite = useCallback((song: Song) => {
    if (!username) {
      setRegistrationOpen(true);
      return null;
    }
    const added = !favorites.some((item) => songKey(item) === songKey(song));
    setFavoritesState((current) => {
      const key = songKey(song);
      const exists = current.some((item) => songKey(item) === key);
      const next = exists ? current.filter((item) => songKey(item) !== key) : [song, ...current];
      setFavorites(username, next);
      return next;
    });
    return added;
  }, [username, favorites]);

  const favoriteKeys = useMemo(() => new Set(favorites.map(songKey)), [favorites]);
  const isFavorite = useCallback((song: Song | null) => Boolean(song && favoriteKeys.has(songKey(song))), [favoriteKeys]);

  return {
    username,
    favorites,
    registrationOpen,
    openRegistration: () => setRegistrationOpen(true),
    closeRegistration: () => setRegistrationOpen(false),
    register,
    toggleFavorite,
    isFavorite,
  };
}
