import type { ChatMessage, DiaryEntry, PetDiary } from "../shared/types";
import type { AiClient } from "./aiClient";

const MAX_ENTRIES = 30;
const FALLBACK_LOCALES = {
  "zh-CN": [
    "今天主人和往常一样在屏幕前忙来忙去，我趴在旁边假装睡觉其实在偷偷观察。今天天气看起来不错，希望主人明天能带我出去走走~",
    "今天有点无聊，我自己在桌面上溜达了好几圈。主人好像很专心，我就没打扰，自己玩了会儿尾巴~",
    "今天我观察到一个有趣的事情——主人喝水居然还记得！我超级开心，希望明天也能记得~",
    "今天主人逗我玩了，我被撸得毛都乱了。但是好舒服~希望主人每天都这么温柔！",
    "今天我决定假装是个小恐龙（其实我就是），在桌面上到处溜达。主人看到我的时候笑了，我也笑了~"
  ],
  en: [
    "Today my human sat at the screen as usual, and I pretended to nap while secretly watching everything. The weather looked nice — I hope they take me out tomorrow~",
    "A bit bored today. I wandered across the desktop a few times. They seemed focused, so I kept to myself and played with my tail~",
    "Something fun happened today — my human remembered to drink water! I'm so happy. Hope it happens again tomorrow~",
    "Today my human played with me and my fur got all messed up. So comfy though~ I hope they're this gentle every day!",
    "I decided today to pretend I was a tiny dragon (I mean, I am one). Wandered the whole desktop. They smiled when they saw me. I smiled back~"
  ]
};

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function trim(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return collapsed.slice(0, max - 1).trimEnd() + "…";
}

async function generateFallback(language: "zh-CN" | "en", statsSummary: string): Promise<string> {
  const pool = FALLBACK_LOCALES[language];
  return `${pick(pool)} (${statsSummary})`;
}

export async function composeDiaryEntry(
  client: AiClient,
  language: "zh-CN" | "en",
  statsSummary: string,
  mood: string,
  appearanceName: string
): Promise<DiaryEntry> {
  const date = new Date();
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  let body: string;
  let source: "ai" | "fallback" = "fallback";

  if (client.isConfigured()) {
    try {
      const langHint = language === "zh-CN" ? "Chinese (zh-CN)" : "English";
      const messages: ChatMessage[] = [
        {
          role: "system",
          content:
              `You are a tiny desktop pet named "${appearanceName}" writing a short diary entry from your own point of view. ` +
              `Today's owner mood was ${mood}. Write in ${langHint}, in first person, in 2-4 short sentences (no more than 200 characters). ` +
              `The tone should be cozy, a little playful, slightly self-deprecating. Do not start with quotes or markers like "*". ` +
              `Stay in character as a tiny companion, not as an AI assistant.`
        },
        {
          role: "user",
          content: `今日小数据：${statsSummary}。请写今天的日记。`
        }
      ];
      body = trim(await client.chat(messages), 200);
      source = "ai";
    } catch {
      body = await generateFallback(language, statsSummary);
    }
  } else {
    body = await generateFallback(language, statsSummary);
  }

  return {
    date: dateKey,
    body,
    generatedAt: Date.now(),
    source
  };
}

export function appendDiary(diary: PetDiary, entry: DiaryEntry): PetDiary {
  const filtered = diary.entries.filter((e) => e.date !== entry.date);
  const next = [entry, ...filtered].slice(0, MAX_ENTRIES);
  return { entries: next };
}

export function emptyDiary(): PetDiary {
  return { entries: [] };
}