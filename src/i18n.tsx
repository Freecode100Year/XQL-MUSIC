import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Locale = 'zh-CN' | 'en';

const messages = {
  'zh-CN': {
    'site.title': 'XQL MUSIC - 全网音乐聚合',
    'repository.open': '在 GitHub 打开 XQL MUSIC 项目',
    'studio.open': '完整音频增强器', 'studio.native': '当前为锁屏优先播放；打开增强器启用音效后，音效调节才生效。',
    'nav.home': '发现音乐', 'nav.search': '搜索', 'nav.favorites': '我的收藏', 'nav.register': '注册',
    'register.title': '注册收藏用户', 'register.description': '输入 11 位纯数字用户名即可使用收藏功能。',
    'register.username': '11 位数字用户名', 'register.placeholder': '请输入 11 位数字', 'register.hint': '收藏保存在当前设备的浏览器中。',
    'register.invalid': '用户名必须正好是 11 位数字。', 'register.submit': '完成注册', 'register.close': '关闭注册窗口',
    'register.account': '用户 {username}',
    'favorites.title': '我的收藏', 'favorites.owner': '用户 {username}', 'favorites.sequential': '顺序播放', 'favorites.shuffle': '随机播放',
    'favorites.empty': '还没有收藏歌曲', 'favorites.emptyHint': '播放歌曲后点击歌曲名称旁边的 ❤️',
    'favorite.add': '收藏当前歌曲', 'favorite.remove': '取消收藏当前歌曲',
    'audio.settings': '播放设置', 'audio.gain': '预放大（输入）', 'audio.crossfeed': '耳机交叉馈送',
    'audio.speaker': '音箱外放', 'audio.equalizer': '均衡器', 'audio.volume': '音量',
    'audio.on': '开', 'audio.off': '关', 'audio.setup': '设置', 'audio.na': '不适用',
    'audio.crossfeedLight': '轻', 'audio.crossfeedMedium': '中', 'audio.crossfeedStrong': '强',
    'audio.crossfeedUnavailable': '音箱外放时无需交叉馈送', 'audio.crossfeedCycle': '点击切换关、轻、中、强',
    'audio.outputToggle': '点击切换耳机与音箱外放模式', 'audio.eqOpen': '打开均衡器设置',
    'audio.gainLabel': '音量增强倍数', 'audio.volumeLabel': '播放音量',
    'booster.title': 'AUDIO BOOSTER', 'booster.stereo': '立体声增强', 'booster.mono': '单声道兼容',
    'booster.night': '夜间模式', 'booster.balance': '左右平衡', 'booster.left': '左', 'booster.center': '居中', 'booster.right': '右',
    'booster.stereoTitle': '轻度扩展立体声宽度；后级限制器始终防止削波', 'booster.monoTitle': '将左右声道合成为单声道，适合单耳聆听',
    'booster.nightTitle': '压低突发响声、抬高细节，适合夜间或小音量聆听', 'booster.balanceLabel': '左右声道平衡',
    'booster.virtual8d': '2 声道 8D 虚拟', 'booster.virtual8dTitle': '以等功率左右声像缓慢旋转，营造两声道空间移动感；建议使用耳机',
    'booster.virtual8dSpeed': '8D 旋转速度', 'booster.virtual8dDepth': '8D 空间幅度', 'booster.virtual8dSpeedLabel': '8D 旋转速度调节', 'booster.virtual8dDepthLabel': '8D 空间幅度调节',
    'booster.perMinute': '{count} 次/分',
    'home.recommendations': '热门推荐', 'home.recommendationsFor': '热门推荐 - {artist}', 'home.refresh': '换一批',
    'home.aggregate': '全网音乐聚合', 'home.support': '支持在线音乐与开放授权音乐源搜索',
    'home.shortcuts': '快捷键: 空格 播放/暂停, 方向键 快进/快退/音量',
    'search.placeholder': '搜索歌曲、歌手...', 'search.submit': '搜索', 'search.history': '搜索历史',
    'search.clear': '清空', 'search.none': '未找到相关结果', 'search.more': '加载更多',
    'search.sourceError': '该音源暂时不可用', 'search.sourceLoading': '正在连接音源', 'search.sourceReady': '音源连接正常',
    'song.addQueue': '添加到队列', 'song.download': '下载', 'source.all': '全网', 'source.wy': '网易云',
    'source.openaudio': 'Open.Audio CC0', 'source.loc': '国会图书馆',
    'source.ia': '档案馆 CC', 'source.archive': '档案馆 CC', 'source.jamendo': 'Jamendo CC',
    'source.freesound': 'Freesound CC 音频', 'source.wikimedia': '维基共享资源',
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
    'eq.speakerNotice': '当前为音箱外放（Marshall 曲线），其它处理仍可独立叠加',
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
    'toast.registered': '注册成功，现在可以收藏歌曲', 'toast.favoriteAdded': '已添加到我的收藏', 'toast.favoriteRemoved': '已从我的收藏移除',
  },
  en: {
    'site.title': 'XQL MUSIC - Music Search',
    'repository.open': 'Open the XQL MUSIC project on GitHub',
    'studio.open': 'Full audio enhancer', 'studio.native': 'Lock-screen priority. Open the enhancer and enable effects to hear audio adjustments.',
    'nav.home': 'Discover', 'nav.search': 'Search', 'nav.favorites': 'My favorites', 'nav.register': 'Register',
    'register.title': 'Register for favorites', 'register.description': 'Enter an 11-digit numeric username to use favorites.',
    'register.username': '11-digit numeric username', 'register.placeholder': 'Enter 11 digits', 'register.hint': 'Favorites are stored in this browser on this device.',
    'register.invalid': 'The username must be exactly 11 digits.', 'register.submit': 'Register', 'register.close': 'Close registration',
    'register.account': 'User {username}',
    'favorites.title': 'My favorites', 'favorites.owner': 'User {username}', 'favorites.sequential': 'Play in order', 'favorites.shuffle': 'Shuffle play',
    'favorites.empty': 'No favorite songs yet', 'favorites.emptyHint': 'Play a song, then tap the ❤️ beside its title',
    'favorite.add': 'Add current song to favorites', 'favorite.remove': 'Remove current song from favorites',
    'audio.settings': 'PLAYBACK SETTINGS', 'audio.gain': 'Input preamp', 'audio.crossfeed': 'Headphone crossfeed',
    'audio.speaker': 'Speaker output', 'audio.equalizer': 'Equalizer', 'audio.volume': 'Volume',
    'audio.on': 'On', 'audio.off': 'Off', 'audio.setup': 'Set up', 'audio.na': 'N/A',
    'audio.crossfeedLight': 'Light', 'audio.crossfeedMedium': 'Medium', 'audio.crossfeedStrong': 'Strong',
    'audio.crossfeedUnavailable': 'Crossfeed is not needed for speaker output', 'audio.crossfeedCycle': 'Cycle through Off, Light, Medium, and Strong',
    'audio.outputToggle': 'Switch between headphone and speaker output', 'audio.eqOpen': 'Open equalizer settings',
    'audio.gainLabel': 'Volume boost multiplier', 'audio.volumeLabel': 'Playback volume',
    'booster.title': 'AUDIO BOOSTER', 'booster.stereo': 'Stereo+', 'booster.mono': 'Mono compatibility',
    'booster.night': 'Night mode', 'booster.balance': 'Left / right balance', 'booster.left': 'Left', 'booster.center': 'Center', 'booster.right': 'Right',
    'booster.stereoTitle': 'Gently widens the stereo image; the downstream limiter prevents clipping', 'booster.monoTitle': 'Mixes left and right into mono for one-ear listening',
    'booster.nightTitle': 'Tames sudden peaks and raises detail for quieter listening', 'booster.balanceLabel': 'Left / right channel balance',
    'booster.virtual8d': '2-channel virtual 8D', 'booster.virtual8dTitle': 'Slow equal-power panning creates a moving stereo image; headphones recommended',
    'booster.virtual8dSpeed': '8D rotation speed', 'booster.virtual8dDepth': '8D spatial depth', 'booster.virtual8dSpeedLabel': 'Adjust 8D rotation speed', 'booster.virtual8dDepthLabel': 'Adjust 8D spatial depth',
    'booster.perMinute': '{count} cycles/min',
    'home.recommendations': 'Recommended', 'home.recommendationsFor': 'Recommended — {artist}', 'home.refresh': 'Refresh',
    'home.aggregate': 'Music search', 'home.support': 'Search music from multiple platforms',
    'home.shortcuts': 'Shortcuts: Space play/pause, arrow keys seek and adjust volume',
    'search.placeholder': 'Search songs or artists...', 'search.submit': 'Search', 'search.history': 'Search history',
    'search.clear': 'Clear', 'search.none': 'No results found', 'search.more': 'Load more',
    'search.sourceError': 'This source is temporarily unavailable', 'search.sourceLoading': 'Connecting to source', 'search.sourceReady': 'Source connected',
    'song.addQueue': 'Add to queue', 'song.download': 'Download', 'source.all': 'All', 'source.wy': 'NetEase Cloud Music',
    'source.ia': 'Internet Archive CC', 'source.archive': 'Internet Archive CC', 'source.jamendo': 'Jamendo CC',
    'source.freesound': 'Freesound CC Audio', 'source.wikimedia': 'Wikimedia Commons',
    'source.openaudio': 'Open.Audio CC0', 'source.loc': 'Library of Congress',
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
    'eq.speakerNotice': 'Speaker output is active (Marshall curve); other processing can still be layered.',
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
    'toast.registered': 'Registration complete. You can now save favorites.', 'toast.favoriteAdded': 'Added to My favorites', 'toast.favoriteRemoved': 'Removed from My favorites',
  },
} as const;

export type TranslationKey = keyof typeof messages.en;
type TranslationValues = Record<string, string | number>;

export function detectDeviceLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages[0]?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
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
