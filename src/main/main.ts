import { basename, extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  net,
  protocol,
  screen,
  shell,
  Tray
} from "electron";
import Store from "electron-store";
import {
  createEmptyStats,
  DEFAULT_SETTINGS
} from "../shared/constants";
import { i18n, pick } from "../shared/i18n";
import { PET_STATE_ORDER, petAppearanceOptions } from "../shared/petAppearances";
import type {
  AppSnapshot,
  BlockingMode,
  ChatMessage,
  CustomPetAsset,
  DistractionStatus,
  DemoTrigger,
  Language,
  PetAppearanceId,
  PetAction,
  MoodHistory,
  MoodSample,
  OutfitItem,
  OutfitPart,
  PetDiary,
  PetFacing,
  PetGrowth,
  PetId,
  PetInstance,
  PetMood,
  PetReaction,
  PetRoster,
  PetState,
  Settings,
  StatsHistory,
  SpeechBubble,
  TodayStats,
  UpdateCheckResult
} from "../shared/types";
import { MAIN_PET_ID } from "../shared/types";
import {
  APP_NAME,
  BREAK_RUN_TICK_MS,
  DISTRACTION_CHECK_INTERVAL_MS,
  DISTRACTION_WARNING_COOLDOWN_MS,
  IS_DEV,
  PET_WINDOW,
  PRELOAD_PATH,
  RELEASES_URL,
  RENDERER_HTML_PATH,
  CHAT_HTML_PATH,
  SETTINGS_WINDOW,
  CHAT_WINDOW,
  STORE_NAME
} from "./config";
import {
  clampBoundsToWorkArea,
  displayForBounds,
  initialWindowBounds,
  savedPositionFromBounds,
  visibleWindowBounds
} from "./displayPosition";
import type { DisplayBounds, SavedWindowPosition } from "./displayPosition";
import { classifyDistraction, isPermissionError, readActiveWindow } from "./distraction";
import { applyLaunchAtLoginPreference, getLaunchAtLoginState } from "./loginItem";
import { createAiClient } from "./aiClient";
import { appendDiary, composeDiaryEntry, emptyDiary } from "./diary";
import { playSound } from "./soundPlayer";
import {
  buildApplicationMenuTemplate,
  buildPetContextMenuTemplate,
  buildTrayMenuTemplate
} from "./menus";
import { createTrayImage } from "./trayIcon";
import { getStoredSettings, normalizeSettings } from "./settingsStore";
import {
  getCurrentStats,
  getStatsHistory,
  resetCurrentStats,
  updateCurrentStats
} from "./statsStore";
import {
  checkGitHubReleasesForUpdates,
  createCheckingUpdateCheck,
  createInitialUpdateCheck
} from "./updates";

type StoreSchema = {
  settings: Settings;
  stats: TodayStats;
  statsHistory: StatsHistory;
  petPosition?: SavedWindowPosition;
  petHiddenByUser?: boolean;
};

type PetPosition = {
  x: number;
  y: number;
};

app.setName(APP_NAME);
const appDataPath = app.getPath("appData");
const userDataPath = join(appDataPath, APP_NAME);
if (app.getPath("userData") !== userDataPath) {
  app.setPath("userData", userDataPath);
}
try {
  mkdirSync(userDataPath, { recursive: true });
} catch (_) {
  // ignore
}

const defaultStoreSnapshot = {
  settings: DEFAULT_SETTINGS,
  stats: createEmptyStats(),
  statsHistory: {}
};
const storeFilePath = join(userDataPath, `${STORE_NAME}.json`);
if (!existsSync(storeFilePath)) {
  try {
    writeFileSync(storeFilePath, JSON.stringify(defaultStoreSnapshot, undefined, 2), { mode: 0o600 });
  } catch (_) {
    // ignore: if we can't pre-create, let electron-store try
  }
}

const store = new Store<StoreSchema>({
  name: STORE_NAME,
  cwd: userDataPath,
  defaults: defaultStoreSnapshot
});

let petWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let chatWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// petRoster: archive of every pet the user has configured. The window
// always renders the active pet; switching the active id re-applies the
// stored per-pet settings + transient state. Future commits can move
// from 'one window' to 'one window per pet' by iterating roster.pets.
type PetRosterEntry = PetInstance;

const ROSTER_KEY = "petRoster";

function defaultAppearanceId(): PetAppearanceId {
  return getSettings().petAppearanceId;
}

function readRoster(): PetRoster {
  const stored = store.get(ROSTER_KEY) as { activePetId?: PetId; pets?: PetRosterEntry[] } | undefined;
  if (stored && Array.isArray(stored.pets) && stored.pets.length > 0) {
    return {
      activePetId: stored.activePetId ?? MAIN_PET_ID,
      pets: stored.pets
    };
  }
  const initial: PetRosterEntry[] = [
    {
      id: MAIN_PET_ID,
      label: "Main",
      state: "idle",
      facing: "right",
      mood: "calm",
      lastInteractionAt: null,
      appearanceId: defaultAppearanceId(),
      customPetAppearance: getSettings().customPetAppearance,
      outfit: getSettings().outfit ?? {},
      bornAt: Date.now(),
      totalInteractions: 0,
      transient: null
    }
  ];
  return { activePetId: MAIN_PET_ID, pets: initial };
}

function activeRosterEntry(roster: PetRoster): PetRosterEntry {
  return roster.pets.find((p) => p.id === roster.activePetId) ?? roster.pets[0];
}

function writeRoster(roster: PetRoster): void {
  store.set(ROSTER_KEY, roster);
}

function commitActiveToRoster(): void {
  const roster = readRoster();
  const active = activeRosterEntry(roster);
  active.transient = {
    state: petState,
    facing: petFacing,
    mood: petMood,
    lastInteractionAt
  };
  active.appearanceId = getSettings().petAppearanceId;
  active.customPetAppearance = getSettings().customPetAppearance;
  active.outfit = getSettings().outfit ?? {};
  active.totalInteractions = readGrowth().totalInteractions;
  active.bornAt = readGrowth().bornAt;
  writeRoster(roster);
}

function loadActiveFromRoster(): void {
  const roster = readRoster();
  const active = activeRosterEntry(roster);
  const transient = active.transient ?? {
    state: "idle" as PetState,
    facing: "right" as PetFacing,
    mood: "calm" as PetMood,
    lastInteractionAt: null
  };
  petState = transient.state;
  petFacing = transient.facing;
  petMood = transient.mood;
  lastInteractionAt = transient.lastInteractionAt;
}

function petsById(): Record<PetId, PetInstance> {
  const roster = readRoster();
  const out: Record<PetId, PetInstance> = {};
  for (const entry of roster.pets) {
    const isActive = entry.id === roster.activePetId;
    const transient = entry.transient ?? {
      state: "idle",
      facing: "right",
      mood: "calm",
      lastInteractionAt: null
    };
    out[entry.id] = {
      id: entry.id,
      label: entry.label,
      state: isActive ? petState : transient.state,
      facing: isActive ? petFacing : transient.facing,
      mood: isActive ? petMood : transient.mood,
      lastInteractionAt: isActive ? lastInteractionAt : transient.lastInteractionAt,
      appearanceId: entry.appearanceId,
      customPetAppearance: entry.customPetAppearance,
      outfit: entry.outfit,
      bornAt: entry.bornAt,
      totalInteractions: entry.totalInteractions,
      transient: isActive ? null : transient
    };
  }
  return out;
}
let petState: PetState = "idle";
let petFacing: PetFacing = "right";
let blockingMode: BlockingMode = null;
let focusActive = false;
let focusStartedAt: number | null = null;
let breakRunTimer: NodeJS.Timeout | null = null;
let breakRunCountdownTimer: NodeJS.Timeout | null = null;
let breakRunMovementTimer: NodeJS.Timeout | null = null;
let breakTimer: NodeJS.Timeout | null = null;
let hydrationTimer: NodeJS.Timeout | null = null;
let focusTimer: NodeJS.Timeout | null = null;
let distractionTimer: NodeJS.Timeout | null = null;
let distractionStartupTimer: NodeJS.Timeout | null = null;
let displayChangeTimer: NodeJS.Timeout | null = null;
let breakDueAt: number | null = null;
let hydrationDueAt: number | null = null;
let focusEndsAt: number | null = null;
let bubbleTimer: NodeJS.Timeout | null = null;
let dragTimer: NodeJS.Timeout | null = null;
let dragSafetyTimer: NodeJS.Timeout | null = null;
let breakRunVelocity: PetPosition = { x: 0, y: 0 };
let breakRunFormatter: ((seconds: number) => string) | null = null;
let nextBreakRunTurnAt = 0;
let breakMutedToday = false;
let dragOffset: PetPosition = { x: 0, y: 0 };
let petMouseInteractive = true;
let distractionStatus: DistractionStatus = {
  state: "idle",
  activeApp: "",
  activeWindowTitle: "",
  matchedRule: null,
  lastCheckedAt: null,
  lastWarningAt: null,
  error: null
};

let petMood: PetMood = "calm";
let lastInteractionAt: number | null = null;

// mood history: last 7 days, one sample per hour bucket
const MOOD_HISTORY_KEY = "petMoodHistory";
const MOOD_HISTORY_MAX_SAMPLES = 7 * 24; // 168

function readMoodHistory(): MoodHistory {
  const stored = store.get(MOOD_HISTORY_KEY) as { samples?: MoodSample[] } | undefined;
  if (!stored || !Array.isArray(stored.samples)) {
    return { samples: [] };
  }
  return { samples: stored.samples.slice(-MOOD_HISTORY_MAX_SAMPLES) };
}

function currentHourBucket(now: Date): number {
  return Math.floor(now.getTime() / 3_600_000) * 3_600_000;
}

function recordMoodSample(now: Date): void {
  const history = readMoodHistory();
  const bucket = currentHourBucket(now);
  // overwrite last sample in this bucket if it exists, else append
  const last = history.samples[history.samples.length - 1];
  const next: MoodSample = last && last.bucket === bucket ? { bucket, mood: petMood } : { bucket, mood: petMood };
  const samples = last && last.bucket === bucket
    ? [...history.samples.slice(0, -1), next]
    : [...history.samples, next];
  const trimmed = samples.slice(-MOOD_HISTORY_MAX_SAMPLES);
  store.set(MOOD_HISTORY_KEY, { samples: trimmed });
}

let moodHistoryTimer: NodeJS.Timeout | null = null;
function scheduleMoodHistoryFlush(): void {
  if (moodHistoryTimer) clearTimeout(moodHistoryTimer);
  // flush at the next hour boundary
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  const delay = Math.max(1000, next.getTime() - now.getTime());
  moodHistoryTimer = setTimeout(() => {
    recordMoodSample(new Date());
    sendToAll("app:snapshot", snapshot());
    scheduleMoodHistoryFlush();
  }, delay);
}

function computeMood(now: Date, lastInteraction: number | null): PetMood {
  const hour = now.getHours();
  if (hour >= 23 || hour < 7) return "sleepy";
  const minutesSinceInteraction = lastInteraction
    ? (now.getTime() - lastInteraction) / 60_000
    : Infinity;
  if (lastInteraction !== null && minutesSinceInteraction < 10) return "playful";
  if (hour >= 7 && hour < 9) return "energetic";
  if (lastInteraction !== null && minutesSinceInteraction >= 30) return "bored";
  if (hour >= 17 && hour < 21 && lastInteraction !== null) return "playful";
  return "calm";
}

function refreshMood(): void {
  const next = computeMood(new Date(), lastInteractionAt);
  if (next === petMood) return;
  petMood = next;
  sendToAll("app:snapshot", snapshot());
  if (next === "sleepy") maybeAutoSleep();
  scheduleNextChatter();
  recordMoodSample(new Date());
}

function maybeAutoSleep(): void {
  if (blockingMode) return;
  if (petState === "idle" || petState === "walking") setPetState("sleeping");
}

function maybeWakeUp(): void {
  if (petState === "sleeping") {
    setPetState(focusActive ? "focusGuard" : "idle");
  }
}

let wanderTimer: NodeJS.Timeout | null = null;
let walkAnimationTimer: NodeJS.Timeout | null = null;

function wanderIntervalMs(): number {
  const [minS, maxS] = ((): [number, number] => {
    switch (petMood) {
      case "playful": return [30, 60];
      case "energetic": return [45, 90];
      case "calm": return [90, 180];
      case "bored": return [60, 120];
      case "sleepy": return [300, 600];
    }
  })();
  return (minS + Math.random() * (maxS - minS)) * 1000;
}

function scheduleNextWander(): void {
  if (wanderTimer) {
    clearTimeout(wanderTimer);
    wanderTimer = null;
  }
  wanderTimer = setTimeout(() => {
    wanderTimer = null;
    performWander();
  }, wanderIntervalMs());
}

function cancelWander(): void {
  if (wanderTimer) {
    clearTimeout(wanderTimer);
    wanderTimer = null;
  }
  if (walkAnimationTimer) {
    clearInterval(walkAnimationTimer);
    walkAnimationTimer = null;
  }
}

function performWander(): void {
  if (!petWindow || petWindow.isDestroyed()) {
    scheduleNextWander();
    return;
  }
  if (blockingMode) {
    scheduleNextWander();
    return;
  }
  if (dragTimer) {
    scheduleNextWander();
    return;
  }
  if (petState === "walking" || petState === "sleeping") {
    scheduleNextWander();
    return;
  }

  const bounds = petWindow.getBounds();
  const display = displayForBounds(currentDisplays(), bounds, primaryDisplay());
  const workArea = display.workArea;
  const maxX = Math.max(0, workArea.width - bounds.width);
  const maxY = Math.max(0, workArea.height - bounds.height);
  if (maxX === 0 && maxY === 0) {
    scheduleNextWander();
    return;
  }
  const targetX = workArea.x + Math.round(Math.random() * maxX);
  const targetY = workArea.y + Math.round(Math.random() * maxY);
  const distance = Math.hypot(targetX - bounds.x, targetY - bounds.y);
  if (distance < 30) {
    scheduleNextWander();
    return;
  }

  const totalMs = Math.min(3000, Math.max(800, distance * 1.5));
  const stepMs = 16;
  const totalSteps = Math.max(1, Math.ceil(totalMs / stepMs));
  let currentStep = 0;
  const startX = bounds.x;
  const startY = bounds.y;
  const dx = targetX - startX;
  const dy = targetY - startY;

  setPetFacing(dx >= 0 ? "right" : "left");
  setPetState("walking");

  walkAnimationTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) {
      cancelWander();
      scheduleNextWander();
      return;
    }
    currentStep++;
    const t = Math.min(1, currentStep / totalSteps);
    const easeT = 1 - Math.pow(1 - t, 3);
    const newX = Math.round(startX + dx * easeT);
    const newY = Math.round(startY + dy * easeT);
    petWindow.setBounds({ ...bounds, x: newX, y: newY });
    if (currentStep >= totalSteps) {
      if (walkAnimationTimer) {
        clearInterval(walkAnimationTimer);
        walkAnimationTimer = null;
      }
      persistPetPosition();
      setPetState(petMood === "sleepy" ? "sleeping" : focusActive ? "focusGuard" : "idle");
      scheduleNextWander();
    }
  }, stepMs);
}

let chatTimer: NodeJS.Timeout | null = null;

function chatIntervalMs(): number {
  const [minS, maxS] = ((): [number, number] => {
    switch (petMood) {
      case "playful": return [90, 180];
      case "energetic": return [120, 240];
      case "calm": return [240, 480];
      case "bored": return [60, 150];
      case "sleepy": return [480, 900];
    }
  })();
  return (minS + Math.random() * (maxS - minS)) * 1000;
}

function cancelChatter(): void {
  if (chatTimer) {
    clearTimeout(chatTimer);
    chatTimer = null;
  }
}

function scheduleNextChatter(): void {
  cancelChatter();
  chatTimer = setTimeout(() => {
    chatTimer = null;
    void performChatter();
  }, chatIntervalMs());
}

async function performChatter(): Promise<void> {
  if (!petWindow || petWindow.isDestroyed()) {
    scheduleNextChatter();
    return;
  }
  if (blockingMode) {
    scheduleNextChatter();
    return;
  }
  if (bubbleTimer) {
    scheduleNextChatter();
    return;
  }
  if (petState === "walking" || petState === "sleeping") {
    scheduleNextChatter();
    return;
  }

  const settings = getSettings();
  const client = createAiClient(settings.aiProvider, settings.aiApiKey);
  let message = "";
  const hour = new Date().getHours();

  if (client.isConfigured() && Math.random() < 0.5) {
    try {
      message = await client.chat([
        {
          role: "system",
          content:
            "You are a tiny cute desktop pet (a small dinosaur). Reply with ONE short casual sentence in the user's language (Chinese if their system language is zh-CN, otherwise English). The current mood is: " +
            petMood +
            ". Current hour: " +
            hour +
            ". Keep it under 20 characters. Be playful and warm."
        },
        {
          role: "user",
          content: "随便说一句吧"
        }
      ]);
    } catch {
      // fall back to local phrase pool
      message = pick(text().bubble.idleChatter);
    }
  } else {
    message = pick(text().bubble.idleChatter);
  }

  if (!message) {
    scheduleNextChatter();
    return;
  }

  showBubble({
    id: "idle-chatter",
    message,
    autoDismissMs: 3500
  });
  scheduleNextChatter();
}

function petPlayCatch(targetX: number, targetY: number): void {
  if (blockingMode) return;
  if (!petWindow || petWindow.isDestroyed()) return;
  if (dragTimer) return;

  cancelWander();
  cancelChatter();
  lastInteractionAt = Date.now();
  bumpInteraction();
  maybeWakeUp();
  refreshMood();
  scheduleNextWander();
  scheduleNextChatter();

  const bounds = petWindow.getBounds();
  const display = displayForBounds(currentDisplays(), bounds, primaryDisplay());
  const workArea = display.workArea;
  const clampedX = Math.min(Math.max(targetX, workArea.x), workArea.x + workArea.width - bounds.width);
  const clampedY = Math.min(Math.max(targetY, workArea.y), workArea.y + workArea.height - bounds.height);
  const distance = Math.hypot(clampedX - bounds.x, clampedY - bounds.y);
  if (distance < 30) {
    setPetState("happy");
    showBubble({ id: "play-catch", message: pick(text().bubble.woof), autoDismissMs: 1500 });
    setTimeout(() => {
      if (!blockingMode) setPetState(focusActive ? "focusGuard" : "idle");
    }, 1700);
    return;
  }

  const totalMs = Math.min(2500, Math.max(600, distance * 1.2));
  const stepMs = 16;
  const totalSteps = Math.max(1, Math.ceil(totalMs / stepMs));
  let currentStep = 0;
  const startX = bounds.x;
  const startY = bounds.y;
  const dx = clampedX - startX;
  const dy = clampedY - startY;

  setPetFacing(dx >= 0 ? "right" : "left");
  setPetState("walking");

  if (walkAnimationTimer) clearInterval(walkAnimationTimer);
  walkAnimationTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) {
      cancelWander();
      scheduleNextWander();
      return;
    }
    currentStep++;
    const t = Math.min(1, currentStep / totalSteps);
    const easeT = 1 - Math.pow(1 - t, 3);
    const newX = Math.round(startX + dx * easeT);
    const newY = Math.round(startY + dy * easeT);
    petWindow.setBounds({ ...bounds, x: newX, y: newY });
    if (currentStep >= totalSteps) {
      if (walkAnimationTimer) {
        clearInterval(walkAnimationTimer);
        walkAnimationTimer = null;
      }
      persistPetPosition();
      setPetState("happy");
      showBubble({ id: "play-catch-got", message: pick(text().bubble.woof), autoDismissMs: 1500 });
      setTimeout(() => {
        if (!blockingMode) setPetState(focusActive ? "focusGuard" : "idle");
      }, 1700);
    }
  }, stepMs);
}

function petAppearanceLabel(id: PetAppearanceId, language: Language): string {
  if (id === "custom") {
    const custom = getSettings().customPetAppearance;
    if (custom?.name) return custom.name;
  }
  const options = petAppearanceOptions(language);
  const found = options.find((opt) => opt.value === id);
  return found?.label ?? id;
}

function readDiary(): PetDiary {
  const stored = store.get("petDiary");
  if (stored && typeof stored === "object" && Array.isArray((stored as PetDiary).entries)) {
    return stored as PetDiary;
  }
  return emptyDiary();
}

function readGrowth(): PetGrowth {
  const stored = store.get("petGrowth") as Partial<PetGrowth> | undefined;
  if (stored && typeof stored.bornAt === "number") {
    return {
      bornAt: stored.bornAt,
      totalInteractions: stored.totalInteractions ?? 0,
      lastMilestone: stored.lastMilestone ?? null
    };
  }
  return {
    bornAt: Date.now(),
    totalInteractions: 0,
    lastMilestone: null
  };
}

const MILESTONE_THRESHOLDS = [10, 50, 100, 250, 500, 1000];

function bumpInteraction(): void {
  const current = readGrowth();
  const nextCount = current.totalInteractions + 1;
  const milestone = MILESTONE_THRESHOLDS.find(
    (threshold) => nextCount >= threshold && current.lastMilestone !== `interactions-${threshold}`
  );
  const lastMilestone = milestone ? `interactions-${milestone}` : current.lastMilestone;
  store.set("petGrowth", {
    bornAt: current.bornAt,
    totalInteractions: nextCount,
    lastMilestone
  });
  if (milestone) {
    showBubble({
      id: "milestone",
      message: pick(text().bubble.woof),
      autoDismissMs: 2200
    });
  }
  publishSnapshot();
}

let updateCheck: UpdateCheckResult = createInitialUpdateCheck();

function setPetMouseInteractive(interactive: boolean): void {
  if (!petWindow || petWindow.isDestroyed() || petMouseInteractive === interactive) return;
  petMouseInteractive = interactive;
  petWindow.setIgnoreMouseEvents(!interactive, { forward: true });
}

function getSettings(): Settings {
  return getStoredSettings(store);
}

function text(): ReturnType<typeof i18n> {
  return i18n(getSettings().language);
}

function setSettings(next: Settings): void {
  const normalized = normalizeSettings(next);
  applyLaunchAtLoginPreference(normalized.launchAtLoginEnabled);
  store.set("settings", normalized);
  sendToAll("settings:updated", getSettingsWithSystemState());
  settingsWindow?.setTitle(`${APP_NAME} ${text().menu.settings}`);
  scheduleReminderTimers();
  scheduleDistractionDetection();
  updateTrayMenu();
}

function getSettingsWithSystemState(): Settings {
  const settings = getSettings();
  return {
    ...settings,
    launchAtLoginEnabled: getLaunchAtLoginState(settings.launchAtLoginEnabled)
  };
}

function getStats(): TodayStats {
  return getCurrentStats(store);
}

function updateStats(mutator: (stats: TodayStats) => TodayStats): void {
  const next = updateCurrentStats(store, mutator);
  sendToAll("stats:updated", next);
}

function isCustomPetState(state: unknown): state is PetState {
  return typeof state === "string" && PET_STATE_ORDER.includes(state as PetState);
}

async function importCustomPetAsset(state: PetState, sourcePath: string): Promise<CustomPetAsset | null> {
  if (!isCustomPetState(state) || typeof sourcePath !== "string") return null;
  if (extname(sourcePath).toLowerCase() !== ".gif") return null;

  const customRoot = join(app.getPath("userData"), "custom_pet_assets");
  const stateDir = join(customRoot, state);
  await mkdir(stateDir, { recursive: true });

  const originalName = basename(sourcePath);
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]+/g, "-") || `${state}.gif`;
  const fileName = `${state}-${Date.now()}-${safeName}`;
  const targetPath = join(stateDir, fileName);
  await copyFile(sourcePath, targetPath);

  return {
    relativePath: `custom_pet_assets/${state}/${fileName}`,
    originalName,
    updatedAt: Date.now()
  };
}

function resetTodayStats(): void {
  breakMutedToday = false;
  const reset = resetCurrentStats(store);
  sendToAll("stats:updated", reset);
}

async function selectCustomPetAsset(state: PetState): Promise<CustomPetAsset | null> {
  if (!isCustomPetState(state)) return null;

  const options: Electron.OpenDialogOptions = {
    properties: ["openFile"],
    filters: [{ name: "GIF Images", extensions: ["gif"] }]
  };
  const result =
    settingsWindow && !settingsWindow.isDestroyed()
      ? await dialog.showOpenDialog(settingsWindow, options)
      : await dialog.showOpenDialog(options);

  if (result.canceled || !result.filePaths[0]) return null;
  return importCustomPetAsset(state, result.filePaths[0]);
}

function snapshot(): AppSnapshot {
  return {
    appInfo: {
      version: app.getVersion(),
      releaseNotesUrl: RELEASES_URL
    },
    updateCheck,
    settings: getSettingsWithSystemState(),
    stats: getStats(),
    statsHistory: getStatsHistory(store),
    timers: {
      breakDueAt,
      hydrationDueAt,
      focusEndsAt
    },
    distraction: distractionStatus,
    petState,
    petFacing,
    petMood,
    lastInteractionAt,
    pets: petsById(),
    activePetId: readRoster().activePetId,
    petRoster: readRoster(),
    petDiary: readDiary(),
    petGrowth: readGrowth(),
    petMoodHistory: readMoodHistory(),
    blockingMode,
    dogVisible: Boolean(petWindow?.isVisible()),
    focusActive
  };
}

function isPetHiddenByUser(): boolean {
  return store.get("petHiddenByUser") === true;
}

function setPetHiddenByUser(hidden: boolean): void {
  store.set("petHiddenByUser", hidden);
  updateTrayMenu();
  publishSnapshot();
}

function sendToPet<T>(channel: string, payload?: T): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.webContents.send(channel, payload);
}

function sendToAll<T>(channel: string, payload?: T): void {
  sendToPet(channel, payload);
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send(channel, payload);
  }
}

function publishSnapshot(): void {
  sendToAll("app:snapshot", snapshot());
}

function setPetState(next: PetState): void {
  petState = next;
  sendToAll("pet:set-state", next);
}

function setPetFacing(next: PetFacing): void {
  if (petFacing === next) return;
  petFacing = next;
  publishSnapshot();
}

function showBubble(bubble: SpeechBubble): void {
  if (bubbleTimer) clearTimeout(bubbleTimer);
  sendToPet("pet:show-bubble", bubble);
  if (bubble.autoDismissMs) {
    bubbleTimer = setTimeout(() => hideBubble(), bubble.autoDismissMs);
  }
}

function hideBubble(): void {
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }
  sendToPet("pet:hide-bubble");
}

function rendererUrl(route: "pet" | "settings"): string {
  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (devServer) return `${devServer}#${route}`;
  return RENDERER_HTML_PATH;
}

function loadRenderer(win: BrowserWindow, route: "pet" | "settings"): void {
  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (devServer) {
    void win.loadURL(rendererUrl(route));
    return;
  }
  void win.loadFile(rendererUrl(route), { hash: route });
}

function toDisplayBounds(display: Electron.Display): DisplayBounds {
  return {
    id: display.id,
    workArea: display.workArea
  };
}

function currentDisplays(): DisplayBounds[] {
  return screen.getAllDisplays().map(toDisplayBounds);
}

function primaryDisplay(): DisplayBounds {
  return toDisplayBounds(screen.getPrimaryDisplay());
}

function initialPetBounds(): Electron.Rectangle {
  const stored = store.get("petPosition");
  return initialWindowBounds({
    displays: currentDisplays(),
    primaryDisplay: primaryDisplay(),
    size: PET_WINDOW,
    saved: stored
  });
}

function persistPetPosition(): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  const bounds = petWindow.getBounds();
  store.set("petPosition", savedPositionFromBounds(currentDisplays(), bounds, primaryDisplay()));
}

function keepPetWindowInVisibleWorkArea(): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  const bounds = petWindow.getBounds();
  const nextBounds = visibleWindowBounds(currentDisplays(), primaryDisplay(), bounds);
  if (bounds.x !== nextBounds.x || bounds.y !== nextBounds.y) {
    petWindow.setBounds(nextBounds);
  }
  persistPetPosition();
  publishSnapshot();
}

function schedulePetDisplayRepair(): void {
  if (displayChangeTimer) clearTimeout(displayChangeTimer);
  displayChangeTimer = setTimeout(() => {
    displayChangeTimer = null;
    keepPetWindowInVisibleWorkArea();
  }, 250);
}

function registerDisplayChangeHandlers(): void {
  screen.on("display-added", schedulePetDisplayRepair);
  screen.on("display-removed", schedulePetDisplayRepair);
  screen.on("display-metrics-changed", schedulePetDisplayRepair);
}

function createPetWindow(): void {
  const bounds = initialPetBounds();
  petMouseInteractive = true;
  petWindow = new BrowserWindow({
    width: PET_WINDOW.width,
    height: PET_WINDOW.height,
    x: bounds.x,
    y: bounds.y,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    show: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !IS_DEV
    }
  });

  petWindow.setAlwaysOnTop(true, process.platform === "darwin" ? "floating" : "normal");
  if (process.platform === "darwin") {
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  setPetMouseInteractive(false);
  loadRenderer(petWindow, "pet");
  petWindow.once("ready-to-show", () => {
    if (!isPetHiddenByUser()) petWindow?.showInactive();
    updateTrayMenu();
    publishSnapshot();
  });
  petWindow.on("show", () => {
    updateTrayMenu();
    publishSnapshot();
    scheduleNextWander();
    scheduleNextChatter();
  });
  petWindow.on("hide", () => {
    stopPetDrag();
    cancelWander();
    cancelChatter();
    updateTrayMenu();
    publishSnapshot();
  });
  petWindow.on("closed", () => {
    stopPetDrag();
    petWindow = null;
    updateTrayMenu();
    publishSnapshot();
  });
}

function ensurePetWindowVisible(options: { ignoreUserHidden?: boolean } = {}): boolean {
  if (isPetHiddenByUser() && !options.ignoreUserHidden) {
    updateTrayMenu();
    publishSnapshot();
    return false;
  }
  if (!petWindow || petWindow.isDestroyed()) createPetWindow();
  if (petWindow && !petWindow.isVisible()) petWindow.showInactive();
  updateTrayMenu();
  publishSnapshot();
  return true;
}

function showPetWindowFromMenu(): void {
  setPetHiddenByUser(false);
  ensurePetWindowVisible({ ignoreUserHidden: true });
}

function createSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: SETTINGS_WINDOW.width,
    height: SETTINGS_WINDOW.height,
    title: `${APP_NAME} ${text().menu.settings}`,
    resizable: true,
    minWidth: SETTINGS_WINDOW.width,
    maxWidth: SETTINGS_WINDOW.width,
    minHeight: 400,
    show: false,
    backgroundColor: "#faf6ee",
    ...(process.platform === "darwin"
      ? { titleBarStyle: "hiddenInset" as const, trafficLightPosition: { x: 14, y: 14 } }
      : {}),
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !IS_DEV
    }
  });

  loadRenderer(settingsWindow, "settings");
  settingsWindow.once("ready-to-show", () => {
    settingsWindow?.show();
    publishSnapshot();
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function createChatWindow(): void {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.focus();
    return;
  }
  const devServer = process.env.ELECTRON_RENDERER_URL;
  chatWindow = new BrowserWindow({
    width: CHAT_WINDOW.width,
    height: CHAT_WINDOW.height,
    title: `${APP_NAME} — Chat`,
    resizable: true,
    minWidth: 360,
    minHeight: 420,
    show: false,
    backgroundColor: "#faf6ee",
    ...(process.platform === "darwin"
      ? { titleBarStyle: "hiddenInset" as const, trafficLightPosition: { x: 14, y: 14 } }
      : {}),
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !IS_DEV
    }
  });
  if (devServer) {
    void chatWindow.loadURL(`${devServer}#/chat`);
  } else {
    void chatWindow.loadFile(CHAT_HTML_PATH);
  }
  chatWindow.once("ready-to-show", () => chatWindow?.show());
  chatWindow.on("closed", () => {
    chatWindow = null;
  });
}

function createTray(): void {
  tray = new Tray(createTrayImage());
  tray.setToolTip(APP_NAME);
  tray.on("click", () => {
    tray?.popUpContextMenu();
  });
  if (process.platform !== "darwin") {
    nativeTheme.on("updated", () => tray?.setImage(createTrayImage()));
  }
  updateTrayMenu();
}

function togglePetWindowVisibility(): void {
  if (!petWindow) createPetWindow();
  if (!petWindow) return;
  if (petWindow.isVisible()) hidePetWindowFromMenu();
  else showPetWindowFromMenu();
}

function hidePetWindowFromMenu(): void {
  setPetHiddenByUser(true);
  petWindow?.hide();
  updateTrayMenu();
  sendToAll("app:snapshot", snapshot());
}

function menuState() {
  return {
    appName: APP_NAME,
    dogVisible: Boolean(petWindow?.isVisible()),
    focusActive,
    isPackaged: app.isPackaged
  };
}

function menuActions() {
  return {
    toggleDog: togglePetWindowVisibility,
    hideDog: hidePetWindowFromMenu,
    startFocus: startFocusMode,
    stopFocusFromMenu: () => stopFocusMode(true),
    stopFocusFromContext: () => stopFocusMode(false),
    openSettings: createSettingsWindow,
    openChat: () => createChatWindow(),
    quit: () => app.quit(),
    triggerDemo,
    performAction: (action: PetAction) => performPetAction(action)
  };
}

function updateApplicationMenu(): void {
  const labels = text().menu;
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(buildApplicationMenuTemplate(labels, menuState(), menuActions()))
  );
}

function updateTrayMenu(): void {
  updateApplicationMenu();
  if (!tray) return;
  const labels = text().menu;
  tray.setContextMenu(
    Menu.buildFromTemplate(buildTrayMenuTemplate(labels, menuState(), menuActions()))
  );
}

function showPetContextMenu(): void {
  const labels = text().menu;
  Menu.buildFromTemplate(buildPetContextMenuTemplate(labels, menuState(), menuActions())).popup({
    window: petWindow ?? undefined
  });
}

function movePetWithCursor(): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const bounds = visibleWindowBounds(currentDisplays(), primaryDisplay(), {
    width: PET_WINDOW.width,
    height: PET_WINDOW.height,
    x: cursor.x - dragOffset.x,
    y: cursor.y - dragOffset.y
  });
  petWindow.setBounds(bounds);
}

function startPetDrag(offset: { offsetX: number; offsetY: number }): void {
  if (blockingMode === "breakRun" || !petWindow || petWindow.isDestroyed()) return;
  cancelWander();
  dragOffset = {
    x: Math.min(Math.max(Math.round(offset.offsetX), 0), PET_WINDOW.width),
    y: Math.min(Math.max(Math.round(offset.offsetY), 0), PET_WINDOW.height)
  };
  if (dragTimer) clearInterval(dragTimer);
  if (dragSafetyTimer) clearTimeout(dragSafetyTimer);
  movePetWithCursor();
  dragTimer = setInterval(movePetWithCursor, 16);
  dragSafetyTimer = setTimeout(stopPetDrag, 15_000);
}

function stopPetDrag(): void {
  const wasDragging = Boolean(dragTimer || dragSafetyTimer);
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
  if (dragSafetyTimer) {
    clearTimeout(dragSafetyTimer);
    dragSafetyTimer = null;
  }
  if (wasDragging) {
    persistPetPosition();
    sendToAll("app:snapshot", snapshot());
    scheduleNextWander();
  }
}

function clearBreakRunTimers(): void {
  if (breakRunTimer) {
    clearTimeout(breakRunTimer);
    breakRunTimer = null;
  }
  if (breakRunCountdownTimer) {
    clearInterval(breakRunCountdownTimer);
    breakRunCountdownTimer = null;
  }
  if (breakRunMovementTimer) {
    clearInterval(breakRunMovementTimer);
    breakRunMovementTimer = null;
  }
}

function showBreakRunCountdown(endsAt: number): void {
  const labels = text();
  const remainingSeconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  const formatter = breakRunFormatter ?? pick(labels.bubble.breakRun);
  showBubble({
    id: "break-run",
    message: formatter(remainingSeconds),
    actions: [{ id: "break-run:done", label: labels.actions.breakRunDone, kind: "primary" }]
  });
}

function chooseBreakRunVelocity(): PetPosition {
  const speed = 3.5 + Math.random() * 2.9;
  const angle = Math.random() * Math.PI * 2;
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed
  };
}

function movePetForBreakRun(): void {
  if (!petWindow || petWindow.isDestroyed() || !petWindow.isVisible()) return;

  const bounds = petWindow.getBounds();
  const workArea = screen.getDisplayNearestPoint({
    x: bounds.x + Math.round(bounds.width / 2),
    y: bounds.y + Math.round(bounds.height / 2)
  }).workArea;
  const now = Date.now();
  const minX = workArea.x + 8;
  const maxX = workArea.x + workArea.width - PET_WINDOW.width - 8;
  const minY = workArea.y + 8;
  const maxY = workArea.y + workArea.height - PET_WINDOW.height - 8;

  if (now >= nextBreakRunTurnAt && Math.random() < 0.45) {
    breakRunVelocity = chooseBreakRunVelocity();
  }

  let nextX = bounds.x + breakRunVelocity.x;
  let nextY = bounds.y + breakRunVelocity.y;

  if (nextX <= minX) {
    nextX = minX;
    breakRunVelocity.x = Math.abs(breakRunVelocity.x);
  }
  if (nextX >= maxX) {
    nextX = maxX;
    breakRunVelocity.x = -Math.abs(breakRunVelocity.x);
  }
  if (nextY <= minY) {
    nextY = minY;
    breakRunVelocity.y = Math.abs(breakRunVelocity.y);
  }
  if (nextY >= maxY) {
    nextY = maxY;
    breakRunVelocity.y = -Math.abs(breakRunVelocity.y);
  }

  if (now >= nextBreakRunTurnAt) {
    nextBreakRunTurnAt = now + 350 + Math.round(Math.random() * 850);
  }

  setPetFacing(breakRunVelocity.x >= 0 ? "right" : "left");
  petWindow.setBounds({
    ...bounds,
    x: Math.round(nextX),
    y: Math.round(nextY)
  });
}

function finishBreakRun(): void {
  clearBreakRunTimers();
  breakRunFormatter = null;
  blockingMode = null;
  hideBubble();
  showBubble({ id: "break-run-complete", message: pick(text().bubble.breakRunComplete), autoDismissMs: 2200 });
  setPetState("breakDone");
  scheduleBreakReminderTimer();
  setTimeout(() => {
    if (!blockingMode && !focusActive) {
      if (showOverdueReminder()) return;
      hideBubble();
      setPetState("idle");
    }
  }, 2300);
  publishSnapshot();
}

function startBreakRun(): void {
  ensurePetWindowVisible();
  clearBreakRunTimers();
  blockingMode = "breakRun";
  breakDueAt = null;
  breakRunFormatter = pick(text().bubble.breakRun);
  breakRunVelocity = chooseBreakRunVelocity();
  nextBreakRunTurnAt = Date.now();
  setPetState("breakRunning");
  setPetFacing(breakRunVelocity.x >= 0 ? "right" : "left");
  const durationMs = getSettings().breakRunDurationSeconds * 1000;
  const endsAt = Date.now() + durationMs;
  showBreakRunCountdown(endsAt);
  breakRunCountdownTimer = setInterval(() => showBreakRunCountdown(endsAt), 1000);
  breakRunMovementTimer = setInterval(movePetForBreakRun, BREAK_RUN_TICK_MS);
  breakRunTimer = setTimeout(finishBreakRun, durationMs);
  publishSnapshot();
}

function clearBreakReminderTimer(): void {
  if (breakTimer) {
    clearTimeout(breakTimer);
    breakTimer = null;
  }
}

function clearHydrationReminderTimer(): void {
  if (hydrationTimer) {
    clearTimeout(hydrationTimer);
    hydrationTimer = null;
  }
}

function scheduleBreakReminderTimer(delayMs?: number): void {
  clearBreakReminderTimer();
  const settings = getSettings();
  if (!settings.breakReminderEnabled || breakMutedToday) {
    breakDueAt = null;
    publishSnapshot();
    return;
  }

  const nextDelayMs = delayMs ?? settings.breakIntervalMinutes * 60 * 1000;
  breakDueAt = Date.now() + nextDelayMs;
  breakTimer = setTimeout(() => triggerBreakReminder(false), nextDelayMs);
  publishSnapshot();
}

function scheduleHydrationReminderTimer(delayMs?: number): void {
  clearHydrationReminderTimer();
  const settings = getSettings();
  if (!settings.hydrationReminderEnabled) {
    hydrationDueAt = null;
    publishSnapshot();
    return;
  }

  const nextDelayMs = delayMs ?? settings.hydrationIntervalMinutes * 60 * 1000;
  hydrationDueAt = Date.now() + nextDelayMs;
  hydrationTimer = setTimeout(() => triggerHydrationReminder(false), nextDelayMs);
  publishSnapshot();
}

async function importCustomOutfit(
  part: OutfitPart,
  sourcePath: string,
  label: string
): Promise<OutfitItem | null> {
  try {
    const ext = sourcePath.toLowerCase().split(".").pop() ?? "";
    if (ext !== "png") return null;
    const customRoot = join(app.getPath("userData"), "custom_outfits", part);
    await mkdir(customRoot, { recursive: true });
    const id = `custom-${Date.now().toString(36)}`;
    const fileName = `${id}.png`;
    await copyFile(sourcePath, join(customRoot, fileName));
    return {
      id,
      part,
      label: { "zh-CN": label || "Text:自定义", en: label || "Custom" },
      relativePath: `custom_outfits/${part}/${fileName}`,
      custom: true
    };
  } catch {
    return null;
  }
}

function listCustomOutfits(): OutfitItem[] {
  const items: OutfitItem[] = [];
  const parts: OutfitPart[] = ["hat", "glasses", "scarf", "bow"];
  for (const part of parts) {
    const dir = join(app.getPath("userData"), "custom_outfits", part);
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir).filter((f) => f.endsWith(".png"));
      for (const entry of entries) {
        items.push({
          id: entry.replace(/\.png$/, ""),
          part,
          label: { "zh-CN": "自定义", en: "Custom" },
          relativePath: `custom_outfits/${part}/${entry}`,
          custom: true
        });
      }
    } catch {
      // ignore
    }
  }
  return items;
}

function performPetAction(action: PetAction): void {
  if (blockingMode) return;
  cancelPetReactionRevert();
  const returnState = focusActive ? "focusGuard" : "idle";
  const soundOn = getSettings().soundEnabled;

  const bubbleFor: Record<PetAction, string[]> = {
    wave: ["嗨~ 挥手", "👋 见到你真开心", "哈喽！"],
    dance: ["♪~ 蹦蹦跳跳 ~♪", "转一圈！再转一圈！", "看我跳舞~"],
    spin: ["转呀转呀~", "看我翻跟头！", "呼啦~"],
    stretch: ["啊——伸个懒腰", "呼~舒服~", "伸完懒腰精神好！"],
    yawn: ["啊呜~ 好困…", "ZZZ…", "困了困了…"],
    shy: ["(*/ω＼*)", "人家有点害羞…", "别、别看我啦~"],
    sing: ["♪ 啦啦啦 ~", "哼个小曲儿~", "🎵 这首歌送给你 ~"],
    heart: ["比心 ❤️", "喜欢你哦~", "❤ 给你比个心"]
  };
  const actionType: Record<PetAction, "happy" | "walk" | "sleepy" | "shy"> = {
    wave: "happy",
    dance: "happy",
    spin: "walk",
    stretch: "happy",
    yawn: "sleepy",
    shy: "shy",
    sing: "happy",
    heart: "happy"
  };
  const target = actionType[action];
  if (target === "walk") {
    setPetFacing(petFacing === "right" ? "left" : "right");
    setPetState("walking");
  } else if (target === "sleepy") {
    setPetState("sleeping");
  } else if (target === "shy") {
    setPetState("happy");
  } else {
    setPetState("happy");
  }
  showBubble({
    id: `pet-action-${action}`,
    message: pick(bubbleFor[action]),
    autoDismissMs: 2200
  });
  if (soundOn) playSound("happy", true);

  const revertMs = target === "walk" ? 1700 : target === "sleepy" ? 1500 : 2100;
  schedulePetReactionRevert(revertMs, returnState);
  lastInteractionAt = Date.now();
  bumpInteraction();
  maybeWakeUp();
  refreshMood();
}

function scheduleReminderTimers(): void {
  clearBreakReminderTimer();
  clearHydrationReminderTimer();
  breakDueAt = null;
  hydrationDueAt = null;

  scheduleBreakReminderTimer();
  scheduleHydrationReminderTimer();
}

function showOverdueReminder(): boolean {
  if (blockingMode || focusActive) return false;

  const now = Date.now();
  const settings = getSettings();
  if (settings.breakReminderEnabled && !breakMutedToday && breakDueAt !== null && breakDueAt <= now) {
    triggerBreakReminder(false);
    return true;
  }
  if (settings.hydrationReminderEnabled && hydrationDueAt !== null && hydrationDueAt <= now) {
    triggerHydrationReminder(false);
    return true;
  }

  return false;
}

function setDistractionStatus(partial: Partial<DistractionStatus>): void {
  distractionStatus = { ...distractionStatus, ...partial };
  publishSnapshot();
}

async function checkDistractionNow(): Promise<void> {
  const settings = getSettings();
  if (!settings.distractionDetectionEnabled) return;

  try {
    const active = await readActiveWindow();
    const matchedRule = classifyDistraction(active, settings);
    const now = Date.now();

    setDistractionStatus({
      state: "watching",
      activeApp: active.appName,
      activeWindowTitle: active.windowTitle,
      matchedRule,
      lastCheckedAt: now,
      error: null
    });

    if (!focusActive || blockingMode === "focusWarning") return;
    if (!matchedRule) return;
    if (
      distractionStatus.lastWarningAt &&
      now - distractionStatus.lastWarningAt < DISTRACTION_WARNING_COOLDOWN_MS
    ) {
      return;
    }

    setDistractionStatus({ lastWarningAt: now });
    triggerFocusWarning(matchedRule.replace(/^(app|keyword):/, ""));
  } catch (error) {
    setDistractionStatus({
      state: isPermissionError(error) ? "permission-needed" : "error",
      error: error instanceof Error ? error.message : String(error),
      lastCheckedAt: Date.now()
    });
  }
}

function scheduleDistractionDetection(): void {
  if (distractionTimer) {
    clearInterval(distractionTimer);
    distractionTimer = null;
  }
  if (distractionStartupTimer) {
    clearTimeout(distractionStartupTimer);
    distractionStartupTimer = null;
  }

  const settings = getSettings();
  if (!settings.distractionDetectionEnabled) {
    setDistractionStatus({
      state: "idle",
      matchedRule: null,
      error: null
    });
    return;
  }

  setDistractionStatus({
    state: process.platform === "darwin" ? "watching" : "unsupported",
    error: process.platform === "darwin" ? null : text().system.unsupportedDistraction
  });

  if (process.platform !== "darwin") return;

  const firstCheckDelay = focusActive ? Math.max(0, settings.distractionGraceSeconds * 1000) : 0;
  distractionStartupTimer = setTimeout(() => {
    void checkDistractionNow();
    distractionTimer = setInterval(() => void checkDistractionNow(), DISTRACTION_CHECK_INTERVAL_MS);
  }, firstCheckDelay);
}

function resumeLongTermState(): void {
  blockingMode = null;
  hideBubble();
  if (showOverdueReminder()) return;
  if (focusActive) {
    setPetState("focusGuard");
    sendToAll("app:snapshot", snapshot());
    return;
  }
  setPetState("idle");
  sendToAll("app:snapshot", snapshot());
}

let petReactionRevertTimeout: NodeJS.Timeout | null = null;

function cancelPetReactionRevert(): void {
  if (petReactionRevertTimeout) {
    clearTimeout(petReactionRevertTimeout);
    petReactionRevertTimeout = null;
  }
}

function schedulePetReactionRevert(delayMs: number, returnState: PetState): void {
  cancelPetReactionRevert();
  petReactionRevertTimeout = setTimeout(() => {
    hideBubble();
    setPetState(returnState);
    petReactionRevertTimeout = null;
  }, delayMs);
}

function petReact(reaction: PetReaction, holding: boolean): void {
  if (blockingMode) return;
  const returnState = focusActive ? "focusGuard" : "idle";
  const soundOn = getSettings().soundEnabled;
  if (reaction === "single") playSound("click", soundOn);
  if (reaction === "longPress" && holding) playSound("petted", soundOn);
  if (reaction === "double") playSound("happy", soundOn);

  switch (reaction) {
    case "single":
    case "double":
      lastInteractionAt = Date.now();
      bumpInteraction();
      maybeWakeUp();
      refreshMood();
      scheduleNextWander();
      scheduleNextChatter();
      break;
    case "longPress":
      if (holding) {
        lastInteractionAt = Date.now();
        bumpInteraction();
        maybeWakeUp();
        refreshMood();
        scheduleNextWander();
        scheduleNextChatter();
      }
      break;
  }

  switch (reaction) {
    case "single":
      cancelPetReactionRevert();
      setPetState("happy");
      showBubble({
        id: "pet-react-single",
        message: pick(text().bubble.singleClick),
        autoDismissMs: 1500
      });
      schedulePetReactionRevert(1600, returnState);
      break;
    case "double":
      cancelPetReactionRevert();
      setPetState("happy");
      showBubble({
        id: "pet-react-double",
        message: pick(text().bubble.doubleClick),
        autoDismissMs: 2000
      });
      schedulePetReactionRevert(2100, returnState);
      break;
    case "longPress":
      if (holding) {
        cancelPetReactionRevert();
        setPetState("petted");
        showBubble({
          id: "pet-react-pet",
          message: pick(text().bubble.longPress),
          autoDismissMs: 2500
        });
      } else {
        schedulePetReactionRevert(1000, returnState);
      }
      break;
  }
}

function happyFeedback(message: string | null = pick(text().bubble.woof), after?: () => void): void {
  if (blockingMode) return;
  const returnState = focusActive ? "focusGuard" : "idle";
  lastInteractionAt = Date.now();
  bumpInteraction();
  maybeWakeUp();
  refreshMood();
  scheduleNextWander();
  scheduleNextChatter();
  setPetState("happy");
  if (message) {
    showBubble({ id: "happy", message, autoDismissMs: 1800 });
  }
  setTimeout(() => {
    hideBubble();
    setPetState(returnState);
    after?.();
  }, 1900);
}

function setUpdateCheck(next: UpdateCheckResult): void {
  updateCheck = next;
  publishSnapshot();
}

function openReleaseNotes(): void {
  void shell.openExternal(updateCheck.releaseUrl || RELEASES_URL).catch((error) => {
    console.error("Failed to open PawPal releases:", error);
  });
}

function showUpdateAvailableNotice(result: UpdateCheckResult): void {
  if (blockingMode || result.status !== "available" || !result.latestVersion) return;
  ensurePetWindowVisible();
  setPetState("happy");
  showBubble({
    id: "update-available",
    message: pick(text().bubble.updateAvailable)(result.latestVersion),
    actions: [
      { id: "app:open-release-notes", label: text().settings.openReleaseNotes, kind: "primary" }
    ],
    autoDismissMs: 12000
  });
  setTimeout(() => {
    if (!blockingMode && petState === "happy") setPetState(focusActive ? "focusGuard" : "idle");
  }, 12_100);
}

async function checkForUpdates(options: { notifyAvailable?: boolean } = {}): Promise<UpdateCheckResult> {
  const checking = createCheckingUpdateCheck(updateCheck);
  setUpdateCheck(checking);
  const result = await checkGitHubReleasesForUpdates(checking);
  setUpdateCheck(result);
  if (options.notifyAvailable) showUpdateAvailableNotice(result);
  return result;
}

function triggerBreakReminder(fromDemo: boolean): void {
  if (!fromDemo) {
    breakTimer = null;
    if (breakMutedToday) {
      breakDueAt = null;
      publishSnapshot();
      return;
    }
    if (blockingMode || focusActive) {
      publishSnapshot();
      return;
    }
  } else if (blockingMode === "focusWarning" || blockingMode === "breakRun") {
    return;
  }
  ensurePetWindowVisible();
  blockingMode = "break";
  breakDueAt = null;
  publishSnapshot();
  setPetState("breakPrompt");
  if (getSettings().soundEnabled) playSound("warning", true);
  const labels = text();
  showBubble({
    id: "break",
    message: pick(labels.bubble.breakReminder),
    actions: [
      { id: "break:done", label: labels.actions.breakDone, kind: "primary" },
      { id: "break:snooze", label: labels.actions.breakSnooze },
      { id: "break:mute", label: labels.actions.breakMute, kind: "danger" }
    ]
  });
}

function triggerHydrationReminder(fromDemo: boolean): void {
  if (!fromDemo) {
    hydrationTimer = null;
    if (blockingMode || focusActive) {
      publishSnapshot();
      return;
    }
  } else if (blockingMode) {
    return;
  }
  ensurePetWindowVisible();
  blockingMode = "hydration";
  hydrationDueAt = null;
  publishSnapshot();
  setPetState("hydrationPrompt");
  if (getSettings().soundEnabled) playSound("idleChatter", true);
  const labels = text();
  showBubble({
    id: "hydration",
    message: pick(labels.bubble.hydrationReminder),
    actions: [
      { id: "hydration:done", label: labels.actions.hydrationDone, kind: "primary" },
      { id: "hydration:snooze", label: labels.actions.hydrationSnooze }
    ]
  });
}

function triggerFocusWarning(rule?: string): void {
  if (blockingMode === "breakRun") return;
  ensurePetWindowVisible();
  if (!focusActive) startFocusMode();
  blockingMode = "focusWarning";
  updateStats((stats) => ({ ...stats, focusWarnings: stats.focusWarnings + 1 }));
  setPetState("focusAlert");
  if (getSettings().soundEnabled) playSound("warning", true);
  sendToAll("app:snapshot", snapshot());
  const labels = text();
  showBubble({
    id: "focus-warning",
    message: pick(labels.bubble.focusWarning)(rule ?? "?"),
    actions: [
      { id: "focus:back", label: labels.actions.focusBack, kind: "primary" },
      { id: "focus:end", label: labels.actions.focusEnd }
    ]
  });
}

function startFocusMode(): void {
  if (focusActive || blockingMode) return;
  ensurePetWindowVisible();
  const settings = getSettings();
  focusActive = true;
  focusStartedAt = Date.now();
  blockingMode = null;
  setPetState("focusGuard");
  focusEndsAt = Date.now() + settings.focusDurationMinutes * 60 * 1000;
  sendToAll("app:snapshot", snapshot());
  showBubble({
    id: "focus-start",
    message: pick(text().bubble.focusStart)(settings.focusDurationMinutes),
    autoDismissMs: 4500
  });
  if (focusTimer) clearTimeout(focusTimer);
  focusTimer = setTimeout(
    () => stopFocusMode(true),
    settings.focusDurationMinutes * 60 * 1000
  );
  scheduleDistractionDetection();
  updateTrayMenu();
}

function stopFocusMode(completed: boolean): void {
  if (!focusActive) return;
  const startedAt = focusStartedAt ?? Date.now();
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  focusActive = false;
  focusStartedAt = null;
  blockingMode = null;
  if (focusTimer) {
    clearTimeout(focusTimer);
    focusTimer = null;
  }
  focusEndsAt = null;
  scheduleDistractionDetection();
  updateStats((stats) => ({
    ...stats,
    focusMinutes: stats.focusMinutes + elapsedMinutes
  }));
  sendToAll("app:snapshot", snapshot());
  setPetState("focusDone");
  showBubble({
    id: "focus-complete",
    message: completed ? pick(text().bubble.focusComplete) : pick(text().bubble.focusCancelled),
    autoDismissMs: 2800
  });
  setTimeout(() => {
    if (!focusActive && !blockingMode) {
      if (showOverdueReminder()) return;
      hideBubble();
      setPetState("idle");
    }
  }, 2900);
  updateTrayMenu();
}

function triggerDemo(trigger: DemoTrigger): void {
  ensurePetWindowVisible();
  if (trigger === "break") triggerBreakReminder(true);
  if (trigger === "hydration") triggerHydrationReminder(true);
  if (trigger === "focusWarning") triggerFocusWarning("Twitter");
  if (trigger === "happy") happyFeedback(pick(text().bubble.woof));
}

function handleBubbleAction(actionId: string): void {
  if (actionId === "app:open-release-notes") {
    hideBubble();
    setPetState(focusActive ? "focusGuard" : "idle");
    openReleaseNotes();
    return;
  }
  if (actionId === "break-run:done") {
    finishBreakRun();
    return;
  }
  if (actionId === "break:done") {
    updateStats((stats) => ({ ...stats, breaksTaken: stats.breaksTaken + 1 }));
    startBreakRun();
    return;
  }
  if (actionId === "break:snooze") {
    resumeLongTermState();
    scheduleBreakReminderTimer(10 * 60 * 1000);
    return;
  }
  if (actionId === "break:mute") {
    breakMutedToday = true;
    breakDueAt = null;
    blockingMode = null;
    sendToAll("app:snapshot", snapshot());
    setPetState("sad");
    showBubble({ id: "break-muted", message: pick(text().bubble.breakIgnore), autoDismissMs: 2600 });
    setTimeout(resumeLongTermState, 2700);
    return;
  }
  if (actionId === "hydration:done") {
    updateStats((stats) => ({ ...stats, watersLogged: stats.watersLogged + 1 }));
    blockingMode = null;
    sendToAll("app:snapshot", snapshot());
    setPetState("drinking");
    hideBubble();
    setTimeout(() => {
      if (blockingMode) return;
      setPetState("hydrationDone");
      showBubble({ id: "hydration-complete", message: pick(text().bubble.hydrationDone), autoDismissMs: 1800 });
      setTimeout(() => {
        scheduleHydrationReminderTimer();
        if (showOverdueReminder()) return;
        hideBubble();
        setPetState(focusActive ? "focusGuard" : "idle");
      }, 1900);
    }, 2400);
    return;
  }
  if (actionId === "hydration:snooze") {
    resumeLongTermState();
    scheduleHydrationReminderTimer(15 * 60 * 1000);
    return;
  }
  if (actionId === "focus:back") {
    blockingMode = null;
    sendToAll("app:snapshot", snapshot());
    setPetState("focusGuard");
    showBubble({ id: "focus-back", message: pick(text().bubble.focusBack), autoDismissMs: 1800 });
    setTimeout(() => {
      if (focusActive && !blockingMode) hideBubble();
    }, 1900);
    return;
  }
  if (actionId === "focus:end") {
    stopFocusMode(false);
  }
}

function registerIpc(): void {
  ipcMain.handle("app:get-snapshot", () => snapshot());
  ipcMain.handle("app:check-for-updates", () => checkForUpdates({ notifyAvailable: true }));
  ipcMain.handle("custom-pet:select-asset", (_event, state: PetState) =>
    selectCustomPetAsset(state)
  );
  ipcMain.handle("custom-pet:import-asset", (_event, state: PetState, sourcePath: string) =>
    importCustomPetAsset(state, sourcePath)
  );
  ipcMain.on("app:open-release-notes", openReleaseNotes);
  ipcMain.handle("ai:test-connection", async (): Promise<{ ok: boolean; message: string }> => {
    const settings = getSettings();
    const client = createAiClient(settings.aiProvider, settings.aiApiKey);
    return client.testConnection();
  });
  ipcMain.handle(
    "outfit:import",
    async (
      _e,
      payload: { part: OutfitPart; sourcePath: string; label: string }
    ): Promise<OutfitItem | null> => {
      return importCustomOutfit(payload.part, payload.sourcePath, payload.label);
    }
  );
  ipcMain.handle("outfit:list-custom", (): OutfitItem[] => listCustomOutfits());
  ipcMain.handle(
    "backup:export",
    async (): Promise<string | null> => {
      try {
        const payload = {
          formatVersion: 1,
          exportedAt: Date.now(),
          settings: store.get("settings") ?? null,
          petGrowth: readGrowth(),
          petDiary: readDiary(),
          petRoster: readRoster(),
          petMoodHistory: readMoodHistory(),
          petPosition: store.get("petPosition") ?? null
        };
        const json = JSON.stringify(payload, null, 2);
        const parent = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null;
        const result = parent
          ? await dialog.showSaveDialog(parent, {
              title: "Export PawPal backup",
              defaultPath: `pawpal-backup-${new Date().toISOString().slice(0, 10)}.json`,
              filters: [{ name: "PawPal backup", extensions: ["json"] }]
            })
          : await dialog.showSaveDialog({
              title: "Export PawPal backup",
              defaultPath: `pawpal-backup-${new Date().toISOString().slice(0, 10)}.json`,
              filters: [{ name: "PawPal backup", extensions: ["json"] }]
            });
        if (result.canceled || !result.filePath) return null;
        const { writeFile } = await import("node:fs/promises");
        await writeFile(result.filePath, json, "utf-8");
        return result.filePath;
      } catch {
        return null;
      }
    }
  );
  ipcMain.handle(
    "backup:import",
    async (
      _e,
      payload: { sourcePath: string; mode: "merge" | "replace" }
    ): Promise<{ ok: boolean; message: string }> => {
      try {
        const { readFile } = await import("node:fs/promises");
        const text = await readFile(payload.sourcePath, "utf-8");
        const data = JSON.parse(text) as {
          formatVersion?: number;
          settings?: unknown;
          petGrowth?: PetGrowth;
          petDiary?: PetDiary;
          petRoster?: PetRoster;
          petMoodHistory?: MoodHistory;
          petPosition?: unknown;
        };
        if (data.formatVersion !== 1) {
          return { ok: false, message: `Unsupported backup version: ${data.formatVersion}` };
        }
        const settings = normalizeSettings(
          payload.mode === "replace" && data.settings
            ? (data.settings as Partial<Settings>)
            : { ...(store.get("settings") as Partial<Settings> | undefined), ...(data.settings as Partial<Settings> | undefined) }
        );
        if (data.settings) store.set("settings", settings);
        if (data.petGrowth) store.set("petGrowth", data.petGrowth);
        if (data.petDiary) store.set("petDiary", data.petDiary);
        if (data.petRoster) store.set(ROSTER_KEY, data.petRoster);
        if (data.petMoodHistory) store.set(MOOD_HISTORY_KEY, data.petMoodHistory);
        if (data.petPosition) store.set("petPosition", data.petPosition);
        sendToAll("app:snapshot", snapshot());
        return { ok: true, message: "已导入备份" };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error)
        };
      }
    }
  );
  ipcMain.handle(
    "outfit:select-file",
    async (_e, part: OutfitPart): Promise<string | null> => {
      try {
        const parent = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null;
        const result = parent
          ? await dialog.showOpenDialog(parent, {
              properties: ["openFile"],
              filters: [{ name: "PNG Images", extensions: ["png"] }]
            })
          : await dialog.showOpenDialog({
              properties: ["openFile"],
              filters: [{ name: "PNG Images", extensions: ["png"] }]
            });
        if (result.canceled || !result.filePaths[0]) return null;
        return result.filePaths[0];
      } catch {
        return null;
      }
    }
  );
  ipcMain.handle("diary:generate", async (): Promise<PetDiary> => {
    const settings = getSettings();
    const client = createAiClient(settings.aiProvider, settings.aiApiKey);
    const stats = getStats();
    const statsSummary =
      settings.language === "zh-CN"
        ? `专注 ${stats.focusMinutes} 分钟，休息 ${stats.breaksTaken} 次，喝水 ${stats.watersLogged} 次`
        : `focused ${stats.focusMinutes}m, breaks ${stats.breaksTaken}, waters ${stats.watersLogged}`;
    const appearanceName = petAppearanceLabel(settings.petAppearanceId, settings.language);
    const entry = await composeDiaryEntry(
      client,
      settings.language,
      statsSummary,
      petMood,
      appearanceName
    );
    const current = readDiary();
    const next = appendDiary(current, entry);
    store.set("petDiary", next);
    sendToAll("app:snapshot", snapshot());
    return next;
  });
  ipcMain.on("pet:clicked", () => {
    if (blockingMode) return;
    happyFeedback(null);
  });
  ipcMain.on(
    "pet:react",
    (_event, payload: { reaction: PetReaction; holding: boolean }) => {
      petReact(payload.reaction, payload.holding);
    }
  );
  ipcMain.on(
    "pet:play-catch",
    (_event, payload: { targetX: number; targetY: number }) => {
      petPlayCatch(payload.targetX, payload.targetY);
    }
  );
  ipcMain.handle("roster:list", (): PetRoster => readRoster());
  ipcMain.handle("chat:open", () => {
    createChatWindow();
  });
  ipcMain.handle(
    "chat:reply",
    async (
      _e,
      payload: { history: ChatMessage[]; language: Language }
    ): Promise<string> => {
      const settings = getSettings();
      const client = createAiClient(settings.aiProvider, settings.aiApiKey);
      if (!client.isConfigured()) {
        throw new Error("AI not configured");
      }
      const appearanceName = petAppearanceLabel(settings.petAppearanceId, settings.language);
      const systemPrompt =
        payload.language === "zh-CN"
          ? `你是一只名叫"${appearanceName}"的小型桌面宠物，正和主人自由聊天。` +
            `用第一人称、简短中文回复（<= 60 字），语气温暖、有点调皮。` +
            `不要用 markdown，不要用引号开头，不要说自己是 AI。`
          : `You are a tiny desktop pet named "${appearanceName}" chatting with your owner. ` +
            `Reply in first-person, in short English (under 60 words), warm and a little playful. ` +
            `Do not use markdown, do not start with quotes, do not mention being an AI.`;
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...payload.history.slice(-12) // keep last 12 turns for context
      ];
      return client.chat(messages);
    }
  );
  ipcMain.handle("roster:switch", (_event, petId: PetId): PetRoster => {
    commitActiveToRoster();
    const roster = readRoster();
    if (!roster.pets.some((p) => p.id === petId)) return roster;
    roster.activePetId = petId;
    writeRoster(roster);
    loadActiveFromRoster();
    sendToAll("app:snapshot", snapshot());
    return roster;
  });
  ipcMain.handle(
    "roster:add",
    (_event, label: string): PetRoster => {
      commitActiveToRoster();
      const roster = readRoster();
      const id = `pet-${Date.now().toString(36)}`;
      roster.pets.push({
        id,
        label: label.trim() || `Pet ${roster.pets.length + 1}`,
        state: "idle",
        facing: "right",
        mood: "calm",
        lastInteractionAt: null,
        appearanceId: defaultAppearanceId(),
        customPetAppearance: null,
        outfit: {},
        bornAt: Date.now(),
        totalInteractions: 0,
        transient: null
      });
      roster.activePetId = id;
      writeRoster(roster);
      loadActiveFromRoster();
      sendToAll("app:snapshot", snapshot());
      return roster;
    }
  );
  ipcMain.handle("roster:remove", (_event, petId: PetId): PetRoster => {
    const roster = readRoster();
    if (roster.pets.length <= 1) return roster;
    const filtered = roster.pets.filter((p) => p.id !== petId);
    const nextActive = roster.activePetId === petId ? filtered[0].id : roster.activePetId;
    roster.pets = filtered;
    roster.activePetId = nextActive;
    writeRoster(roster);
    if (roster.activePetId === petId) {
      loadActiveFromRoster();
    }
    sendToAll("app:snapshot", snapshot());
    return roster;
  });
  ipcMain.on("pet:context-menu", showPetContextMenu);
  ipcMain.on("pet:drag-start", (_event, offset: { offsetX: number; offsetY: number }) =>
    startPetDrag(offset)
  );
  ipcMain.on("pet:drag-stop", stopPetDrag);
  ipcMain.on("pet:set-mouse-interactive", (_event, interactive: boolean) => {
    setPetMouseInteractive(interactive);
  });
  ipcMain.on("bubble:action", (_event, actionId: string) => handleBubbleAction(actionId));
  ipcMain.on("settings:update", (_event, partial: Partial<Settings>) => {
    setSettings({ ...getSettings(), ...partial });
  });
  ipcMain.on("demo:trigger", (_event, trigger: DemoTrigger) => triggerDemo(trigger));
  ipcMain.on("focus:start", startFocusMode);
  ipcMain.on("focus:stop", () => stopFocusMode(false));
  ipcMain.on("stats:reset-today", resetTodayStats);
}

protocol.registerSchemesAsPrivileged([
  { scheme: "pawpal-asset", privileges: { bypassCSP: true, supportFetchAPI: true } }
]);

app.whenReady().then(() => {
  protocol.handle("pawpal-asset", (request) => {
    let relativePath = "";
    try {
      const url = new URL(request.url);
      relativePath = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    } catch {
      return new Response("Invalid asset URL", { status: 404 });
    }

    const appBase = app.isPackaged ? process.resourcesPath : process.cwd();
    const builtInAssetRoot = resolve(appBase, "pet_assets");
    const customAssetRoot = resolve(app.getPath("userData"), "custom_pet_assets");
    const customOutfitRoot = resolve(app.getPath("userData"), "custom_outfits");
    const assetPath = relativePath.startsWith("custom_pet_assets/")
      ? resolve(app.getPath("userData"), relativePath)
      : relativePath.startsWith("custom_outfits/")
        ? resolve(app.getPath("userData"), relativePath)
        : resolve(appBase, relativePath);
    const isInsideBuiltInAssetRoot =
      assetPath === builtInAssetRoot || assetPath.startsWith(`${builtInAssetRoot}${sep}`);
    const isInsideCustomAssetRoot =
      assetPath === customAssetRoot || assetPath.startsWith(`${customAssetRoot}${sep}`);
    const isInsideCustomOutfitRoot =
      assetPath === customOutfitRoot || assetPath.startsWith(`${customOutfitRoot}${sep}`);

    if (!isInsideBuiltInAssetRoot && !isInsideCustomAssetRoot && !isInsideCustomOutfitRoot) {
      return new Response("Asset not found", { status: 404 });
    }

    return net.fetch(pathToFileURL(assetPath).href);
  });

  getStats();
  registerIpc();
  createPetWindow();
  createTray();
  registerDisplayChangeHandlers();
  scheduleReminderTimers();
  scheduleDistractionDetection();
  refreshMood();
  recordMoodSample(new Date());
  setInterval(refreshMood, 60_000);
  scheduleMoodHistoryFlush();
  scheduleNextWander();
  scheduleNextChatter();
  if (IS_DEV) {
    createSettingsWindow();
  }
  // Local-only fork: no auto-update check on launch.

  app.on("activate", () => {
    if (!petWindow) createPetWindow();
  });
});

app.on("before-quit", () => {
  for (const timer of [
    breakRunTimer,
    breakRunCountdownTimer,
    breakRunMovementTimer,
    breakTimer,
    hydrationTimer,
    focusTimer,
    distractionTimer,
    distractionStartupTimer,
    displayChangeTimer,
    bubbleTimer,
    dragTimer,
    dragSafetyTimer
  ]) {
    if (timer) clearTimeout(timer);
  }
});

app.on("window-all-closed", () => {
  // Keep the menu-bar utility alive after the settings window is closed.
});
