import type { GrowthMilestoneKind, PetGrowth, PetGrowthStage, StatsHistory, TodayStats } from "./types";

const DAY_MS = 86_400_000;

export type GrowthStageDef = {
  id: PetGrowthStage;
  requireDays: number;
  requireInteractions: number;
};

/**
 * Companion-stage ladder: each stage needs BOTH the number of days spent
 * together AND the total number of interactions to unlock.
 */
export const GROWTH_STAGES: readonly GrowthStageDef[] = [
  { id: "acquaintance", requireDays: 0, requireInteractions: 0 },
  { id: "companion", requireDays: 3, requireInteractions: 25 },
  { id: "closeFriend", requireDays: 14, requireInteractions: 150 },
  { id: "soulmate", requireDays: 60, requireInteractions: 600 }
];

export const STAGE_ORDER: readonly PetGrowthStage[] = GROWTH_STAGES.map((stage) => stage.id);

export function stageRank(stage: PetGrowthStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/** Whole days spent together (day of birth counts as day 1). */
export function daysKnown(bornAt: number, now: number): number {
  if (!bornAt || bornAt <= 0) return 0;
  return Math.max(0, Math.floor((now - bornAt) / DAY_MS)) + 1;
}

/** Highest stage whose requirements are met. */
export function stageFor(days: number, interactions: number): PetGrowthStage {
  let current: PetGrowthStage = "acquaintance";
  for (const def of GROWTH_STAGES) {
    if (days >= def.requireDays && interactions >= def.requireInteractions) current = def.id;
  }
  return current;
}

/** The next stage after the requirements currently met (or null at max). */
export function nextStageOf(days: number, interactions: number): GrowthStageDef | null {
  const idx = STAGE_ORDER.indexOf(stageFor(days, interactions));
  return GROWTH_STAGES[idx + 1] ?? null;
}

// Milestone catalog ------------------------------------------------------
// A milestone is a one-time badge. IDs are stable strings that the i18n/UI
// layers render (age-7, interactions-100, breaks-500, waters-200, focus-600).

export const AGE_MILESTONE_DAYS: readonly number[] = [1, 3, 7, 14, 30, 60, 100];
export const INTERACTION_MILESTONES: readonly number[] = [10, 50, 100, 250, 500, 1000, 2500, 5000];
export const HEALTH_BREAK_MILESTONES: readonly number[] = [100, 500];
export const HEALTH_WATER_MILESTONES: readonly number[] = [100, 500];
export const HEALTH_FOCUS_MINUTE_MILESTONES: readonly number[] = [600, 3000];

export const ALL_MILESTONE_IDS: readonly string[] = [
  ...AGE_MILESTONE_DAYS.map((d) => `age-${d}`),
  ...INTERACTION_MILESTONES.map((n) => `interactions-${n}`),
  ...HEALTH_BREAK_MILESTONES.map((n) => `breaks-${n}`),
  ...HEALTH_WATER_MILESTONES.map((n) => `waters-${n}`),
  ...HEALTH_FOCUS_MINUTE_MILESTONES.map((m) => `focus-${m}`)
];

export type GrowthTotals = {
  breaks: number;
  waters: number;
  focusMinutes: number;
};

/** Lifetime health behaviour totals = today + archived history. */
export function healthTotals(stats: TodayStats, history: StatsHistory): GrowthTotals {
  let breaks = stats.breaksTaken;
  let waters = stats.watersLogged;
  let focusMinutes = stats.focusMinutes;
  for (const day of Object.values(history)) {
    breaks += day.breaksTaken ?? 0;
    waters += day.watersLogged ?? 0;
    focusMinutes += day.focusMinutes ?? 0;
  }
  return { breaks, waters, focusMinutes };
}

export function kindOfMilestone(id: string): GrowthMilestoneKind {
  if (id.startsWith("age-")) return "age";
  if (id.startsWith("interactions-")) return "interaction";
  return "health";
}

/** All milestone ids currently satisfied by this pet's data. */
export function eligibleMilestoneIds(growth: PetGrowth, totals: GrowthTotals, now: number): string[] {
  const ids: string[] = [];
  const days = daysKnown(growth.bornAt, now);
  for (const d of AGE_MILESTONE_DAYS) if (days >= d) ids.push(`age-${d}`);
  for (const n of INTERACTION_MILESTONES) if (growth.totalInteractions >= n) ids.push(`interactions-${n}`);
  for (const n of HEALTH_BREAK_MILESTONES) if (totals.breaks >= n) ids.push(`breaks-${n}`);
  for (const n of HEALTH_WATER_MILESTONES) if (totals.waters >= n) ids.push(`waters-${n}`);
  for (const m of HEALTH_FOCUS_MINUTE_MILESTONES) if (totals.focusMinutes >= m) ids.push(`focus-${m}`);
  return ids;
}

/**
 * Fill in defaults for a persisted growth record. Old records (pre-growth
 * extension) or backup-imported records missing new fields are normalized
 * here; the stage itself is NEVER auto-raised by this function — raising and
 * celebrating is the job of the main-process advancement logic.
 */
export function normalizeGrowth(raw: Partial<PetGrowth> | undefined, now: number): PetGrowth {
  const bornAt = typeof raw?.bornAt === "number" && raw.bornAt > 0 ? raw.bornAt : now;
  const totalInteractions = typeof raw?.totalInteractions === "number" ? raw.totalInteractions : 0;
  const stage = raw?.stage && STAGE_ORDER.includes(raw.stage) ? raw.stage : "acquaintance";
  return {
    bornAt,
    totalInteractions,
    lastMilestone: typeof raw?.lastMilestone === "string" ? raw.lastMilestone : null,
    stage,
    stageChangedAt: typeof raw?.stageChangedAt === "number" ? raw.stageChangedAt : null,
    milestones: Array.isArray(raw?.milestones) ? raw.milestones : []
  };
}
