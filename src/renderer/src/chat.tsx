import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import type { ChatMessage } from "../../shared/types";

interface DisplayMessage {
  role: "user" | "pet";
  content: string;
  pending?: boolean;
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

const LABELS = {
  "zh-CN": {
    title: "和宠物聊天",
    placeholder: "说点什么…（Enter 发送，Shift+Enter 换行）",
    send: "发送",
    sending: "…",
    empty: INITIAL_GREETINGS["zh-CN"],
    fallbackNotice: "AI 未启用，本地短句回复中。",
    failed: "出错了，宠物卡壳了~"
  },
  en: {
    title: "Chat with your pet",
    placeholder: "Say something… (Enter to send, Shift+Enter for newline)",
    send: "Send",
    sending: "…",
    empty: INITIAL_GREETINGS.en,
    fallbackNotice: "AI not configured; local pool replies.",
    failed: "Oops, the pet choked~"
  }
};

function detectLanguage(): "zh-CN" | "en" {
  const code = (typeof navigator !== "undefined" && navigator.language ? navigator.language : "en").toLowerCase();
  return code.startsWith("zh") ? "zh-CN" : "en";
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function ChatApp(): JSX.Element {
  const language = detectLanguage();
  const labels = LABELS[language];
  const [messages, setMessages] = useState<DisplayMessage[]>([
    { role: "pet", content: labels.empty }
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text || sending) return;
    const userMsg: DisplayMessage = { role: "user", content: text };
    const pending: DisplayMessage = { role: "pet", content: labels.sending, pending: true };
    setMessages((prev) => [...prev, userMsg, pending]);
    setDraft("");
    setSending(true);

    const history: ChatMessage[] = messages
      .filter((m) => !m.pending)
      .concat(userMsg)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

    try {
      const reply = await window.pawpal.petChat(history, language);
      setMessages((prev) =>
        prev.map((m, idx) =>
          idx === prev.length - 1 && m.pending ? { role: "pet", content: reply } : m
        )
      );
    } catch {
      const fallback = pick(POOL_REPLIES[language]);
      setMessages((prev) =>
        prev.map((m, idx) =>
          idx === prev.length - 1 && m.pending ? { role: "pet", content: fallback } : m
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

  return (
    <div className="chat-app">
      <header className="chat-app__header">
        <h1>{labels.title}</h1>
        <span className="chat-app__notice">{labels.fallbackNotice}</span>
      </header>
      <div className="chat-app__list" ref={listRef}>
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`chat-msg chat-msg--${m.role} ${m.pending ? "is-pending" : ""}`}
          >
            <div className="chat-msg__bubble">{m.content}</div>
          </div>
        ))}
      </div>
      <div className="chat-app__input">
        <textarea
          rows={2}
          value={draft}
          placeholder={labels.placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          disabled={sending || draft.trim().length === 0}
          onClick={() => void send()}
        >
          {labels.send}
        </button>
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<ChatApp />);
}