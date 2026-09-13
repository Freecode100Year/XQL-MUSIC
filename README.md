# XQL MUSIC

XQL MUSIC 是一个面向桌面、手机和平板电脑的多音源在线音乐播放器。项目使用 React、TypeScript 和 Web Audio API 构建，并通过 Cloudflare Pages 与 Pages Functions 部署。

- 在线网站：[https://mp3.freedom8964.com/](https://mp3.freedom8964.com/)
- GitHub 仓库：[https://github.com/Freecode100Year/XQL-MUSIC](https://github.com/Freecode100Year/XQL-MUSIC)
- Cloudflare Pages 备用地址：[https://lesou-music.pages.dev/](https://lesou-music.pages.dev/)

## 主要功能

- 聚合搜索：每页最多返回 60 首歌曲，支持按音源筛选与继续加载。
- 播放控制：播放、暂停、上一首、下一首、进度拖动、音量控制、播放队列、顺序播放、随机播放和单曲循环。
- 锁屏播放：通过 Media Session API 向手机和平板电脑的锁屏界面提供歌曲信息和播放控制。
- 收藏列表：使用 11 位数字用户名在当前浏览器注册收藏用户，可顺序或随机播放收藏歌曲。
- 双语界面：根据设备系统语言自动显示简体中文或英文。
- 响应式布局：适配桌面浏览器、手机和平板电脑。
- 歌词与下载：在音源提供相应数据时显示同步歌词或提供下载入口。

## 音源

当前搜索入口包括：

- 网易云音乐
- JOOX
- Audius
- ccMixter
- Internet Archive CC
- Openverse
- Wikimedia Commons
- Open.Audio CC0
- 美国国会图书馆 National Jukebox

“全网”搜索会并行查询可用音源、交错合并结果并去重。音源是否可搜索、播放或下载取决于上游服务、地区限制和曲目许可；开放授权曲目仍应以来源页面标注的许可为准。

## 音频功能

- 31 段图形均衡器与自动预衰减
- Apple Music、AirPods、哈曼 IE 及多种耳机品牌听感预设
- 耳机交叉馈送和音箱外放模式
- 2 声道 8D 虚拟环绕、立体声宽度、单声道兼容和左右平衡
- 夜间模式、齿音抑制、等响度补偿和 K 计权响度均衡
- 感知音量曲线、输入增益、切歌淡入淡出、超低频高通和削顶保护

为减少爆音和失真，音频处理链会自动保留余量，并在输出末端使用限制器。浏览器首次播放仍需要用户主动点击，这是移动浏览器的媒体播放规则。

## 技术栈

| 用途 | 技术 |
| --- | --- |
| 用户界面 | React 18、TypeScript |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS、自定义 CSS |
| 音频处理 | Web Audio API、Media Session API |
| 服务端代理 | Cloudflare Pages Functions |
| 部署 | Cloudflare Pages |

## 本地开发

需要安装 Node.js 和 npm。

```bash
npm install
npm run dev
```

常用检查命令：

```bash
npm run build
npm run verify:audio
```

`verify:audio` 会计算音频处理链的频率响应，检查均衡器预衰减、交叉馈送、分频器求和和输出余量。

## 项目结构

```text
src/
├── audio/          # 高级音频处理、空间效果与参数
├── components/     # 页面、播放器、侧栏、均衡器与弹窗组件
├── hooks/          # 播放、搜索、歌词、收藏和均衡器逻辑
├── utils/          # 缓存、格式化与本地存储
├── App.tsx         # 应用组合与主要交互
├── config.ts       # API、音源及公共配置
└── i18n.tsx        # 中文和英文界面文本

functions/api/      # Cloudflare Pages Functions 音源与音频代理
public/             # 网站图标与 PWA manifest
scripts/            # 音频链验证脚本
```

## 构建与部署

先生成生产文件：

```bash
npm run build
```

再部署到现有 Cloudflare Pages 项目：

```bash
npx wrangler pages deploy dist --project-name=lesou-music --branch=main
```

Cloudflare Pages 项目仍使用内部名称 `lesou-music`，这样可以保留现有域名绑定。GitHub 仓库的默认分支是 `master`，Cloudflare 的生产分支是 `main`。

## 数据与许可说明

- 收藏用户名和收藏列表仅保存在当前设备的浏览器本地存储中，不是云端账号系统。
- 本项目不托管第三方音乐版权；使用者应遵守曲目来源网站的条款、许可和当地法律。
- 仓库目前未附带单独的开源许可证文件。
