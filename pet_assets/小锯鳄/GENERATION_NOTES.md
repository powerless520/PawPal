# 小锯鳄 / Totodile — 素材生成备忘

本文件汇总"小锯鳄"角色所有状态 GIF 的 AI 生成 prompt、命名规范和落位规则。

> ⚠️ **IP / 商标提示**：小锯鳄（Totodile）是 Nintendo / Game Freak / The Pokémon Company 的注册商标。生成的 GIF **仅供个人学习、非商业使用**。fork 后公开分发二进制、商店截图、宣传素材前，请替换为原创角色，或仅作为不会公开展示的"隐藏外观"使用。详见 `../../ASSET_LICENSE.md` 的 IP / Trademark Note。

---

## 1. 通用规格

| 项目 | 推荐值 | 备注 |
|------|--------|------|
| 画布 | 256×256（首选）或 192×192 | 必须方形，居中构图 |
| 时长 | 1.6 ~ 2.4 秒 | 越长越不"灵" |
| 帧率 | 12 ~ 18 fps | 太低会卡顿，太高文件大 |
| 文件大小 | ≤ 200 KB / 张 | 用 `gifsicle` 压 |
| 背景 | 透明（首选）或纯白 | 透明优先 |
| 循环 | 必须无缝 | 首帧 = 尾帧 |
| 视角 | 角色面朝镜头、居中 | 头部留约 15% 顶部空间 |
| 风格 | **原创 / 致敬风格** | 不要 1:1 复刻官方立绘，避免与官方混淆 |

**压缩命令**（每张生成后必跑）：

```bash
gifsicle -O3 --lossy=80 --colors 128 input.gif -o output.gif
```

---

## 2. Step 0：参考图

**风格定调**：参考图要刻意拉开与官方立绘的距离，避免直接蹭 IP。可以选择：

- **方案 A（水彩萌系）**：圆润造型、暖色调、明显眼睛高光、简化身体细节
- **方案 B（像素风）**：完全像素化（致敬 Pokémon 像素图鉴，但自己重画）
- **方案 C（Q版豆腐块）**：超简化、几何化、卡通大头小身

**Prompt 模板**（方案 A 作示例；用方案 B/C 时把 "chibi watercolor" 换成对应风格词）：

> Original cute chibi crocodile creature character design, inspired by a teal bipedal crocodile with a big head and toothy grin, but reinterpreted in a soft chibi watercolor style with rounded edges, no sharp teeth, big friendly eyes, pale teal-blue skin with cream belly, short stubby limbs, big round tail, white background, sticker style, clean lineart, no Pokemon branding or logo, no watermark

- **关键**：prompt 里**明确写 "no Pokemon branding or logo"**，避免 AI 训练数据把官方水印带进来。
- 保存位置：`_raw_assets/totodile_reference.png`（`.gitignore` 排除）

---

## 3. 状态 → 文件映射

每个状态在 `src/shared/petAppearances.ts` 的 `totodile` 条目里都有声明。先核对代码再放素材。

| PetState 状态 | 文件路径 | 是否必须 | fallback 行为 |
|---------------|----------|----------|---------------|
| `idle` | `pet_assets/小锯鳄/idle/站立.gif` | **必需** | 无（idle 是 fallback 链的底） |
| `idle` (变体) | `pet_assets/小锯鳄/idle/咬空气.gif` | 可选 | 调剂用 |
| `happy` | `pet_assets/小锯鳄/happy/蹦跳欢呼.gif` | 推荐 | 无 happy 会回落到 idle |
| `breakPrompt` | `pet_assets/小锯鳄/breakPrompt/拍屏幕.gif` | 推荐 | 无会回落到 happy |
| `breakRunning` | `pet_assets/小锯鳄/breakRunning/狂奔.gif` | 推荐 | 无会回落到 happy |
| `hydrationPrompt` | `pet_assets/小锯鳄/hydrationPrompt/指水.gif` | 推荐 | 无会回落到 happy |
| `drinking` | `pet_assets/小锯鳄/drinking/喝水溅水.gif` | 推荐 | 无会回落到 happy |
| `focusAlert` | `pet_assets/小锯鳄/focusAlert/愤怒脸.gif` | 推荐 | 无会回落到 happy |
| `focusGuard` | `pet_assets/小锯鳄/focusGuard/啃键盘.gif` | 可选 | 无会回落到 idle |
| `sad` | `pet_assets/小锯鳄/sad/大哭.gif` | 可选 | 标了 `isPlaceholder`，可临时缺 |
| `sleeping` | `pet_assets/小锯鳄/sleeping/抱着尾巴睡.gif` | 可选 | 标了 `isPlaceholder`，可临时缺 |

`breakDone` / `hydrationDone` / `focusDone` / `sitting` 这四个状态**不需要单独做**，代码里有自动 fallback（见 `petAppearances.ts` 里的 `STATE_FALLBACKS`）。

---

## 4. 各状态的 AI 视频 prompt

把参考图喂给 image-to-video 工具，配合下面的 prompt 出动画。

> ⚠️ 每个 prompt 里都加了 **"no Pokemon branding or logo, original character interpretation"**，避免 AI 偷渡官方素材。

### idle / 站立.gif

```
original cute chibi crocodile character standing in place, soft breathing motion, occasional blink, subtle tail wag, no Pokemon branding or logo, original character interpretation, idle loop
```

- 时长：2.4s
- 提示：动作要"几乎不动"，主要是呼吸起伏 + 眨眼 + 偶尔甩尾巴。

### idle / 咬空气.gif

```
chibi crocodile character pretending to bite at empty air in front of it, mouth opens and closes rhythmically, playful gesture, no Pokemon branding or logo, original character interpretation
```

- 时长：1.6s
- 提示：小锯鳄的招牌动作 —— 张嘴"咬咬咬"，但只是空气。嘴巴张合要明显。

### happy / 蹦跳欢呼.gif

```
chibi crocodile character jumps up and down happily, both arms raised in cheer, water droplet sparkles around, big toothy smile, looping bounce, no Pokemon branding or logo, original character interpretation
```

- 时长：2.0s
- 提示：跳跃 + 水滴特效（结合水属性）。落地和起跳都要有缓冲。

### breakPrompt / 拍屏幕.gif

```
chibi crocodile character walks to the front of the frame and pats the screen with one paw, then looks up at viewer with curious head tilt, returns to start, no Pokemon branding or logo, original character interpretation
```

- 时长：2.4s
- 提示：拍屏幕的动作要清晰、有节奏感；最后一帧必须和首帧完全一致。

### breakRunning / 狂奔.gif

```
chibi crocodile character runs in place from left to right repeatedly, energetic four-legged gait, bouncy stride, cheerful expression, fast loop, no Pokemon branding or logo, original character interpretation
```

- 时长：2.0s
- 提示：**原地跑**，不要平移画面。代码会在窗口里另外做横向位移。已设了 `replayIntervalMs: 4500` 让动画每 4.5 秒重播一次。

### hydrationPrompt / 指水.gif

```
chibi crocodile character points at its own mouth with one paw, gives a 'thirsty' gesture, slight bouncing, small water drop appearing above its head, no Pokemon branding or logo, original character interpretation
```

- 时长：1.8s
- 提示：水属性 + 喝水提示 = 天然契合。可以加个水滴小图标暗示"渴了"。

### drinking / 喝水溅水.gif

```
chibi crocodile character lifts a small water cup to its mouth, tilts head back to drink, water splashes around its face, lowers cup back down, content expression, no Pokemon branding or logo, original character interpretation
```

- 时长：2.4s
- 提示：举杯→仰头→溅水→放下，四段动作连贯。**溅水效果是小锯鳄的特色**，要保留。

### focusAlert / 愤怒脸.gif

```
chibi crocodile character shows an angry warning face, eyebrows furrowed, mouth open showing teeth, looks directly at viewer with a 'no' gesture, slight head shake, no Pokemon branding or logo, original character interpretation
```

- 时长：2.0s
- 提示：小锯鳄的"愤怒脸"是它的招牌，比小恐龙的更夸张。表情要够"凶"，让用户感到被警告。

### focusGuard / 啃键盘.gif

```
chibi crocodile character sits at a tiny desk biting or gnawing on a tiny laptop with its teeth, focused and determined expression, occasional blink, subtle biting motion, no Pokemon branding or logo, original character interpretation
```

- 时长：2.4s
- 提示：把"啃"这个动作做到位 —— 不是打字，是真的在啃键盘边缘。尾巴偶尔甩动。

### sad / 大哭.gif（可临时缺）

```
chibi crocodile character pouts sadly, big anime tears streaming down cheeks, drooping shoulders, soft whimpering motion, no Pokemon branding or logo, original character interpretation
```

- 时长：1.8s
- 备注：标了 `isPlaceholder: true`，临时缺不影响运行（自动用 idle 顶上）。

### sleeping / 抱着尾巴睡.gif（可临时缺）

```
chibi crocodile character curled up hugging its own big round tail while sleeping, Zzz floating up, gentle breathing motion, peaceful expression, no Pokemon branding or logo, original character interpretation
```

- 时长：2.4s
- 备注：抱着大尾巴睡觉是水属性小鳄鱼的招牌动作，做出来会很可爱。

---

## 5. 落位 + 验证流程

每张 GIF 生成完毕后：

1. **审查视觉**：在浏览器/图片浏览器里打开，确认：
   - **不包含任何官方 Pokémon 标识、水印、官方字体**
   - 角色风格确实与官方立绘有显著差异（圆润、简化、原创色调）
   - 透明背景 OK
   - 循环无缝
   - 角色始终居中且完整
2. **重命名**为清单里的目标文件名。
3. **压缩**：`gifsicle -O3 --lossy=80 --colors 128 原文件名.gif -o 目标文件名.gif`
4. **落位**到对应子目录。
5. **更新测试**：所有必需状态都齐了之后，在 `tests/petAppearances.test.ts` 末尾追加：

   ```ts
   {
     name: "Totodile asset paths exist for all pet states",
     run(): void {
       for (const state of petStates) {
         for (const path of pathsFor("totodile", state)) {
           assert.equal(existsSync(resolve(process.cwd(), path)), true, path);
         }
       }
     }
   }
   ```

6. **跑测试**：`pnpm test`，全部通过即视为完成。
7. **跑 typecheck**：`pnpm typecheck`，确认类型依然干净。
8. **本地构建测试**：`pnpm dist:mac`（或 `pnpm dist:win`）跑一次完整打包，确认 `extraResources` 里包含 `pet_assets/小锯鳄/`。

---

## 6. 发版前必读

如果你打算把这个 fork 公开发布（GitHub Releases / 商店 / 截图宣传），**必须**先做下面其中一项：

- **方案 1（推荐）**：把所有官方 IP 致敬的宠物从打包资源里剔除，只保留原创角色。在 `petAppearances.ts` 里把 `totodile` 整块删掉（或注释掉），把 `BuiltInPetAppearanceId` 里的 `"totodile"` 也去掉，让设置面板根本看不到这个选项。
- **方案 2**：用原创角色替换（命名为 `waterCrocodile`、`blueGator` 等完全原创的 id 和名称），prompt 里去掉任何 Pokémon 致敬元素，**画面上和官方立绘完全无关**。
- **方案 3**：保留 IP 致敬，但 fork 仅在自己机器上跑、不公开发布任何二进制。

**千万不要**：直接发布带 Pokémon 致敬角色的 .dmg 到 GitHub Releases 公共页面，或者在 README 里截图宣传。Nintendo 的法务对自家 IP 一向非常敏感。

---

## 7. 风格迭代记录

每次更新参考图或整体配色时，在这里追加一行。

| 日期 | 改动 | 备注 |
|------|------|------|
| _初始化_ | 水彩萌系 / 蓝绿色身体 + 米色肚 / 致敬风（非官方复刻） | 见 Step 0 prompt |