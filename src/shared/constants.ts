import type { PetAction, PetStats, Settings, TodayStats } from "./types";

/** Stable iteration order for the eight pet actions (must match `PetAction`). */
export const PET_ACTION_ORDER: readonly PetAction[] = [
  "dance",
  "sing",
  "spin",
  "heart",
  "stretch",
  "wave",
  "shy",
  "yawn"
];

export function createEmptyActionCounts(): Record<PetAction, number> {
  return {
    dance: 0,
    sing: 0,
    spin: 0,
    heart: 0,
    stretch: 0,
    wave: 0,
    shy: 0,
    yawn: 0
  };
}

export const DEFAULT_SETTINGS: Settings = {
  language: "zh-CN",
  petAppearanceId: "lineDog",
  customPetAppearance: null,
  onboardingDismissed: false,
  launchAtLoginEnabled: false,
  checkUpdatesOnLaunchEnabled: false,
  breakReminderEnabled: true,
  breakIntervalMinutes: 45,
  breakRunDurationSeconds: 60,
  hydrationReminderEnabled: true,
  hydrationIntervalMinutes: 90,
  focusDurationMinutes: 25,
  distractionDetectionEnabled: false,
  distractionGraceSeconds: 8,
  aiProvider: "none",
  aiApiKey: "",
  outfit: {},
  outfitMode: "seasonal",
  soundEnabled: true,
  ttsEnabled: true,
  ttsRate: 1,
  ttsVoice: null,
  easterEggsEnabled: true,
  theme: "default",
  observerMode: false,
  birthdayMonth: null,
  birthdayDay: null,
  distractionBlockedApps: ["Steam", "Discord", "Telegram", "WeChat", "QQ"],
  distractionBlockedKeywords: [
    "youtube",
    "youtu.be",
    "twitter",
    "x.com",
    "instagram",
    "reddit",
    "tiktok",
    "netflix",
    "twitch",
    "facebook",
    "bilibili",
    "weibo",
    "douyin",
    "xiaohongshu",
    "zhihu",
    "douban",
    "taobao",
    "jd.com",
    "小红书",
    "微博",
    "抖音",
    "知乎",
    "豆瓣",
    "淘宝",
    "京东",
    "哔哩哔哩",
    "虎扑",
    "贴吧"
  ]
};

export function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createEmptyStats(date = todayKey()): TodayStats {
  return {
    date,
    breaksTaken: 0,
    watersLogged: 0,
    focusMinutes: 0,
    focusWarnings: 0,
    launches: 0,
    workStartMinute: null,
    actionCounts: createEmptyActionCounts(),
    habitNotes: []
  };
}

/**
 * Back-fills habit fields (T1.8) on stats saved by older versions, so legacy
 * archives are upgraded in place the first time they are touched.
 */
export function normalizeTodayStats(stats: TodayStats): TodayStats {
  const empty = createEmptyStats(stats.date || todayKey());
  return {
    ...empty,
    date: stats.date || empty.date,
    breaksTaken: stats.breaksTaken ?? 0,
    watersLogged: stats.watersLogged ?? 0,
    focusMinutes: stats.focusMinutes ?? 0,
    focusWarnings: stats.focusWarnings ?? 0,
    launches: stats.launches ?? 0,
    workStartMinute: stats.workStartMinute ?? null,
    actionCounts: stats.actionCounts
      ? { ...createEmptyActionCounts(), ...stats.actionCounts }
      : createEmptyActionCounts(),
    habitNotes: Array.isArray(stats.habitNotes) ? stats.habitNotes : []
  };
}

export function createEmptyPetStats(): PetStats {
  return {
    totalClicks: 0,
    totalDrags: 0,
    totalRightClicks: 0,
    longestLongPressMs: 0,
    lastVisitAt: null,
    seenEasterEggs: []
  };
}
