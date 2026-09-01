import { net } from "electron";
import type { AiProvider, ChatMessage } from "../shared/types";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 15_000;

type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

async function fetchJson(url: string, options: FetchOptions): Promise<{ ok: boolean; status: number; json: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await net.fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal
    });
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    return { ok: response.ok, status: response.status, json };
  } finally {
    clearTimeout(timeout);
  }
}

function isAiProvider(value: unknown): value is AiProvider {
  return value === "none" || value === "deepseek";
}

export class AiClient {
  constructor(private readonly provider: AiProvider, private readonly apiKey: string) {}

  isConfigured(): boolean {
    return this.provider !== "none" && this.apiKey.trim().length > 0;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("AI not configured");
    }
    if (this.provider === "deepseek") {
      return this.callDeepSeek(messages);
    }
    throw new Error(`Unsupported AI provider: ${this.provider}`);
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { ok: false, message: "未配置 API Key" };
    }
    try {
      const reply = await this.chat([
        { role: "system", content: "You are a connection-test responder. Reply with the single word 'pong'." },
        { role: "user", content: "ping" }
      ]);
      return { ok: true, message: `连接成功（响应：${reply.slice(0, 40).replace(/\s+/g, " ").trim()}）` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private async callDeepSeek(messages: ChatMessage[]): Promise<string> {
    const result = await fetchJson(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        max_tokens: 200,
        temperature: 0.8,
        stream: false
      })
    });

    if (!result.ok) {
      const errPayload = result.json as { error?: { message?: string } } | null;
      const apiMsg = errPayload?.error?.message ?? `HTTP ${result.status}`;
      throw new Error(`DeepSeek: ${apiMsg}`);
    }

    const payload = result.json as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("DeepSeek: empty response");
    }
    return content.trim();
  }
}

export function createAiClient(provider: unknown, apiKey: unknown): AiClient {
  const normalizedProvider: AiProvider = isAiProvider(provider) ? provider : "none";
  const normalizedKey = typeof apiKey === "string" ? apiKey : "";
  return new AiClient(normalizedProvider, normalizedKey);
}