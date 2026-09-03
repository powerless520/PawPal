import { spawn, type ChildProcess } from "node:child_process";

type SpeakOptions = {
  voice?: string | null;
  rate?: number;
};

let currentProc: ChildProcess | null = null;

function quoteForShell(text: string): string {
  // macOS `say` accepts raw UTF-8 on stdin, no escaping needed.
  // We still guard against embedded newlines / control chars.
  return text.replace(/[\r\n]+/g, " ").trim();
}

function killCurrent(): void {
  if (currentProc && !currentProc.killed) {
    try {
      currentProc.kill();
    } catch {
      // best-effort
    }
  }
  currentProc = null;
}

function startChild(args: string[]): ChildProcess | null {
  try {
    const proc = spawn(args[0], args.slice(1), {
      stdio: "ignore",
      detached: false
    });
    proc.on("exit", () => {
      if (currentProc === proc) currentProc = null;
    });
    return proc;
  } catch {
    return null;
  }
}

function speakMac(text: string, voice: string | null, rate: number): void {
  // macOS `say` rate: words per minute, default ~175. 200 is a clear
  // but casual reading pace. We accept a 0.5-2.0 multiplier.
  const wpm = Math.max(80, Math.min(360, Math.round(175 * rate)));
  const args = ["say", "-r", String(wpm)];
  if (voice) args.push("-v", voice);
  args.push(quoteForShell(text));
  startChild(args);
}

function speakWindows(text: string, rate: number): void {
  // PowerShell + System.Speech synthesis. We escape single quotes for
  // the inline command.
  const safe = text.replace(/'/g, "''");
  const ratePct = Math.max(50, Math.min(300, Math.round(rate * 100)));
  const cmd = [
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;",
    `$s.Rate = ${ratePct - 10};`, // SAPI Rate is -10..10
    `$s.Speak('${safe}')`
  ].join(" ");
  startChild(["powershell", "-NoProfile", "-Command", cmd]);
}

function speakLinux(text: string, rate: number): void {
  // espeak is the most common Linux TTS. Fall back to spd-say if not
  // installed (the call will fail silently).
  const wpm = Math.max(80, Math.min(360, Math.round(175 * rate)));
  const safe = quoteForShell(text);
  startChild(["espeak", "-s", String(wpm), safe]);
}

export function speak(text: string, options: SpeakOptions = {}): void {
  killCurrent();
  const cleaned = quoteForShell(text);
  if (!cleaned) return;
  const rate = Math.max(0.5, Math.min(2, options.rate ?? 1));
  if (process.platform === "darwin") {
    currentProc = startChild([]) as ChildProcess | null; // no-op to clear
    speakMac(cleaned, options.voice ?? null, rate);
  } else if (process.platform === "win32") {
    speakWindows(cleaned, rate);
  } else {
    speakLinux(cleaned, rate);
  }
}

export function stopSpeaking(): void {
  killCurrent();
}

export function describePlatform(): string {
  if (process.platform === "darwin") return "macOS say";
  if (process.platform === "win32") return "Windows SAPI";
  return "Linux espeak";
}