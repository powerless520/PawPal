# AI Prompt 库

> 给后续新增 / 替换宠物形象时直接复制粘贴的素材生成 prompt 集合。
>
> 工作流：参考图（首帧）→ image-to-video（每状态一个 5 秒 MP4）→ `./scripts/mp4-to-pawpal-gif.sh` → `pet_assets/<pet>/<state>/default.gif`。
>
> 工具推荐：可灵（Kling, 国内访问稳 / 中文 prompt）｜Pika（角色一致性好）｜Runway Gen-3（最稳）｜Midjourney（参考图质量顶级）。
>
> 状态机见 `docs/asset-guide.md` 的"状态契约"一节。manifest 的 fallback 链 + `default.gif` 命名约定让单状态缺失也能让窗口保持透明而不破图。

## 通用前置

**参考图 prompt 关键句**（所有角色都该带上）：

```
transparent background, 2D sprite art style, clean lineart,
kawaii aesthetic, no shadows, no watermark, no text, no logo
```

**状态 video prompt 关键句**（让 5 秒素材更可能循环）：

```
loop, looped, looping animation, continuous, no fade-in, no fade-out
```

**禁止用**（防止 AI 偷渡官方形象 / 痕迹）：

```
no Pokemon, no Nintendo, no official, no franchise
```

---

## 已内置：通用 6 状态包

如果不知道从哪儿开始，先做这 6 个状态足以让宠物"活起来"：

| 优先级 | 状态 | 在哪里看到 |
|--------|------|-----------|
| ⭐⭐⭐ | `idle` | 99% 时间 |
| ⭐⭐⭐ | `happy` | 每次点击 |
| ⭐⭐ | `walking` | 游走中 |
| ⭐⭐ | `petted` | 长按 |
| ⭐⭐ | `sleeping` | 深夜 |
| ⭐ | `breakPrompt` | 偶尔提醒 |

---

## 小恐龙（Little Dino / id: `dino`）

目录：`pet_assets/小恐龙/`

### 参考图

**中文**：
```
一只可爱的卡通小恐龙吉祥物角色设计。圆滚滚的身体，大大的闪亮眼睛，
短短的小手小脚，薄荷绿色皮肤配淡黄色肚皮，两只小霸王龙手臂举着，
正面站姿，透明背景，2D 贴纸风格，干净线条，鲜艳平涂颜色，kawaii
可爱风格，没有阴影，没有水印，没有文字，没有宝可梦 logo
```

**English**：
```
A cute kawaii chibi baby dinosaur (T-rex style) mascot character
for a desktop pet app. Round chubby body, big shiny eyes with star
highlights, short stubby arms and legs, soft mint-green skin with
pale yellow belly, tiny T-rex arms held up, standing pose facing
front, transparent background, 2D sprite art style, clean lineart,
kawaii aesthetic, no shadows, no watermark, no text, no Pokemon logo
```

### 状态视频

| 状态 | 中文 | English |
|------|------|---------|
| `idle` | 角色站在原地，呼吸起伏很轻，每隔 2 秒眨眼一次，几乎不动的状态，循环动画 | Character standing in place, breathing softly, blinking every 2 seconds, very subtle motion, looped animation |
| `happy` | 角色开心地跳起来，两只小手举过头顶，大笑，循环往复地跳 | Character jumping up and down happily with both arms raised above head, big smile, looping bounce |
| `walking` | 角色原地踏步走路，步伐有弹性，表情开心，循环重复 | Character walking in place from left to right, bouncy stride, cheerful expression, looped |
| `petted` | 角色被抚摸，表情满足，眼睛眯起来，享受地蹭着，循环 | Character being petted, content expression, eyes closed, leaning into the petting hand, looped |
| `sleeping` | 角色蜷起来睡觉，ZZZ 飘出来，均匀的呼吸起伏，循环 | Character curled up sleeping, ZZZ floating up, gentle breathing motion, peaceful expression, looped |
| `breakPrompt` | 角色歪头看着镜头，一只小手戳前方的屏幕，好奇的样子，循环 | Character tilting head at viewer curiously, tapping forward with one paw as if poking the screen, looped |
| `breakRunning` | 角色面朝右快速奔跑，表情有活力有冲劲，循环 | Character running fast facing right, energetic expression, looped running motion |
| `drinking` | 角色捧着一个小杯子喝水，喝完满足地舔舔嘴 | Character holding a small cup drinking water, then licking lips contentedly |
| `hydrationPrompt` | 角色指着自己的嘴巴，做口渴状 | Character pointing at its own mouth, making a thirsty gesture |
| `focusGuard` | 角色面朝前认真盯着屏幕或一个小书本，专注的表情 | Character staring forward at a small book, focused concentrated expression |
| `focusAlert` | 角色皱起眉头，指向用户，双手叉腰 | Character frowning, pointing at viewer, hands on hips |
| `breakDone` | 角色伸懒腰后开心地挥爪 | Character stretching then waving happily |
| `hydrationDone` | 角色拍拍肚子，满足 | Character patting belly, satisfied |
| `focusDone` | 角色伸爪子比个赞/撒花庆祝 | Character making thumbs-up with confetti |
| `sad` | 角色低头，小爪子抓在一起，委屈的样子 | Character looking down, paws together, sad expression |
| `sitting` | 角色趴下坐着，闭眼休息 | Character sitting down, eyes closed, resting |

---

## 小锯鳄（Totodile / id: `totodile`）

目录：`pet_assets/小锯鳄/`

> 致敬 IP。**绝不能 1:1 复刻官方形象**。所有 prompt 里强制加 `original character interpretation, no Pokemon branding, no Pokemon logo, no Pokemon text`。

### 参考图

**中文**：
```
原创可爱卡通小鳄鱼角色设计。圆滚滚身体，大大的友善眼睛，柔和的
青蓝色皮肤配奶白色肚皮，短短的小手小脚，圆圆的大尾巴，透明背景，
2D 贴纸风格，干净线条，kawaii 可爱风，没有宝可梦 logo，没有宝可梦
文字，没有宝可梦品牌，原创角色诠释
```

**English**：
```
Original cute chibi crocodile character design, round chubby body,
big friendly eyes, soft teal-blue skin with cream belly, short
stubby limbs, big round tail, transparent background, 2D sprite
art, kawaii sticker style, no Pokemon branding, no Pokemon logo,
no Pokemon text, original character interpretation
```

### 状态视频

| 状态 | 中文 | English |
|------|------|---------|
| `idle` | 鳄鱼角色站在原地，轻轻呼吸，嘴巴偶尔开合，眨眼睛，循环 | Crocodile character standing in place, breathing softly, mouth occasionally opening and closing, blinking, looped |
| `happy` | 鳄鱼角色开心地跳，两只小手挥着，嘴巴张得大大的笑，循环跳 | Crocodile character jumping excitedly, both arms waving, mouth open in big smile, looping bounce |
| `walking` | 鳄鱼角色原地踏步走路，摇摇晃晃地走，嘴巴合着，循环 | Crocodile character walking in place, waddling side to side, mouth closed, looped |
| `petted` | 鳄鱼角色被抚摸，闭着眼睛满足地蹭，嘴巴微张着，循环 | Crocodile character being petted, eyes closed contentedly, leaning into the petting hand, mouth slightly open, looped |
| `sleeping` | 鳄鱼角色抱着自己的大尾巴蜷着睡，均匀呼吸，循环 | Crocodile character curled up hugging its own big tail, sleeping peacefully, gentle breathing, looped |
| `breakPrompt` | 鳄鱼角色歪头看着镜头，用下巴点一下屏幕，循环 | Crocodile character tilting head at viewer, tapping forward with its chin, looped |
| `breakRunning` | 鳄鱼角色面朝右奔跑，圆尾巴甩起来，循环 | Crocodile character running fast facing right, round tail wagging, looped |
| `drinking` | 鳄鱼角色捧着一杯水大口喝，喝完嘴巴还在滴水 | Crocodile character chugging a cup of water, water dripping from mouth |
| `hydrationPrompt` | 鳄鱼角色张大嘴巴做口渴状 | Crocodile character opening mouth wide in thirsty gesture |
| `focusGuard` | 鳄鱼角色瞪大眼睛面朝前，嘴巴微张 | Crocodile character staring forward with wide eyes, mouth slightly open |
| `focusAlert` | 鳄鱼角色张大嘴巴露牙齿，皱眉 | Crocodile character baring teeth and frowning |
| `breakDone` | 鳄鱼角色开心地拍手 / 摇尾巴 | Crocodile character clapping happily, tail wagging |
| `hydrationDone` | 鳄鱼角色拍拍肚子打个饱嗝 | Crocodile character patting belly and burping |
| `focusDone` | 鳄鱼角色挥小爪子比赞 | Crocodile character making small thumbs-up |
| `sad` | 鳄鱼角色低头委屈地流眼泪 | Crocodile character looking down sadly with tears |
| `sitting` | 鳄鱼角色趴下抱着自己的尾巴坐着 | Crocodile character sitting hugging own tail |

---

## 给新角色加 prompt 的模板

如果之后要加**第三只宠物**（比如小狐狸、小熊猫），按这个模板复制：

```markdown
## <角色中文名>（<English Name> / id: `<id>`）

目录：`pet_assets/<角色文件夹名>/`

> 风险提示：（"原创 IP" / "致敬 IP，强制不 1:1 复刻" 等）

### 参考图

**中文**：
<...>

**English**：
<...>

### 状态视频

| 状态 | 中文 | English |
|------|------|---------|
| `idle` | <...> | <...> |
| `happy` | <...> | <...> |
... (按状态表补全)
```

加完后只需要：
1. 在 `src/shared/petAppearances.ts` 加新 id
2. 在 `pet_assets/<角色>/<state>/` 丢 `default.gif`
3. 跑 `pnpm typecheck && pnpm test`

---

## 快速复制的极简流程

如果你只想要"能跑就行"，按这个最小流程做（**1 小时内完成一只新角色**）：

1. **去可灵 AI 图像** → 复制参考图 prompt → 生成 → 选 1 张
2. **去可灵 AI 视频 / 图生视频** → 上传参考图 + 复制 idle / happy 两条 prompt → 5 秒视频
3. **下载 MP4** → 跑：
   ```bash
   ./scripts/mp4-to-pawpal-gif.sh \
     ~/Downloads/kling-角色-idle.mp4 \
     pet_assets/角色名/idle/default.gif --transparent
   ```
4. **重启 app** → 看到角色了
5. 不满意就重做（**单状态 5 分钟可迭代**）

完成 6 个状态后再补剩下的 10 个。fallback 链保证你任何时候停手都不会破图。

---

## 已知坑 & 应对

| 坑 | 应对 |
|----|------|
| 角色一致性差（每次生成都变样） | 始终上传**同一张参考图**作为首帧；不要用纯文生视频 |
| 背景不透明 | prompt 强调 `transparent background`；脚本里加 `--transparent` 去白底 |
| 动作太夸张 | prompt 写得越具体反而越不稳定。**少形容词，多动词** |
| 循环不流畅 | 用 **5 秒、12-18 fps**；开头和结尾帧差异不能大 |
| LottieFiles 现成动画不匹配 | 退而求其次：用 1-2 张状态（`idle` + `happy`）就够用 |
| Midjourney 不支持视频 | 参考图用 MJ，视频用可灵 / Pika |
| 可灵生成太抽象 | 加关键词 `chibi, sticker, kawaii, flat colors, 2D` 让风格更明确 |
| AI 在角色上加文字 / logo | prompt 加 `no text, no letters, no words, no watermark` |
