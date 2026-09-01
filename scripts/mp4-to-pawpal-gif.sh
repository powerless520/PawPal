#!/usr/bin/env bash
# scripts/mp4-to-pawpal-gif.sh
#
# 把 AI 视频工具（可灵 / Pika / Runway 等）导出的 MP4 转换成 PawPal 就绪的 GIF。
#
# Usage:
#   ./scripts/mp4-to-pawpal-gif.sh <input.mp4> <output.gif> [options]
#
# Options:
#   --transparent      去掉白底（需要 ImageMagick；PawPal 宠物窗口透明背景推荐开启）
#   --width <n>        输出宽度，默认 256（高度等比缩放）
#   --fps <n>          帧率上限，默认 18
#   --lossy <n>        gifsicle lossy 强度，默认 80（数字越大压缩越狠）
#   --colors <n>       GIF 调色板颜色数，默认 128
#   --max-kb <n>       目标文件大小上限 KB，默认 200（超出会警告）
#
# 依赖：
#   - ffmpeg      (brew install ffmpeg)
#   - gifsicle    (brew install gifsicle)
#   --transparent 需要额外：
#   - ImageMagick (brew install imagemagick)
#
# 例子：
#   ./scripts/mp4-to-pawpal-gif.sh ~/Downloads/kling-idle.mp4 \
#       pet_assets/小恐龙/idle/站.gif --transparent
#
#   批量（用 find + xargs）：
#     for f in ~/Downloads/kling-*.mp4; do
#       ./scripts/mp4-to-pawpal-gif.sh "$f" \
#         "pet_assets/小恐龙/$(basename ${f%.mp4}).gif" --transparent
#     done

set -euo pipefail

# ---------- 参数解析 ----------

if [[ $# -lt 2 ]]; then
  sed -n '2,33p' "$0"
  exit 1
fi

INPUT="$1"
OUTPUT="$2"
shift 2

TRANSPARENT=false
WIDTH=256
FPS=18
LOSSY=80
COLORS=128
MAX_KB=200

while [[ $# -gt 0 ]]; do
  case "$1" in
    --transparent) TRANSPARENT=true; shift ;;
    --width)       WIDTH="$2"; shift 2 ;;
    --fps)         FPS="$2"; shift 2 ;;
    --lossy)       LOSSY="$2"; shift 2 ;;
    --colors)      COLORS="$2"; shift 2 ;;
    --max-kb)      MAX_KB="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,33p' "$0"
      exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1 ;;
  esac
done

# ---------- 校验 ----------

if [[ ! -f "$INPUT" ]]; then
  echo "❌ 输入文件不存在: $INPUT" >&2
  exit 1
fi

command -v ffmpeg   >/dev/null || { echo "❌ 缺少 ffmpeg。安装：brew install ffmpeg"; exit 1; }
command -v gifsicle >/dev/null || { echo "❌ 缺少 gifsicle。安装：brew install gifsicle"; exit 1; }

if [[ "$TRANSPARENT" == true ]]; then
  command -v convert >/dev/null || { echo "❌ --transparent 需要 ImageMagick。安装：brew install imagemagick"; exit 1; }
fi

# 确保输出目录存在
mkdir -p "$(dirname "$OUTPUT")"

# ---------- 处理 ----------

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

echo "🎬 输入：   $INPUT"
echo "📐 参数：   ${WIDTH}px / ${FPS}fps / ${COLORS} colors / lossy ${LOSSY}"
echo "🌫  透明：   $([[ $TRANSPARENT == true ]] && echo 'on' || echo 'off')"

# 1. 拆帧
echo "→ 拆帧..."
ffmpeg -i "$INPUT" \
  -vf "scale=${WIDTH}:-2:flags=lanczos,fps=${FPS}" \
  -y "$WORKDIR/frame_%04d.png" \
  -loglevel error

FRAME_COUNT=$(ls "$WORKDIR"/frame_*.png | wc -l | tr -d ' ')
echo "  拆出 $FRAME_COUNT 帧"

# 2. 去白底（可选）
if [[ "$TRANSPARENT" == true ]]; then
  echo "→ 去白底（容差 5%）..."
  for f in "$WORKDIR"/frame_*.png; do
    convert "$f" -fuzz 5% -transparent white "$f"
  done
fi

# 3. 生成调色板
echo "→ 生成调色板..."
ffmpeg -i "$WORKDIR/frame_%04d.png" \
  -vf "palettegen=stats_mode=diff" \
  -y "$WORKDIR/palette.png" \
  -loglevel error

# 4. 编码 GIF
echo "→ 编码 GIF..."
if [[ "$TRANSPARENT" == true ]]; then
  # 透明模式：ImageMagick 保留 1-bit alpha
  convert -delay "$(echo "100/${FPS}" | bc -l)" \
    -loop 0 -dispose Background \
    "$WORKDIR"/frame_*.png \
    "$WORKDIR/raw.gif"
else
  # 不透明模式：ffmpeg 双 pass + palette 质量更好
  ffmpeg -i "$WORKDIR/frame_%04d.png" -i "$WORKDIR/palette.png" \
    -lavfi "paletteuse=dither=bayer:bayer_scale=5" \
    -y "$WORKDIR/raw.gif" \
    -loglevel error
fi

# 5. gifsicle 压缩
echo "→ gifsicle 压缩..."
gifsicle -O3 --lossy="$LOSSY" --colors="$COLORS" \
  "$WORKDIR/raw.gif" -o "$OUTPUT"

# 6. 报告
SIZE_BYTES=$(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT")
SIZE_KB=$(awk "BEGIN {printf \"%.1f\", $SIZE_BYTES/1024}")
MAX_BYTES=$((MAX_KB * 1024))

echo ""
echo "✅ 输出：   $OUTPUT"
echo "📦 大小：   ${SIZE_KB} KB（${FRAME_COUNT} 帧 @ ${FPS}fps）"

if [[ $SIZE_BYTES -gt $MAX_BYTES ]]; then
  OVER_KB=$(awk "BEGIN {printf \"%.1f\", ($SIZE_BYTES - $MAX_BYTES)/1024}")
  echo "⚠️  超出 ${MAX_KB}KB 目标 ${OVER_KB}KB。可尝试："
  echo "   --lossy 120（更狠的有损压缩）"
  echo "   --fps 14（降帧率）"
  echo "   --colors 64（颜色更少）"
  exit 0
fi