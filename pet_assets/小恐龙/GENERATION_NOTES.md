# 小恐龙 / Little Dino — 素材生成备忘

本文件汇总"小恐龙"角色所有状态 GIF 的 AI 生成 prompt、命名规范和落位规则。修改或新增 GIF 前请先读一遍。

---

## 1. 通用规格

所有状态的 GIF 必须满足以下规格，否则在 PawPal 主窗口里会显得突兀或过大：

| 项目 | 推荐值 | 备注 |
|------|--------|------|
| 画布 | 256×256（首选）或 192×192 | 必须方形，居中构图 |
| 时长 | 1.6 ~ 2.4 秒 | 越长越不"灵" |
| 帧率 | 12 ~ 18 fps | 太低会卡顿，太高文件大 |
| 文件大小 | ≤ 200 KB / 张 | 用 `gifsicle` 压 |
| 背景 | 透明（首选）或纯白 | 透明优先；纯白会被窗口背景"切掉"也能用 |
| 循环 | 必须无缝 | 首帧 = 尾帧 |
| 视角 | 角色面朝镜头、居中 | 头部留约 15% 顶部空间 |
| 风格 | kawaii / sticker / 2D 精灵 | 不要写实风 |

**压缩命令**（每张生成后必跑）：

```bash
gifsicle -O3 --lossy=80 --colors 128 input.gif -o output.gif
# 颜色降到位图更小的同时保持视觉
```

---

## 2. 参考图（Step 0）

所有动画 GIF 都应该基于同一张参考图生成，以保证角色形象一致。**这张图不打包进 app，只留本地**。

保存位置：`_raw_assets/dino_reference.png`（被 `.gitignore` 排除）

**Prompt**（Midjourney / SDXL / DALL·E / 可灵图均适用）：

> A cute chibi cartoon baby dinosaur mascot, round chubby body, big shiny eyes, short stubby arms and legs, soft mint-green skin with a pale yellow belly, tiny T-rex arms held up, standing pose facing front, white background, sticker style, clean lineart, vibrant flat colors, 2D sprite art aesthetic, character design sheet, kawaii style, no shadows, no watermark

---

## 3. 状态 → 文件映射

每个状态在 `src/shared/petAppearances.ts` 的 `dino` 条目里都有声明。落位前先看一下当前的代码以确认路径和 `isPlaceholder` 标记。

| PetState 状态 | 文件路径 | 是否必须 | fallback 行为 |
|---------------|----------|----------|---------------|
| `idle` | `pet_assets/小恐龙/idle/站.gif` | **必需** | 无（idle 是 fallback 链的底） |
| `idle` (变体) | `pet_assets/小恐龙/idle/眨眼.gif` | 可选 | 二选一循环，提升"活"感 |
| `happy` | `pet_assets/小恐龙/happy/欢呼.gif` | 推荐 | 无 happy 会回落到 idle |
| `breakPrompt` | `pet_assets/小恐龙/breakPrompt/戳你.gif` | 推荐 | 无会回落到 happy |
| `breakRunning` | `pet_assets/小恐龙/breakRunning/跑.gif` | 推荐 | 无会回落到 happy |
| `hydrationPrompt` | `pet_assets/小恐龙/hydrationPrompt/指嘴.gif` | 推荐 | 无会回落到 happy |
| `drinking` | `pet_assets/小恐龙/drinking/喝水.gif` | 推荐 | 无会回落到 happy |
| `focusAlert` | `pet_assets/小恐龙/focusAlert/皱眉.gif` | 推荐 | 无会回落到 happy |
| `focusGuard` | `pet_assets/小恐龙/focusGuard/盯屏幕.gif` | 可选 | 无会回落到 idle |
| `sad` | `pet_assets/小恐龙/sad/委屈.gif` | 可选 | 已标记 `isPlaceholder`，可临时缺 |
| `sleeping` | `pet_assets/小恐龙/sleeping/睡.gif` | 可选 | 已标记 `isPlaceholder`，可临时缺 |

`breakDone` / `hydrationDone` / `focusDone` / `sitting` 这四个状态**不需要单独做**，代码里有自动 fallback（见 `petAppearances.ts` 里的 `STATE_FALLBACKS`）。

---

## 4. 各状态的 AI 视频 prompt

把 `dino_reference.png` 作为起始帧喂给 image-to-video 工具（可灵、Pika、Stable Video Diffusion、Runway Gen-3 等），配合下面的 prompt 出动画。生成完毕用 ffmpeg 或 ezgif 转码为 GIF，再用 `gifsicle` 压缩。

### idle / 站.gif

```
character breathing softly in place, subtle body sway, blinking every 2 seconds, micro head tilts, idle loop, no big movement
```

- 时长：2.4s
- 提示：动作要"几乎不动"，主要是呼吸起伏 + 偶尔眨眼。`CONTINUOUS_ASSET_ROTATION_MS` 默认每 15 分钟切到 `眨眼.gif` 一次。

### idle / 眨眼.gif

```
character standing still, single slow blink then back to neutral, very subtle motion
```

- 时长：1.6s
- 提示：只做一次完整的"睁→闭→睁"循环，不要做"眨个不停"。

### happy / 欢呼.gif

```
character jumps up and down happily, both arms raised in cheer, small confetti or sparkle effects, big smile, looping bounce
```

- 时长：2.0s
- 提示：跳跃幅度要明显（不然看不出在庆祝），落地和起跳都要有缓冲。

### breakPrompt / 戳你.gif

```
character walks to the front of the frame, taps screen with one paw, looks up at viewer with curious head tilt, returns to start
```

- 时长：2.4s
- 提示：动作要有"叫醒你"的感觉，最后一帧必须和首帧完全一致（无缝循环）。

### breakRunning / 跑.gif

```
character runs in place from left to right repeatedly with energetic leg movement, bouncy stride, cheerful expression, fast loop
```

- 时长：2.0s
- 提示：**原地跑**，不要平移画面。代码会在窗口里另外做横向位移，跑本身保持居中。已在代码里设了 `replayIntervalMs: 4500` 让动画每 4.5 秒重播一次。

### hydrationPrompt / 指嘴.gif

```
character points at its own mouth with one paw, gives a 'thirsty' gesture, slight bouncing
```

- 时长：1.8s
- 提示：动作要清晰传递"渴了"信号，配上轻微弹跳会更可爱。

### drinking / 喝水.gif

```
character lifts a small water bottle to its mouth, tilts head back to drink, lowers bottle back down, content expression
```

- 时长：2.4s
- 提示：举瓶→仰头→放下，三段动作要连贯。瓶子可以自己画一个卡通款贴在角色手里。

### focusAlert / 皱眉.gif

```
character shows an annoyed or warning face, eyebrows furrowed, looks directly at viewer with a 'no' gesture, slight head shake
```

- 时长：2.0s
- 提示：表情要够"凶"，让用户感到被警告；不要太吓人否则影响心情。

### focusGuard / 盯屏幕.gif

```
character sits at a tiny desk typing on a small laptop, focused expression, occasional blink, subtle typing motion
```

- 时长：2.4s
- 提示：可以加一个小笔记本/电脑道具；如果尺寸紧，可以只保留角色上半身 + 假装打字的手。

### sad / 委屈.gif（可临时缺）

```
character pouts sadly, single tear drop forming, drooping shoulders, soft whimpering motion
```

- 时长：1.8s
- 备注：代码里标了 `isPlaceholder: true`，临时缺这张图不影响运行（自动用 idle 顶上）。

### sleeping / 睡.gif（可临时缺）

```
character curled up sleeping, Zzz floating up, gentle breathing motion, peaceful expression
```

- 时长：2.4s
- 备注：同上，可临时缺。

---

## 5. 落位 + 验证流程

每张 GIF 生成完毕后：

1. **重命名**为清单里的目标文件名（中文文件名 OK，但避免空格/特殊字符）。
2. **压缩**：`gifsicle -O3 --lossy=80 --colors 128 原文件名.gif -o 目标文件名.gif`
3. **手动预览**：双击在图片浏览器里看一遍，确认：
   - 透明背景 OK（如果是白底，窗口里会显得很突兀）
   - 循环无缝
   - 角色始终居中且完整
4. **落位**到对应子目录。
5. **更新测试**：所有必需状态都齐了之后，在 `tests/petAppearances.test.ts` 末尾追加：

   ```ts
   {
     name: "Little Dino asset paths exist for all pet states",
     run(): void {
       for (const state of petStates) {
         for (const path of pathsFor("dino", state)) {
           assert.equal(existsSync(resolve(process.cwd(), path)), true, path);
         }
       }
     }
   }
   ```

6. **跑测试**：`pnpm test`，全部通过即视为完成。
7. **跑 typecheck**：`pnpm typecheck`，确认类型依然干净。

---

## 6. 风格迭代记录

每次更新参考图或整体配色时，在这里追加一行，方便回溯。

| 日期 | 改动 | 备注 |
|------|------|------|
| _初始化_ | 浅绿身 + 浅黄肚，T-rex 小手，kawaii 2D 风 | 见 Step 0 prompt |