My girlfriend was obsessed with The Book of Answers, so I vibe coded this for her.

我女朋友很迷《答案之书》，所以我就随手（vibe coded）给她做了这个。

## 答案之书

一个无需构建、无需后端的静态小应用。默念问题，轻触书本或按空格键，获得一句启发。

- 深松绿书封、金线星盘、纸张纹理和书签；支持手机、平板和电脑。
- 365 条中英双语答案：正向 133 条、反向 114 条、中性 118 条。一轮抽完前不会重复，跨轮也不会立即重复。
- 多层翻页动画、微光粒子，以及 Web Audio 合成的翻页声、和弦与合书声。
- 单按钮切换中英文，可静音，记住语言与声音偏好；支持键盘、屏幕阅读器和系统减少动态效果设置。
- Google Fonts 为可选资源，无法加载时使用本地备用字体。音效只在用户交互后播放。

### 本地运行

在仓库根目录执行：

```sh
python3 -m http.server 8000 --directory TheBookOfAnswers
```

用浏览器访问该服务器即可。部署时将 `TheBookOfAnswers/` 内的文件作为静态站点发布，无需安装应用依赖。

### 文件结构

```text
TheBookOfAnswers/
  index.html   页面结构、可访问语义与 SVG 装饰
  styles.css   视觉、书本动效、响应式与减少动态效果规则
  answers.js   双语答案数据，含音效／粒子氛围分类
  app.js       开合状态、无重复抽取、语言、偏好与音频管理
tests/
  smoke.py     真实 Chromium 浏览器回归测试
```

扩充答案时，在 `answers.js` 中为每条答案同时填写 `zh`、`en` 和 `sentiment`（`positive`、`neutral` 或 `negative`）。抽取逻辑自动适配数据长度；若有意调整条目总数，同步更新测试中的预期数量。

### 验证

```sh
node --check TheBookOfAnswers/app.js
node --check TheBookOfAnswers/answers.js
python3 tests/smoke.py
```

浏览器测试需要 Python 的 `playwright` 包与 Chromium。若未安装，可运行 `python3 -m pip install playwright` 和 `python3 -m playwright install chromium`。脚本优先使用系统 Chromium，也支持通过 `CHROMIUM_PATH` 指定路径；会自行启动并关闭临时 HTTP 服务器。

测试覆盖完整答案轮次、翻译对齐、键盘与重复提问、偏好持久化、旧版日文偏好回退、禁用存储、静音与动画状态，以及 320–1920px 和手机横屏布局。测试不依赖外部字体服务。
