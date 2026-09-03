import { net } from "electron";
import type { AiProvider, ChatMessage } from "../shared/types";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const OLLAMA_DEFAULT_URL = "http://localhost:11434/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 15_000;

type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

async function fetchJson(
  url: string,
  options: FetchOptions,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
  return value === "none" || value === "deepseek" || value === "ollama";
}

function normalizeBaseUrl(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return fallback;
  // If the user pasted a bare host, append the OpenAI-compat path.
  if (!trimmed.endsWith("/chat/completions")) {
    return trimmed.endsWith("/v1") ? `${trimmed}/chat/completions` : `${trimmed}/v1/chat/completions`;
  }
  return trimmed;
}

interface Provider {
  chat(messages: ChatMessage[]): Promise<string>;
  test(): Promise<{ ok: boolean; message: string }>;
}

function openAiStyleError(name: string, json: unknown, status: number): string {
  const errPayload = json as { error?: { message?: string } } | null;
  return errPayload?.error?.message ?? `${name}: HTTP ${status}`;
}

function extractContent(name: string, json: unknown): string {
  const payload = json as { choices?: { message?: { content?: string } }[] };
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error(`${name}: empty response`);
  return content.trim();
}

class DeepSeekProvider implements Provider {
  constructor(private readonly apiKey: string) {}

  async chat(messages: ChatMessage[]): Promise<string> {
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
    if (!result.ok) throw new Error(openAiStyleError("DeepSeek", result.json, result.status));
    return extractContent("DeepSeek", result.json);
  }

  async test(): Promise<{ ok: boolean; message: string }> {
    try {
      const reply = await this.chat([
        { role: "system", content: "Reply with the single word 'pong'." },
        { role: "user", content: "ping" }
      ]);
      return { ok: true, message: `连接成功（响应：${reply.slice(0, 40).replace(/\s+/g, " ").trim()}）` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }
}

class OllamaProvider implements Provider {
  // apiKey doubles as "base URL" — empty means localhost default
  constructor(private readonly baseUrlOrKey: string, private readonly model: string) {}

  private get url(): string {
    return normalizeBaseUrl(this.baseUrlOrKey, OLLAMA_DEFAULT_URL);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const result = await fetchJson(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model || "llama3.2",
        messages,
        max_tokens: 200,
        temperature: 0.8,
        stream: false
      })
    });
    if (!result.ok) throw new Error(openAiStyleError("Ollama", result.json, result.status));
    return extractContent("Ollama", result.json);
  }

  async test(): Promise<{ ok: boolean; message: string }> {
    try {
      const reply = await this.chat([
        { role: "system", content: "Reply with the single word 'pong'." },
        { role: "user", content: "ping" }
      ]);
      return { ok: true, message: `本地连接成功（响应：${reply.slice(0, 40).replace(/\s+/g, " ").trim()}）` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("ECONNREFUSED") || msg.includes("aborted")) {
        return {
          ok: false,
          message: `Ollama 未运行（${this.url}）。请先启动 ollama serve`
        };
      }
      return { ok: false, message: msg };
    }
  }
}

export class AiClient {
  private readonly provider: Provider | null;

  constructor(provider: AiProvider, apiKey: string, model = "") {
    if (provider === "deepseek" && apiKey.trim().length > 0) {
      this.provider = new DeepSeekProvider(apiKey);
    } else if (provider === "ollama") {
      this.provider = new OllamaProvider(apiKey, model);
    } else {
      this.provider = null;
    }
  }

  isConfigured(): boolean {
    return this.provider !== null;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.provider) throw new Error("AI not configured");
    return this.provider.chat(messages);
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.provider) {
      return { ok: false, message: "未配置 AI 提供方" };
    }
    return this.provider.test();
  }
}

// Backwards-compat: accept a settings-like object that may have a
// dedicated model field. Currently the Settings type only has
// aiProvider + aiApiKey, so model defaults to empty and Ollama falls
// back to llama3.2.
export function createAiClient(
  provider: unknown,
  apiKey: unknown,
  model: unknown = ""
): AiClient {
  const normalizedProvider: AiProvider = isAiProvider(provider) ? provider : "none";
  const normalizedKey = typeof apiKey === "string" ? apiKey : "";
  const normalizedModel = typeof model === "string" ? model : "";
  return new AiClient(normalizedProvider, normalizedKey, normalizedModel);
}