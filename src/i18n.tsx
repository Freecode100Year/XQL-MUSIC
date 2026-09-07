import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Locale = 'zh-CN' | 'en';

const messages = {
  'zh-CN': {
    'site.title': 'XQL MUSIC - 全网音乐聚合',
    'nav.home': '发现音乐', 'nav.search': '搜索',
    'audio.settings': '播放设置', 'audio.gain': '音量增强', 'audio.crossfeed': '耳机交叉馈送',
    'audio.speaker': '音箱外放', 'audio.equalizer': '均衡器', 'audio.volume': '音量',
    'audio.on': '开', 'audio.off': '关', 'audio.setup': '设置', 'audio.na': '不适用',
    'audio.crossfeedLight': '轻', 'audio.crossfeedMedium': '中', 'audio.crossfeedStrong': '强',
    'audio.crossfeedUnavailable': '音箱外放时无需交叉馈送', 'audio.crossfeedCycle': '点击切换关、轻、中、强',
    'audio.outputToggle': '点击切换耳机与音箱外放模式', 'audio.eqOpen': '打开均衡器设置',
    'audio.gainLabel': '音量增强倍数', 'audio.volumeLabel': '播放音量',
    'home.recommendations': '热门推荐', 'home.recommendationsFor': '热门推荐 - {artist}', 'home.refresh': '换一批',
    'home.aggregate': '全网音乐聚合', 'home.support': '支持网易云、酷我等多平台搜索',
    'home.shortcuts': '快捷键: 空格 播放/暂停, 方向键 快进/快退/音量',
    'search.placeholder': '搜索歌曲、歌手...', 'search.submit': '搜索', 'search.history': '搜索历史',
    'search.clear': '清空', 'search.none': '未找到相关结果', 'search.more': '加载更多',
    'search.sourceError': '该音源暂时不可用', 'search.sourceLoading': '正在连接音源', 'search.sourceReady': '音源连接正常',
    'song.addQueue': '添加到队列', 'song.download': '下载', 'source.all': '全网', 'source.wy': '网易云',
    'source.ia': '档案馆 CC', 'source.archive': '档案馆 CC', 'source.wikimedia': '维基共享资源',
    'queue.title': '播放队列', 'queue.count': '{count} 首', 'queue.empty': '队列为空', 'queue.emptyHint': '搜索歌曲并添加到队列',
    'player.notPlaying': '未播放', 'player.chooseSong': '选择一首歌曲开始播放',
    'lyrics.unknownSong': '未知歌曲', 'lyrics.unknownArtist': '未知歌手', 'lyrics.empty': '暂无歌词',
    'eq.title': '31 段均衡器', 'eq.subtitle': '各品牌耳机默认调音曲线', 'eq.reset': '重置',
    'eq.compare': '按住对比', 'eq.comparing': '原声对比中', 'eq.compareTitle': '按住时临时旁路均衡器，松开即恢复；不会修改当前预设',
    'eq.note': '以各品牌耳机出厂默认调音（相对哈曼入耳目标的偏差）拟合，用于把手上的中性耳机调成该品牌的听感；同一品牌不同型号会有差异，非厂商官方曲线。',
    'eq.bypassNotice': '当前为原声对比，松开后恢复均衡器。', 'eq.preampNotice': '自动预衰减 {value} dB，保留约 0.5 dB 削波余量。',
    'eq.noPreampNotice': '当前曲线不提升增益，无需预衰减。', 'eq.deEsser': '齿音抑制', 'eq.loudness': '等响度补偿',
    'eq.deEsserTitle': '分频式齿音抑制：只压 5.5kHz 以上、且只在齿音出现时压，专治入耳耳道共振区的刺耳',
    'eq.loudnessTitle': '等响度补偿：音量调低时按 ISO 226 自动补回低频与高频，小音量下不至于变干瘪',
    'eq.speakerNotice': '当前为音箱外放（Marshall 曲线），耳机专属处理已旁路',
    'eq.presetHint': '选择此调音曲线',
    'eq.preset.flat': '平坦', 'eq.preset.harman_ie': '哈曼 IE', 'eq.preset.sony': '索尼', 'eq.preset.bose': 'Bose',
    'eq.preset.airpods': 'AirPods', 'eq.preset.apple_music': 'Apple Music', 'eq.preset.sennheiser': '森海塞尔',
    'eq.preset.beats': 'Beats', 'eq.preset.akg': '三星 AKG', 'eq.preset.jbl': 'JBL', 'eq.preset.xiaomi': '小米',
    'eq.preset.huawei': '华为', 'eq.preset.shure': '舒尔', 'eq.preset.audiotechnica': '铁三角',
    'eq.preset.beyerdynamic': '拜亚动力', 'eq.preset.bo': 'B&O',
    'toast.downloadFailed': '获取下载地址失败', 'toast.downloadOpened': '已打开下载链接', 'toast.downloadUnavailable': '暂无下载地址',
    'toast.playFailedNext': '当前歌曲不可播放，已自动跳到下一首', 'toast.playFailed': '播放失败，请尝试其他源',
    'toast.urlFailedNext': '无法获取播放地址，已自动跳到下一首', 'toast.urlFailed': '无法获取播放地址',
    'toast.addedQueue': '已添加 {count} 首到队列', 'toast.crossfeedNotNeeded': '音箱外放模式下不需要交叉馈送',
    'toast.crossfeed': '耳机交叉馈送：{mode}', 'toast.deEsserOn': '齿音抑制 已开启', 'toast.deEsserOff': '齿音抑制 已关闭',
    'toast.loudnessOn': '等响度补偿 已开启', 'toast.loudnessOff': '等响度补偿 已关闭',
    'toast.speakerOn': '音箱外放 已开启 · Marshall 音箱曲线', 'toast.headphoneOn': '已切回耳机模式',
  },
  en: {
    'site.title': 'XQL MUSIC - Music Search',
    'nav.home': 'Discover', 'nav.search': 'Search',
    'audio.settings': 'PLAYBACK SETTINGS', 'audio.gain': 'Volume boost', 'audio.crossfeed': 'Headphone crossfeed',
    'audio.speaker': 'Speaker output', 'audio.equalizer': 'Equalizer', 'audio.volume': 'Volume',
    'audio.on': 'On', 'audio.off': 'Off', 'audio.setup': 'Set up', 'audio.na': 'N/A',
    'audio.crossfeedLight': 'Light', 'audio.crossfeedMedium': 'Medium', 'audio.crossfeedStrong': 'Strong',
    'audio.crossfeedUnavailable': 'Crossfeed is not needed for speaker output', 'audio.crossfeedCycle': 'Cycle through Off, Light, Medium, and Strong',
    'audio.outputToggle': 'Switch between headphone and speaker output', 'audio.eqOpen': 'Open equalizer settings',
    'audio.gainLabel': 'Volume boost multiplier', 'audio.volumeLabel': 'Playback volume',
    'home.recommendations': 'Recommended', 'home.recommendationsFor': 'Recommended — {artist}', 'home.refresh': 'Refresh',
    'home.aggregate': 'Music search', 'home.support': 'Search music from multiple platforms',
    'home.shortcuts': 'Shortcuts: Space play/pause, arrow keys seek and adjust volume',
    'search.placeholder': 'Search songs or artists...', 'search.submit': 'Search', 'search.history': 'Search history',
    'search.clear': 'Clear', 'search.none': 'No results found', 'search.more': 'Load more',
    'search.sourceError': 'This source is temporarily unavailable', 'search.sourceLoading': 'Connecting to source', 'search.sourceReady': 'Source connected',
    'song.addQueue': 'Add to queue', 'song.download': 'Download', 'source.all': 'All', 'source.wy': 'NetEase Cloud Music',
    'source.ia': 'Internet Archive CC', 'source.archive': 'Internet Archive CC', 'source.wikimedia': 'Wikimedia Commons',
    'queue.title': 'Play queue', 'queue.count': '{count} songs', 'queue.empty': 'Your queue is empty', 'queue.emptyHint': 'Search for a song and add it to the queue',
    'player.notPlaying': 'Nothing playing', 'player.chooseSong': 'Choose a song to start playing',
    'lyrics.unknownSong': 'Unknown song', 'lyrics.unknownArtist': 'Unknown artist', 'lyrics.empty': 'No lyrics available',
    'eq.title': '31-band equalizer', 'eq.subtitle': 'Brand headphone tuning curves', 'eq.reset': 'Reset',
    'eq.compare': 'Hold to compare', 'eq.comparing': 'Comparing original', 'eq.compareTitle': 'Hold to temporarily bypass the equalizer; release to restore it. Your preset is unchanged.',
    'eq.note': 'These curves approximate each brand’s factory headphone tuning relative to the Harman in-ear target. Models within a brand vary; they are not official manufacturer curves.',
    'eq.bypassNotice': 'Original audio comparison is active. Release to restore the equalizer.', 'eq.preampNotice': 'Automatic preamp: {value} dB, retaining about 0.5 dB of anti-clipping headroom.',
    'eq.noPreampNotice': 'This curve does not boost gain, so no preamp is needed.', 'eq.deEsser': 'De-esser', 'eq.loudness': 'Loudness compensation',
    'eq.deEsserTitle': 'Split-band de-essing only compresses above 5.5 kHz when sibilance occurs.',
    'eq.loudnessTitle': 'At lower volumes, ISO 226 compensation restores bass and treble.',
    'eq.speakerNotice': 'Speaker output is active (Marshall curve); headphone-only processing is bypassed.',
    'eq.presetHint': 'Select this tuning profile',
    'eq.preset.flat': 'Flat', 'eq.preset.harman_ie': 'Harman IE', 'eq.preset.sony': 'Sony', 'eq.preset.bose': 'Bose',
    'eq.preset.airpods': 'AirPods', 'eq.preset.apple_music': 'Apple Music', 'eq.preset.sennheiser': 'Sennheiser',
    'eq.preset.beats': 'Beats', 'eq.preset.akg': 'Samsung AKG', 'eq.preset.jbl': 'JBL', 'eq.preset.xiaomi': 'Xiaomi',
    'eq.preset.huawei': 'Huawei', 'eq.preset.shure': 'Shure', 'eq.preset.audiotechnica': 'Audio-Technica',
    'eq.preset.beyerdynamic': 'Beyerdynamic', 'eq.preset.bo': 'B&O',
    'toast.downloadFailed': 'Could not get a download link', 'toast.downloadOpened': 'Download link opened', 'toast.downloadUnavailable': 'No download link is available',
    'toast.playFailedNext': 'This song cannot be played. Skipping to the next song.', 'toast.playFailed': 'Playback failed. Try another source.',
    'toast.urlFailedNext': 'Could not get a playback URL. Skipping to the next song.', 'toast.urlFailed': 'Could not get a playback URL.',
    'toast.addedQueue': 'Added {count} song(s) to the queue', 'toast.crossfeedNotNeeded': 'Crossfeed is not needed for speaker output',
    'toast.crossfeed': 'Headphone crossfeed: {mode}', 'toast.deEsserOn': 'De-esser enabled', 'toast.deEsserOff': 'De-esser disabled',
    'toast.loudnessOn': 'Loudness compensation enabled', 'toast.loudnessOff': 'Loudness compensation disabled',
    'toast.speakerOn': 'Speaker output enabled · Marshall speaker curve', 'toast.headphoneOn': 'Switched back to headphone output',
  },
} as const;

export type TranslationKey = keyof typeof messages.en;
type TranslationValues = Record<string, string | number>;

export function detectDeviceLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some((language) => language.toLowerCase().startsWith('zh')) ? 'zh-CN' : 'en';
}

function translate(locale: Locale, key: TranslationKey, values: TranslationValues = {}): string {
  return messages[locale][key].replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

interface I18nValue {
  locale: Locale;
  t: (key: TranslationKey, values?: TranslationValues) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(detectDeviceLocale);

  useEffect(() => {
    const syncLocale = () => setLocale(detectDeviceLocale());
    window.addEventListener('languagechange', syncLocale);
    return () => window.removeEventListener('languagechange', syncLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, 'site.title');
  }, [locale]);

  const value = useMemo<I18nValue>(() => ({
    locale,
    t: (key, values) => translate(locale, key, values),
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside LocaleProvider');
  return context;
}
