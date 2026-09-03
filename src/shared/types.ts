export type Language = "zh-CN" | "en";

export type BuiltInPetAppearanceId = "lovartPuppy" | "lineDog" | "xiaoJiMao" | "dino" | "totodile";

export type PetAppearanceId = BuiltInPetAppearanceId | "custom";

export type PetFacing = "left" | "right";

export type PetState =
  | "idle"
  | "sitting"
  | "happy"
  | "petted"
  | "walking"
  | "breakPrompt"
  | "breakRunning"
  | "breakDone"
  | "hydrationPrompt"
  | "drinking"
  | "hydrationDone"
  | "focusGuard"
  | "focusAlert"
  | "focusDone"
  | "sad"
  | "sleeping";

export type PetReaction = "single" | "double" | "longPress" | "play";

// Detail sent with single / double so the main process can count
// streaks (5 in a row, 100 lifetime) without having to re-implement
// timing in the renderer.
export type PetReactPayload =
  | { reaction: "single" }
  | { reaction: "double" }
  | { reaction: "longPress"; holding: boolean; durationMs?: number }
  | { reaction: "play" };

export type PetAction = "dance" | "sing" | "spin" | "heart" | "stretch" | "wave" | "shy" | "yawn";

export type PetMood = "energetic" | "playful" | "calm" | "sleepy" | "bored";

export type MoodSample = {
  // 1-hour bucket start (epoch ms)
  bucket: number;
  mood: PetMood;
};

export type MoodHistory = {
  // Last 7 days, one entry per hour bucket. Old buckets get pruned.
  samples: MoodSample[];
};

export type AiProvider = "none" | "deepseek" | "ollama";

export type PetId = string;

export const MAIN_PET_ID: PetId = "main";

export type PetInstance = {
  id: PetId;
  label: string;
  state: PetState;
  facing: PetFacing;
  mood: PetMood;
  lastInteractionAt: number | null;
  appearanceId: PetAppearanceId;
  customPetAppearance: CustomPetAppearance | null;
  outfit: Outfit;
  bornAt: number;
  totalInteractions: number;
  transient: {
    state: PetState;
    facing: PetFacing;
    mood: PetMood;
    lastInteractionAt: number | null;
  } | null;
};

export type PetRoster = {
  activePetId: PetId;
  pets: PetInstance[];
};

export type ActivePetSnapshot = {
  id: PetId;
  state: PetState;
  facing: PetFacing;
  mood: PetMood;
  lastInteractionAt: number | null;
  appearanceId: PetAppearanceId;
  customPetAppearance: CustomPetAppearance | null;
  outfit: Outfit;
};

export type OutfitPart = "hat" | "glasses" | "scarf" | "bow";

export type Outfit = Partial<Record<OutfitPart, string>>;

export type OutfitMode = "manual" | "seasonal";

export type OutfitItem = {
  id: string;
  part: OutfitPart;
  label: Record<Language, string>;
  relativePath: string;
  custom?: boolean;
};

export type OutfitSlot = {
  part: OutfitPart;
  label: Record<Language, string>;
  items: OutfitItem[];
};

export type DiaryEntry = {
  date: string;
  body: string;
  generatedAt: number;
  source: "ai" | "fallback";
};

export type PetDiary = {
  entries: DiaryEntry[];
};

export type PetGrowth = {
  bornAt: number;
  totalInteractions: number;
  lastMilestone: string | null;
};

export type EasterEgg =
  | "click5"
  | "click100"
  | "click500"
  | "longPress10s"
  | "rightClick50"
  | "threePets"
  | "wakeByDrag"
  | "comeback"
  | "lateNight";

export type PetStats = {
  totalClicks: number;
  totalDrags: number;
  totalRightClicks: number;
  longestLongPressMs: number;
  lastVisitAt: number | null;
  seenEasterEggs: EasterEgg[];
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiTestResult = {
  ok: boolean;
  message: string;
};

export type CustomPetAsset = {
  relativePath: string;
  originalName: string;
  updatedAt: number;
};

export type CustomPetAppearance = {
  name: string;
  assets: Partial<Record<PetState, CustomPetAsset>>;
};

export type BubbleAction = {
  id: string;
  label: string;
  kind?: "primary" | "secondary" | "danger";
};

export type SpeechBubble = {
  id: string;
  message: string;
  actions?: BubbleAction[];
  autoDismissMs?: number;
};

export type BlockingMode = "break" | "breakRun" | "hydration" | "focusWarning" | null;

export type Settings = {
  language: Language;
  petAppearanceId: PetAppearanceId;
  customPetAppearance: CustomPetAppearance | null;
  onboardingDismissed: boolean;
  launchAtLoginEnabled: boolean;
  checkUpdatesOnLaunchEnabled: boolean;
  breakReminderEnabled: boolean;
  breakIntervalMinutes: number;
  breakRunDurationSeconds: number;
  hydrationReminderEnabled: boolean;
  hydrationIntervalMinutes: number;
  focusDurationMinutes: number;
  distractionDetectionEnabled: boolean;
  distractionGraceSeconds: number;
  distractionBlockedApps: string[];
  distractionBlockedKeywords: string[];
  aiProvider: AiProvider;
  aiApiKey: string;
  outfit: Outfit;
  outfitMode: OutfitMode;
  soundEnabled: boolean;
  ttsEnabled: boolean;
  ttsRate: number;
  ttsVoice: string | null;
  easterEggsEnabled: boolean;
  birthdayMonth: number | null;
  birthdayDay: number | null;
};

export type TodayStats = {
  date: string;
  breaksTaken: number;
  watersLogged: number;
  focusMinutes: number;
  focusWarnings: number;
};

export type StatsHistory = Record<string, TodayStats>;

export type TimerStatus = {
  breakDueAt: number | null;
  hydrationDueAt: number | null;
  focusEndsAt: number | null;
};

export type DistractionStatus = {
  state: "idle" | "watching" | "permission-needed" | "unsupported" | "error";
  activeApp: string;
  activeWindowTitle: string;
  matchedRule: string | null;
  lastCheckedAt: number | null;
  lastWarningAt: number | null;
  error: string | null;
};

export type AppSnapshot = {
  appInfo: AppInfo;
  updateCheck: UpdateCheckResult;
  settings: Settings;
  stats: TodayStats;
  statsHistory: StatsHistory;
  timers: TimerStatus;
  distraction: DistractionStatus;
  petState: PetState;
  petFacing: PetFacing;
  petMood: PetMood;
  lastInteractionAt: number | null;
  pets: Record<PetId, PetInstance>;
  activePetId: PetId;
  petRoster: PetRoster;
  petDiary: PetDiary;
  petGrowth: PetGrowth;
  petMoodHistory: MoodHistory;
  petStats: PetStats;
  blockingMode: BlockingMode;
  focusActive: boolean;
  dogVisible: boolean;
};

export type AppInfo = {
  version: string;
  releaseNotesUrl: string;
};

export type UpdateCheckStatus =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "error";

export type UpdateCheckResult = {
  status: UpdateCheckStatus;
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string;
  checkedAt: number | null;
  error: string | null;
};

export type DemoTrigger =
  | "break"
  | "hydration"
  | "focusWarning"
  | "happy";

export type RendererEventMap = {
  "pet:set-state": PetState;
  "pet:show-bubble": SpeechBubble;
  "pet:hide-bubble": void;
  "settings:updated": Settings;
  "stats:updated": TodayStats;
  "app:snapshot": AppSnapshot;
};
