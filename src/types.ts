export interface Song {
  id: string;
  name: string;
  artist: string;
  album?: string;
  pic?: string;
  pic_id?: string;
  duration?: number;
  source: SongSource;
  sourceType: SourceType;

}

export type SourceType = 'standard' | 'gd' | 'audius' | 'ccmixter' | 'archive' | 'openverse' | 'wikimedia';
export type StandardPlatform = 'wy' | 'jx';
export type GDSource = 'netease' | 'joox';
export type AudiusSource = 'au';
export type CcMixterSource = 'cc';
export type ArchiveSource = 'ia';
export type OpenverseSource = 'ov';
export type WikimediaSource = 'wm';
export type SongSource = StandardPlatform | GDSource | AudiusSource | CcMixterSource | ArchiveSource | OpenverseSource | WikimediaSource;

export interface SongDetail {
  url: string;
  pic?: string;
  lrc?: string;
  name?: string;
  artist?: string;
  album?: string;
}

export interface SearchResult {
  songs: Song[];
  keyword: string;
  platform: string;
  page: number;
}

export type PlayMode = 'sequential' | 'repeat-one' | 'shuffle';

export type Page = 'home' | 'search' | 'favorites';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}
