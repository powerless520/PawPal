# PawPal 提交历史总结

> 数据来源：`git log`（截止 2026-09-03，共 **141** 个 commit）。
> 时间跨度：2026-04-26（init）→ 2026-09-03。
> 本文档按开发阶段整理；完整明细可用 `git --no-pager log --oneline` 查看。

---

## 一、总体统计

| 类型 | 数量 | 说明 |
| --- | --- | --- |
| feat | 62 | 新功能 |
| fix | 26 | 缺陷修复 |
| chore | 21 | 构建 / 打包 / 版本 / 杂项 |
| docs | 11 | 文档 |
| refactor | 9 | 重构 |
| ci | 4 | 持续集成 |
| style | 2 | 样式 |
| test | 1 | 测试 |
| other | 5 | Merge / 素材导入 / init 等 |

按月分布：

| 月份 | 提交数 | 主要工作 |
| --- | --- | --- |
| 2026-04 | 57 | 初建：核心循环、设置体系、品牌化、打包工程化 |
| 2026-05 | 31 | v0.1.x → v0.3.0：发布、更新检查、自定义外观 |
| 2026-06 | 7 | v0.3.1 修复批次 |
| 2026-07 ~ 08 | 3 | CI 与 README 维护 |
| 2026-09 | 43 | fork 本地化 + 功能爆发期（多宠物 / 装扮 / AI / 成长 / 主题） |

> 注：本仓库上游为开源 PawPal；2026-09-01 起 `a41d829` 之后为本地 fork 的独立迭代。

---

## 二、开发阶段时间线

### 阶段 0 · 2026-04-26 ~ 04-28 · 种子：素材与桌宠雏形

项目最初只是宠物素材 + 一个桌宠 demo（当时叫 Pawse）。

- `69e579c` init: puppy assets
- `3781611` Add background-removed Lovart footage GIFs
- `a001d39` feat: scaffold Pawse desktop pet demo
- `6ee8e6a` fix: make Pawse dev UI visible
- `1774e96` feat: improve pet window controls
- `1f9d6e9` feat: show timer status in settings
- `1fc2fb5` assets update

### 阶段 1 · 2026-04-29 · 核心养成循环：专注 / 休息 / 设置体系

把"专注提醒 + 休息打断 + 补水"做成可用产品，同时完成双语 i18n、设置面板重设计与主/渲染进程拆分。

- `307b85f` feat: detect focus distractions on macos（macOS 干扰检测）
- `8f95f32` feat: surface distraction status in settings
- `2a7b713` fix: preview distraction detection when enabled
- `710255a` feat: add bilingual i18n support
- `ce07154` refactor: split renderer views and hooks
- `409db4d` refactor: extract main process helpers
- `d0cac2c` docs: add open source project basics
- `86229f4` fix: allow dragging during focus mode
- `aab19a4` feat: add active break run sequence（休息跑步动画序列）
- `493e080` feat: add pet appearance manifests
- `0677c80` feat: auto-save settings and collapse diagnostics
- `abcd043` feat: improve distraction detection status copy
- `f6ea53b` feat: let users finish active break early
- `58bd5c6` feat: add first-run settings guidance
- `8cb6162` feat: redesign settings panel UI
- `d840682` fix: keep pet window background transparent
- `8c964dd` docs: add pet asset guide
- `047ed87` refactor: update settings UI components and styles
- `9f50984` refactor: enhance diagnostics UI
- `035a665` feat: enhance settings UI with new pet appearance selection
- `3f03678` fix: move settings copy into i18n
- `07be9a7` feat: refine settings overview and test tools
- `c2a4165` fix: use local date for daily stats
- `9ce1a78` feat: persist daily stats history（每日统计持久化）
- `3446088` refactor: remove idle patrol behavior
- `3711957` fix: tighten pet window bubble layout
- `c02b25e` fix: allow dragging during reminders
- `3daeddb` fix: keep pet position during focus
- `8e3711c` feat: add focus countdown badge（专注倒计时角标）
- `ae3af2f` fix: reduce pet window side padding

### 阶段 2 · 2026-04-30 · 动画状态打磨、品牌化 PawPal、打包准备

宠物动画状态语义化 + 资产整理 + 气泡文案打磨；Pawse 更名 PawPal，接入 electron-builder。

- `7ff823a` refactor: clarify pet animation states
- `6532b5a` feat: add semantic completion pet states
- `b565032` feat: use organized line dog assets
- `a9eae67` fix: remove click woof bubble
- `5461bbe` fix: preserve pet state while dragging
- `555a69b` refactor: remove sound settings
- `e464926` fix: replay finite break run gifs
- `b6a8a06` feat: let break run move around screen
- `991d3de` docs: clarify sitting pet state
- `db3e1b5` chore: organize golden puppy assets
- `d7a3b26` chore: move raw assets out of repo
- `1ba3563` chore: remove reset today entry from tray menu
- `71f1e6f` feat: polish bubble copy with random variants and dog-perspective tone
- `daa89f5` chore: hide test tools and demo entries in packaged builds
- `b9f3381` feat: show matched distraction rule in focus warning bubble
- `1e5b367` fix: smoother break run movement by increasing tick rate to ~60fps
- `d06c565` chore: simplify stats labels and add count unit suffix
- `5cbcb52` chore: expand default blocked apps and keywords for Chinese users
- `8618179` feat: add electron-builder packaging, rewrite README for open-source launch
- `d420d2f` chore: rename Pawse to PawPal, compress golden retriever GIFs, add app icon

### 阶段 3 · 2026-05-01 ~ 05-02 · 发布工程化：v0.1.x + CI + Windows 兼容

自定义协议加载素材、发布工作流、Windows 托盘兼容。

- `65690f1` fix: strip rule prefix in focus warning, tweak breathe animation
- `cff1953` fix: use custom protocol for asset loading（修复 dev 下图片失效）
- `2c2a1fd` chore: default to lineDog, mark golden puppy as beta, fix tray icon
- `1da52bc` fix: constrain pet asset protocol paths
- `efc82c4` chore: bump version to 0.1.1
- `5b17138` feat: add Windows compatibility guards
- `05f264c` chore: bump to v0.1.2, add Windows tray icon theme support, multi-platform dist
- `852873a` ci: add release workflow for Mac (arm64+x64) and Windows
- `724f901` ci: simplify release workflow to Windows-only, Mac DMGs uploaded manually
- `60f0831` fix(ci): add --publish never to avoid GH_TOKEN error
- `7cb44da` chore: bump to v0.1.3, improve drag reliability and pet window height

### 阶段 4 · 2026-05-03 ~ 05-06 · v0.2.0 / v0.3.0：版本信息、更新检查、自定义外观

- `0334c1a` docs: add downloads badge to README
- `c8c21a4` docs: update README for multi-platform support
- `b767f15` Merge pull request #12 (app-info-release-notes)
- `7347171` feat: show app version and release notes
- `77471dd` feat: add update check and launch at login (#16)
- `88a2921` refactor: split main process services (#17)
- `f4cbee0` refactor: add state logic tests (#18)
- `888b2c2` fix: keep pet visible across display changes (#19)
- `7266930` feat: add xiao ji mao pet appearance
- `9a7ff8a` fix: pass through transparent pet areas
- `e0781ad` fix: shrink pet click hitbox
- `41caeb8` chore: bump to v0.2.0
- `f1bd2ca` fix(ci): use packageManager from package.json
- `3934f72` docs: README for macOS Apple Silicon
- `57ae63b6` feat: support custom pet appearances（自定义外观）
- `c1414b0` feat: customize break run duration（休息跑步时长定制）
- `b8fcf09` style: refine settings layout
- `efa984f` style: rework settings panel layout
- `9ec0b89` fix: relax duration setting limits
- `a801967` chore: bump to v0.3.0

### 阶段 5 · 2026-06-02 · v0.3.1：修复批次

- `a52418a` fix: allow manual duration input (#28)
- `3d00e61` fix: keep break and hydration timers independent (#29)
- `9e4c659` fix: persist manual pet hiding (#30)
- `af6dd38` chore: update pnpm setup and pet menu labels
- `0e0c6fb` chore: add release documentation to .gitignore
- `acd8ae5` chore: bump to v0.3.1
- `f25875c` ci: use node 24 for release builds

### 阶段 6 · 2026-07-23 ~ 08-11 · CI 与文档维护

- `664304a` docs: make downloads badge clickable
- `157fa9e` ci: run typecheck and tests on pull requests
- `d91b017` docs: bump Node and pnpm requirements in README

### 阶段 7 · 2026-09-01 · fork 起步 + 功能爆发（多宠物 / 装扮 / AI / 成长）

本地 fork 后的一天内密集压栈了一批大功能。

- `a41d829` chore(fork): drop upstream constraints for local-only use（分叉点）
- `1111a3c` chore(tooling): sync ASSET_LICENSE.md + MP4-to-GIF 转换脚本
- `bd4fec8` feat(pet): add Little Dino built-in appearance
- `9718149` feat(pet): add Totodile built-in appearance
- `7ab1742` feat(pet): click interaction reactions（单击 / 双击 / 长按）
- `9df68c4` feat(pet): add time-driven mood system（随时间心情系统）
- `981b766` feat(pet): add idle wandering behavior
- `46fd8bc` feat(ai): add DeepSeek chat client and config UI
- `0a37f13` feat(pet): add active chitchat（按心情节奏的闲聊）
- `7447b62` chore(refactor): lay groundwork for multi-pet via PetInstance map
- `b8f82b8` feat(pet): add outfit system with 4 placeholder PNGs（装扮系统）
- `a6a0af4` feat(pet): add AI pet diary with deepseek-backed composition（AI 日记）
- `1968cc3` feat(pet): add catch-the-ball mini-game（接球小游戏）
- `c9f5919` feat(pet): add growth tracking with milestone celebrations（成长追踪）
- `58d6165` feat(roster): enable multi-pet with per-pet profiles（多宠物档案）
- `2c09b3b` feat(chat): add dedicated chat window with DeepSeek-backed replies
- `9f86ed7` feat(outfit): add seasonal auto-outfit mode（节日自动换装）
- `e1ecf50` feat(sound): add short sound effects for interactions and reminders
- `bc0d3fb` feat(pet): pet-actions submenu（跳舞 / 唱歌 / 转圈 / 爱心 / 伸懒腰）
- `f09e1f7` feat(outfit): expand seasonal calendar + user birthday
- `5fc972f` feat(outfit): allow users to upload custom PNG outfits
- `1895c24` test(outfit): cover seasonal calendar + outfit catalog, expand CI
- `fccb577` chore(build): drop hardenedRuntime + custom userData path (ASAR signing fix)
- `8bcbda0` feat(chat): redesign chat window for proper messaging UX
- `ccf5130` feat(pet): add mood emoji pill at the bottom of the pet window
- `81b8381` feat(outfit): each holiday now has 2-3 variants, pet picks one randomly
- `35a588c` feat(pet): triple the right-click actions menu（挥手 / 害羞 / 打哈欠）
- `05f720b` feat(pet): simplify dino + totodile to single default.gif per state

### 阶段 8 · 2026-09-02 ~ 09-03 · 扩展收尾：AI 增强、备份、TTS、彩蛋、成长阶段

- `ecf26de` docs(ai): add prompt library for generating pet assets
- `54612c7` feat(pet): add 7-day mood history with SVG line chart in Settings
- `492bbae` feat(backup): add settings export / import to a single JSON（备份）
- `eb50531` feat(ai): add Ollama (local LLM) as a chat provider（离线模型）
- `cbae6a8` feat(sound): add snoring loop while the pet is sleeping（打呼循环）
- `13438f6` feat(roster): log a goodbye + show a hello on pet switch
- `ee0a812` docs(r7): spec out TTS, pet snapshot export, and easter eggs
- `10baf8d` docs(overview): full product extension map from code audit
- `402e54e` feat(tts): voice bubble text with the OS text-to-speech engine（TTS 朗读气泡）
- `b6047e2` feat(snapshot): export current pet state as shareable PNG（快照导出）
- `025b73b` feat(easter-eggs): track click / right-click / long-press counters + 8 hidden eggs（彩蛋）
- `6a48b02` chore: add eslint + prettier and clean up dead code
- `f2a9326` feat(growth): stage-based companion growth with milestones（成长阶段系统）
- `65b986f` docs(history): summarize 139 commits into stage-based timeline（历史总结文档）
- `402efec` feat(theme): live-switchable chat themes（聊天窗口实时主题切换）

---

## 三、按功能域演进速览

| 功能域 | 关键提交（旧 → 新） |
| --- | --- |
| 专注 / 休息 / 干扰 | `307b85f` → `8e3711c` → `1e5b367` → `3d00e61` |
| 设置 UI + i18n | `710255a` → `8cb6162` → `035a665` → `efa984f` → `402efec`（聊天主题） |
| 多宠物 roster | `7447b62`（地基）→ `58d6165`（开启）→ `13438f6`（切换仪式）→ `f2a9326`（按宠物成长） |
| 装扮 outfit | `b8f82b8` → `9f86ed7` → `f09e1f7` → `81b8381` → `5fc972f` → `1895c24` |
| AI 聊天 | `46fd8bc`（DeepSeek）→ `2c09b3b` → `8bcbda0` → `eb50531`（Ollama） |
| 成长养成 | `c9f5919`（里程碑庆祝）→ `f2a9326`（阶段 / 24 足迹 / 里程碑墙） |
| 心情 / 统计 | `9ce1a78` → `9df68c4` → `ccf5130` → `54612c7` |
| 声音 | `555a69b`（早期移除）→ `e1ecf50`（重引入）→ `cbae6a8` |
| 打包 / 发布 | `8618179` → `852873a` → `fccb577` → `6a48b02` |

---

## 四、版本发布记录

| 版本 | 日期 | 主要变更 |
| --- | --- | --- |
| v0.1.1 | 2026-05-01 | 素材协议加载、Windows 兼容守卫 |
| v0.1.2 | 2026-05-02 | Windows 托盘主题、多平台 dist 脚本 |
| v0.1.3 | 2026-05-02 | 拖拽可靠性、窗口高度 |
| v0.2.0 | 2026-05-05 | 版本信息、更新检查、开机自启、新外观（xiao ji mao） |
| v0.3.0 | 2026-05-06 | 自定义外观、休息跑步时长定制、设置布局重做 |
| v0.3.1 | 2026-06-02 | 手动静置持久化、休息/补水定时器解耦、手动时长输入 |
| （未发版） | 2026-09 起 | fork 后全部新功能（多宠物 / 装扮 / AI / 日记 / 成长 / TTS / 彩蛋 …） |
