# Round 7 需求文档

> 三件"新维度"功能：TTS 真声音 / 同人图导出 / 互动彩蛋  
> 消遣定位，每个独立 commit，互不阻塞

---

## 7.1 TTS 真声音（macOS 优先 + 跨平台 fallback）

### 目标
让宠物**用真的人声**说气泡里的字（不再只是文字 + WAV 音效）。这是沉浸感提升最大的单一改动。

### 行为

| 触发 | 现在 | 改后 |
|------|------|------|
| 宠物说"嗨~ 来啦" | 屏幕显示文字 + 选播 idleChatter.wav | 屏幕显示文字 + **真人声读出** |
| 切换宠物 | 文字 + 无声 | 文字 + 上一只"bye"人声 + 新一只"hello"人声 |
| AI 主动搭话 | 文字 + 无声 | 文字 + **用 LLM 的人声** |
| 喝水提醒 | 文字 + warning.wav | 文字 + warning.wav + **人声播报** |

### 设计要点

- **macOS**：用系统自带 `say` 命令，**零依赖、零下载**
  - `say -v "Tingting" "你好呀"` 用中文女声
  - `say -v "Samantha" "Hello there"` 用英文女声
  - `say -v "?"` 列可用声音
- **Windows**：用 PowerShell + SAPI
  - `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak("hello")`
- **Linux**：用 `espeak` 或 `spd-say`（fallback 退化）
- **设置项**：
  - `ttsEnabled: boolean`（默认开）
  - `ttsRate: number`（语速，0.5-2.0，默认 1.0）
  - 平台/语言自动选择 voice；用户可在设置里 override
- **打断**：上一句还没说完时来了新气泡 → kill 当前进程，开新的
- **不要的触发**：单击/双击/长按的"操作反馈"**不**触发 TTS（那应该是清脆音效 + 视觉），只**气泡内容**触发

### 实现要点

```ts
// src/main/ttsPlayer.ts
export class TtsPlayer {
  private currentProc: ChildProcess | null = null;

  speak(text: string, options: { voice?: string; rate?: number }): void {
    if (this.currentProc) this.currentProc.kill();
    if (process.platform === "darwin") {
      const voice = options.voice ?? defaultVoice();
      this.currentProc = spawn("say", ["-v", voice, "-r", String(options.rate ?? 180), text]);
    } else if (process.platform === "win32") {
      this.currentProc = spawn("powershell", ["-Command", `Add-Type ...; $s.Speak("${text}")`]);
    } else {
      this.currentProc = spawn("espeak", [text]);
    }
  }
  
  stop(): void { this.currentProc?.kill(); }
}
```

### 类型扩展

```ts
// src/shared/types.ts
Settings: {
  // ...existing
  ttsEnabled: boolean;
  ttsRate: number;       // 0.5 - 2.0
  ttsVoice: string | null; // null = auto
}
```

### 触发点（修改面）
- `main.ts: showBubble()` 在 bubble 没有 action 时调 `ttsPlayer.speak(bubble.message)`
- `main.ts: petReact()` 的"happy / petted / dance / wave" 走原音效路径（清脆反馈），**不**触发 TTS
- `main.ts: scheduleNextChatter()` AI 主动搭话触发 TTS
- `main.ts: roster:switch` 双气泡都触发 TTS
- `main.ts: chat:reply` 主动 TTS（用户改 chat 窗口的"听宠物说话"开关时）

### 不在范围内
- 不做 SSML / 语气情感
- 不做自定义 TTS provider（Ollama 已经有本地 LLM，但 TTS 用系统自带的更轻）
- 不做声音克隆

### 工作量
- **半天**（macOS 优先，1 小时）  
- 跨平台扩展 +1 天

---

## 7.2 同人图导出

### 目标
一键生成"我宠物当前状态"的 PNG，可分享到社交媒体。**最强拉新方式**。

### 行为

- 设置里加按钮"导出同人图"
- 或者右键 pet 弹出菜单里加"导出同人图"
- 点击 → 用 `webContents.capturePage()` 抓主窗口 PNG
- 弹出 native save dialog，默认 `~/Downloads/pawpal-{date}-{pet-label}.png`
- 同时在剪贴板放一份，方便粘贴到聊天

### 合成图设计

不是简单截图，而是**4:5 的合成图**：

```
┌─────────────────────────────────┐
│  ┌─────────┐  Pet: 小恐龙     │
│  │         │  ❤️ 陪伴 12 天   │
│  │  PET    │  今日心情: ✨    │
│  │ (about  │  ─────────────   │
│  │  60%)   │  "今天也想跟     │
│  └─────────┘   你一起努力~"  │
│                                 │
│  — PawPal Local · 2026-09-01  │
└─────────────────────────────────┘
```

合成方案：
- 主区域：截图 pet 窗口（透明背景 → PNG 自动透明）
- 装饰区：右上角宠物信息（label、成长数据、当前 mood）
- 底部署名 + 日期
- 调色板用 app 现有 design tokens

### 技术实现

```ts
// src/main/petSnapshot.ts
async function exportPetSnapshot(savePath: string): Promise<void> {
  if (!petWindow || petWindow.isDestroyed()) throw new Error("Pet not visible");
  
  // 1. 抓 pet 窗口截图（透明）
  const image = await petWindow.webContents.capturePage();
  const petPng = image.toPNG();
  
  // 2. 合成：调用 sharp 或者 node-canvas 画到 4:5 画布
  //    简单方案：用 sharp 拼图
  const composite = await sharp(petPng)
    .resize(400, 400, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .composite([{ input: overlayPng, blend: "over" }])
    .png()
    .toBuffer();
  
  // 3. 写文件
  await writeFile(savePath, composite);
}
```

### 简化方案（避免 sharp 依赖）

**不**用 sharp，用**纯 SVG → canvas 渲染**：
- 写一个 800x1000 的 SVG，包含 pet 当前 GIF 截图 + 装饰文字
- `nativeImage.createFromBuffer()` + canvas 都不行
- **改用 `webContents.printToPDF()` 或 `capturePage()` 主窗口的复合**

**最简方案**：
- 隐藏主 pet 窗口的"无状态" UI（暂时）
- 用 `BrowserWindow` 加载一个隐藏的 HTML 页面，包含合成模板 + 现有快照数据
- `capturePage()` 抓这张 HTML → PNG
- 写文件

这样**零依赖**、**视觉一致**。

### 设置 / 触发点

```ts
Settings: {
  // ...existing
  snapshotLayout: "default" | "minimal" | "festival"  // 未来扩展
}
```

- 设置里加"导出同人图"按钮
- 快捷键 ⌘⇧E（macOS）/ Ctrl+Shift+E（其他）
- 右键 pet 菜单加"导出同人图"

### 工作量
- **半天**（最简方案：隐藏窗口 + 合成 HTML + capturePage）
- 升级到 1-2 天（用 sharp 拼图，模板库）

---

## 7.3 互动彩蛋

### 目标
**让探索有惊喜**——纯客户端 if 计数触发，零 AI 依赖，发现后有"aha 时刻"。

### 8 个彩蛋（按价值排序）

| 触发条件 | 彩蛋效果 |
|----------|----------|
| 单击宠物 5 次（5 秒内） | 撒花 SVG 动画 + 气泡"🎉 五连击！" |
| 单击宠物 100 次（终身累计） | 宠物做 spin + 气泡"被你点了 100 次啦！" |
| 长按宠物 10 秒 | 宠物进入"深度睡眠"（state = sleeping 但带特殊气泡"ZZZ... 再久一点嘛~"） |
| 右键宠物 50 次 | 弹出 mega 菜单（所有 8 个 action + chat 入口 + export + 切换 pet）|
| 养 ≥ 3 只 pet | 切换菜单标题加"+N 群聊" |
| pet 在 sleeping 时被拖动 | 醒来时揉眼睛气泡"唔... 再睡会儿~" |
| 7 天不打开 app（首次打开时检测）| pet 看到用户时气泡"你终于回来啦！想你了~" + happy 状态 |
| 凌晨 3-5 点之间还开着 app | pet 偶尔发"主人该睡觉了" + sleepy 状态 |

### 实现原则

- **零 AI 依赖**——所有彩蛋是**计数器 + 时间戳**触发，**完全本地**、**无网络**
- **数据存在 electron-store** 里的 `petStats: { clickCount, dragCount, lastVisit, ... }`
- **不重复触发**——每个彩蛋用 `seen: boolean` 标记，看过一次就只显示一次（除非 count 跨越新阈值，比如 100/500/1000）
- **可以关**——设置里加"彩蛋提醒"开关
- **i18n**——所有彩蛋气泡文本双语

### 类型扩展

```ts
// src/shared/types.ts
type EasterEgg = 
  | "click5" | "click100" | "longPress10" | "rightClick50"
  | "threePets" | "wakeByDrag" | "comeback" | "lateNight";

Settings: {
  easterEggsEnabled: boolean;  // default true
}

type PetStats = {
  totalClicks: number;
  totalDrags: number;
  totalRightClicks: number;
  longestLongPressMs: number;
  lastVisitAt: number | null;
  seenEasterEggs: EasterEgg[];
};
```

### Settings 存储

```ts
// src/main/easterEggs.ts
const STATS_KEY = "petStats";

function recordClick(): PetStats { ... }
function recordRightClick(): PetStats { ... }
function recordLongPress(durationMs: number): PetStats { ... }
function recordVisit(): { stats: PetStats; comeback: boolean } { ... }
```

### 触发检测

```ts
// 在 petReact handler 里:
recordClick();
if (stats.totalClicks === 5 && !stats.seenEasterEggs.includes("click5")) {
  triggerEasterEgg("click5");
  showBubble({ message: "🎉 五连击！", ... });
}
```

### 视觉
- "撒花" 用纯 CSS 动画（10 个小圆点从中心向四周飞）
- "深度睡眠" 是 5 秒后自动唤醒
- "mega 菜单" 是临时切换 `performAction` 的菜单到 8 项

### 工作量
- **1 天**（8 个彩蛋，每个 0.5-1 小时）
- 可以先做**点击 5 次 / 100 次 + 深度睡眠** 3 个最显眼的，1 小时内出效果

---

## 共同类型扩展

```ts
// src/shared/types.ts 增量
type Settings = {
  // ...existing
  ttsEnabled: boolean;       // default true
  ttsRate: number;           // 0.5 - 2.0, default 1.0
  ttsVoice: string | null;   // null = auto-pick
  easterEggsEnabled: boolean; // default true
  snapshotLayout: "default" | "minimal"; // future expansion
};

type PetStats = {
  totalClicks: number;
  totalDrags: number;
  totalRightClicks: number;
  longestLongPressMs: number;
  lastVisitAt: number | null;
  seenEasterEggs: EasterEgg[];
};

type AppSnapshot = {
  // ...existing
  petStats: PetStats;
};
```

---

## commit 划分（每条独立可 ship）

```
commit 1: feat(tts): add text-to-speech for bubble messages
commit 2: feat(snapshot): export pet state as shareable PNG  
commit 3: feat(easter-eggs): add 8 hidden interactions
```

---

## 不在范围内（明确不做）

- **TTS provider 切换**（只用系统自带）
- **同人图模板库**（先用 1 个 default）
- **彩蛋配置化**（先硬编码）
- **iCloud 同步**（不是这一轮）
- **网络发现**（不是这一轮）
- **macOS Widget**（不是这一轮）
- **Voice 模式**（用 Whisper 做 ASR，不在这一轮）

---

## 验收标准

每个 commit 必须满足：
- ✅ `pnpm typecheck` 通过
- ✅ `pnpm test` 通过
- ✅ `pnpm build` 通过
- ✅ git log 干净，独立 commit message
- ✅ 至少 1 个 i18n string 双语完整
- ✅ 设置面板有 UI 入口

---

## 预计时间

| Commit | 时间 | 用户感知 |
|--------|------|----------|
| TTS | 1 天（macOS 优先 0.5 天 + 跨平台 0.5 天）| 听到宠物说话，沉浸感 ×10 |
| 同人图导出 | 0.5 天 | 一键分享，**拉新** |
| 互动彩蛋 | 1 天 | 探索惊喜，**口碑** |
| **合计** | **2.5 天** | **3 个新维度** |

---

## 我建议的执行顺序

1. **TTS**（最有沉浸感）→ 做完立刻能体验
2. **同人图导出**（拉新价值最高）→ 半天能出
3. **互动彩蛋**（1 天）→ 口碑钩子

要我**先做 TTS 吗**？还是**改顺序**？还是**你还有想加的需求**？