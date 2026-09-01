import { shell } from "electron";
import { spawn } from "node:child_process";
import { join } from "node:path";

const SOUNDS_BASE = "pet_assets/sounds";

export type SoundName =
  | "click"
  | "petted"
  | "happy"
  | "warning"
  | "idleChatter";

const VALID: ReadonlySet<SoundName> = new Set([
  "click",
  "petted",
  "happy",
  "warning",
  "idleChatter"
]);

export function isSoundName(value: unknown): value is SoundName {
  return typeof value === "string" && VALID.has(value as SoundName);
}

function relativeAssetPath(name: SoundName): string {
  const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
  const base = isDev ? process.cwd() : process.resourcesPath ?? process.cwd();
  return join(base, SOUNDS_BASE, `${name}.wav`);
}

function playViaAfplay(path: string): void {
  // macOS afplay is bundled with the OS and supports WAV natively
  if (process.platform !== "darwin") return;
  try {
    const proc = spawn("afplay", [path], { detached: true, stdio: "ignore" });
    proc.unref();
  } catch {
    // best-effort
  }
}

function playViaShell(path: string): void {
  // Fallback: open the file with the OS default handler. Plays once.
  try {
    void shell.openPath(path);
  } catch {
    // ignore
  }
}

export function playSound(name: SoundName, enabled: boolean): void {
  if (!enabled) return;
  const path = relativeAssetPath(name);
  if (process.platform === "darwin") {
    playViaAfplay(path);
  } else {
    playViaShell(path);
  }
}