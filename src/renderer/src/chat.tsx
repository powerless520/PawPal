import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import type { ChatMessage } from "../../shared/types";

interface DisplayMessage {
  role: "user" | "pet";
  content: string;
  pending?: boolean;
  createdAt: number;
}

interface QuickReply {
  key: string;
  label: Record<"zh-CN" | "en", string>;
  draft?: Record<"zh-CN" | "en", string>;
  send?: Record<"zh-CN" | "en", string>;
}

const INITIAL_GREETINGS: Record<string, string> = {
  "zh-CN": "嗨~ 想聊点什么吗？",
  en: "Hi~ what would you like to chat about?"
};

const POOL_REPLIES: Record<string, string[]> = {
  "zh-CN": [
    "嗯嗯，我在听~",
    "哈哈，是这样啊~",
    "我也这么觉得！",
    "今天感觉还不错~",
    "主人说的有道理~",
    "再聊聊呗~"
  ],
  en: [
    "Hmm, I'm listening~",
    "Haha, that sounds about right~",
    "I think so too!",
    "Today feels pretty good~",
    "You have a point~",
    "Tell me more~"
  ]
};

const QUICK_REPLIES: QuickReply[] = [
  {
    key: "hello",
    label: { "zh-CN": "打个招呼 👋", en: "Say hi 👋" },
    send: { "zh-CN": "在干嘛呀？", en: "What are you up to?" }
  },
  {
    key: "praise",
    label: { "zh-CN": "夸夸我 ✨", en: "Praise me ✨" },
    send: { "zh-CN": "我今天状态不太好，能夸夸我吗？", en: "I'm feeling down, can you cheer me up?" }
  },
  {
    key: "tired",
    label: { "zh-CN": "有点累 🥱", en: "Feeling tired 🥱" },
    send: { "zh-CN": "我好累啊…", en: "I'm so tired today…" }
  },
  {
    key: "sleep",
    label: { "zh-CN": "晚安 🌙", en: "Goodnight 🌙" },
    send: { "zh-CN": "我要睡觉啦，晚安~", en: "I'm heading to bed, goodnight~" }
  },
  {
    key: "bored",
    label: { "zh-CN": "陪我玩 🎮", en: "Play with me 🎮" },
    send: { "zh-CN": "好无聊呀，陪我玩会儿？", en: "I'm bored, hang out with me?" }
  },
  {
    key: "joke",
    label: { "zh-CN": "讲个笑话 😆", en: "Tell a joke 😆" },
    send: { "zh-CN": "给我讲个笑话呗~", en: "Tell me a silly joke~" }
  }
];

const LABELS = {
  "zh-CN": {
    title: "和宠物聊天",
    placeholder: "说点什么…（Enter 发送，Shift+Enter 换行）",
    send: "发送",
    sending: "…",
    empty: INITIAL_GREETINGS["zh-CN"],
    fallbackNotice: "本地回复模式 · 随时跟我聊天",
    aiNotice: "AI 在线 · 更聪明的宠物",
    failed: "出错了，宠物卡壳了~",
    petLabel: "宠物",
    userLabel: "主人",
    quickReplyTitle: "快速回复",
    today: "今天",
    yesterday: "昨天"
  },
  en: {
    title: "Chat with your pet",
    placeholder: "Say something… (Enter to send, Shift+Enter for newline)",
    send: "Send",
    sending: "…",
    empty: INITIAL_GREETINGS.en,
    fallbackNotice: "Local mode · always here for you",
    aiNotice: "AI online · smarter pet",
    failed: "Oops, the pet choked~",
    petLabel: "Pet",
    userLabel: "You",
    quickReplyTitle: "Quick replies",
    today: "Today",
    yesterday: "Yesterday"
  }
};

function detectLanguage(): "zh-CN" | "en" {
  const code = (typeof navigator !== "undefined" && navigator.language ? navigator.language : "en").toLowerCase();
  return code.startsWith("zh") ? "zh-CN" : "en";
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function initialsForRole(role: "user" | "pet", language: "zh-CN" | "en"): string {
  if (role === "pet") {
    const glyphs: Record<string, string> = { "zh-CN": "宠", en: "P" };
    return glyphs[language];
  }
  const glyphs: Record<string, string> = { "zh-CN": "主", en: "Y" };
  return glyphs[language];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDayLabel(ts: number, language: "zh-CN" | "en"): string | null {
  const labels = LABELS[language];
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return labels.today;
  if (diffDays === 1) return labels.yesterday;
  if (diffDays < 7) return diffDays.toString() + (language === "zh-CN" ? "天前" : "d ago");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function groupModeFor(
  idx: number,
  arr: DisplayMessage[]
): "first" | "middle" | "last" | "single" {
  if (arr.length === 0) return "single";
  const m = arr[idx];
  const prev = idx > 0 ? arr[idx - 1] : undefined;
  const next = idx < arr.length - 1 ? arr[idx + 1] : undefined;
  const samePrev = !!prev && prev.role === m.role && !prev.pending && !m.pending;
  const sameNext = !!next && next.role === m.role && !next.pending && !m.pending;
  if (!samePrev && !sameNext) return "single";
  if (samePrev && sameNext) return "middle";
  if (!samePrev && sameNext) return "first";
  return "last";
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function ChatApp(): JSX.Element {
  const language = detectLanguage();
  const labels = LABELS[language];
  const [messages, setMessages] = useState<DisplayMessage[]>([
    { role: "pet", content: labels.empty, createdAt: Date.now() }
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const aiMode = useMemo<boolean>(() => typeof window.pawpal?.petChat === "function", []);

  function autosizeTextarea(): void {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxPx = 140;
    ta.style.height = Math.min(ta.scrollHeight, maxPx) + "px";
  }

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    autosizeTextarea();
  }, [draft]);

  async function send(customText?: string): Promise<void> {
    const text = (customText !== undefined ? customText : draft).trim();
    if (!text || sending) return;
    const userMsg: DisplayMessage = { role: "user", content: text, createdAt: Date.now() };
    const pending: DisplayMessage = {
      role: "pet",
      content: labels.sending,
      pending: true,
      createdAt: Date.now()
    };
    setMessages((prev) => [...prev, userMsg, pending]);
    setDraft("");
    setSending(true);
    setShowQuickReplies(false);

    const history: ChatMessage[] = messages
      .filter((m) => !m.pending)
      .concat(userMsg)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

    try {
      const reply = await window.pawpal.petChat(history, language);
      setMessages((prev) =>
        prev.map((m, idx) =>
          idx === prev.length - 1 && m.pending
            ? { role: "pet", content: reply, createdAt: Date.now() }
            : m
        )
      );
    } catch {
      const fallback = pick(POOL_REPLIES[language]);
      setMessages((prev) =>
        prev.map((m, idx) =>
          idx === prev.length - 1 && m.pending
            ? { role: "pet", content: fallback, createdAt: Date.now() }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  function sendQuickReply(qr: QuickReply): void {
    const text = qr.send?.[language] ?? qr.draft?.[language] ?? "";
    if (qr.send) {
      void send(text);
    } else if (qr.draft) {
      setDraft(text);
    }
  }

  return (
    <div className="chat-app">
      <header className="chat-app__header">
        <div className="chat-app__title-row">
          <div className="chat-app__avatar chat-app__avatar--pet chat-app__avatar--header" aria-hidden>
            <span>{initialsForRole("pet", language)}</span>
          </div>
          <div className="chat-app__title-text">
            <h1>{labels.title}</h1>
            <span className="chat-app__status">
              <span
                className={`chat-app__status-dot ${aiMode ? "is-online" : ""}`}
                aria-hidden
              />
              <span className="chat-app__notice">
                {aiMode ? labels.aiNotice : labels.fallbackNotice}
              </span>
            </span>
          </div>
        </div>
        <div className="chat-app__gutter" aria-hidden />
      </header>

      <div className="chat-app__list" ref={listRef}>
        <div className="chat-app__list-top-fade" aria-hidden />
        {messages.map((m, idx) => {
          const prev = idx > 0 ? messages[idx - 1] : undefined;
          const divider =
            !prev || !sameDay(prev.createdAt, m.createdAt)
              ? formatDayLabel(m.createdAt, language)
              : null;
          const group = groupModeFor(idx, messages);
          const showAvatar = m.role === "pet" && (group === "last" || group === "single");
          const showUserAvatar = m.role === "user" && (group === "last" || group === "single");
          const showTime = !m.pending && (group === "last" || group === "single");
          return (
            <div key={idx}>
              {divider && (
                <div className="chat-divider" role="separator">
                  <span>{divider}</span>
                </div>
              )}
              <div
                className={`chat-msg chat-msg--${m.role} chat-msg--${group} ${
                  m.pending ? "is-pending" : ""
                } chat-msg--enter`}
              >
                {m.role === "pet" && (
                  <div
                    className={`chat-msg__avatar chat-msg__avatar--pet ${
                      showAvatar ? "" : "is-hidden"
                    }`}
                    title={labels.petLabel}
                    aria-hidden
                  >
                    <span>{initialsForRole("pet", language)}</span>
                  </div>
                )}
                <div className="chat-msg__column">
                  <div className="chat-msg__bubble">
                    {m.pending ? (
                      <span className="chat-typing" aria-hidden>
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      m.content
                    )}
                  </div>
                  {showTime && (
                    <span className={`chat-msg__time chat-msg__time--${m.role}`}>
                      {formatTime(m.createdAt)}
                    </span>
                  )}
                </div>
                {m.role === "user" && (
                  <div
                    className={`chat-msg__avatar chat-msg__avatar--user ${
                      showUserAvatar ? "" : "is-hidden"
                    }`}
                    title={labels.userLabel}
                    aria-hidden
                  >
                    <span>{initialsForRole("user", language)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="chat-app__list-bottom-fade" aria-hidden />
      </div>

      {showQuickReplies && (
        <div className="chat-quick">
          <div className="chat-quick__title">{labels.quickReplyTitle}</div>
          <div className="chat-quick__list">
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr.key}
                type="button"
                className="chat-quick__chip"
                onClick={() => sendQuickReply(qr)}
              >
                {qr.label[language]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat-app__input">
        <div className="chat-app__input-wrap">
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            placeholder={labels.placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <button
          className="chat-app__send"
          type="button"
          disabled={sending || draft.trim().length === 0}
          onClick={() => void send()}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
            <path
              fill="currentColor"
              d="M2.94 10.88a.6.6 0 0 1-.01-1.07L15.5 2.6a.6.6 0 0 1 .84.78L14.1 9.4H8.6a.6.6 0 0 0 0 1.2h5.5l-2.25 6.02a.6.6 0 0 1-.84.78l-12.57-7.52Z"
            />
          </svg>
          <span>{labels.send}</span>
        </button>
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<ChatApp />);
}
