import { PET_ACTION_ORDER } from "./constants";
import type { PetAction, TodayStats } from "./types";

/**
 * T1.8 — habit learning.
 *
 * The pet records three things about the current day inside `TodayStats`
 * (launches, workStartMinute, actionCounts) and, at most once per day each,
 * references them through three gated mention points:
 *   - "launch": second (or later) launch of the day, from the launch greeting
 *   - "workStart": how early the user started focusing today (idle chatter)
 *   - "focus:<n>": whole-hour focus milestones, right after a focus session
 *   - "favAction": the most-used pet action today (idle chatter)
 *
 * Everything below is pure so it can be unit-tested without Electron.
 */

export const FAV_ACTION_MIN_COUNT = 3;
/** Only talk about today's work start once at least this many minutes have passed. */
export const WORK_START_MENTION_DELAY_MIN = 90;

export function minuteOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function noteAlreadyTaken(notes: readonly string[], note: string): boolean {
  return notes.includes(note);
}

export function markHabitNote(stats: TodayStats, note: string): TodayStats {
  if (noteAlreadyTaken(stats.habitNotes, note)) return stats;
  return { ...stats, habitNotes: [...stats.habitNotes, note] };
}

/** Whether the pet may reference today's work-start time (not yet said, and late enough). */
export function canMentionWorkStart(stats: TodayStats, now = new Date()): boolean {
  if (stats.workStartMinute === null) return false;
  if (noteAlreadyTaken(stats.habitNotes, "workStart")) return false;
  return minuteOfDay(now) - stats.workStartMinute >= WORK_START_MENTION_DELAY_MIN;
}

/** Whole-hour milestone reached by accumulated focus minutes (0 → none yet). */
export function focusHourMilestone(totalMinutes: number): number {
  return Math.floor(totalMinutes / 60);
}

/** The newly crossed whole-hour focus milestone after this session, or null. */
export function crossedFocusHour(beforeMinutes: number, afterMinutes: number): number | null {
  const after = focusHourMilestone(afterMinutes);
  if (after >= 1 && after > focusHourMilestone(beforeMinutes)) return after;
  return null;
}

export function focusNoteFor(milestone: number): string {
  return `focus:${milestone}`;
}

/**
 * The most-used action today when it clearly stands out (at least
 * `minCount` uses), otherwise null. Ties resolve to the first action in
 * PET_ACTION_ORDER so the result is stable.
 */
export function favoriteAction(
  stats: TodayStats,
  minCount = FAV_ACTION_MIN_COUNT
): { action: PetAction; count: number } | null {
  let bestAction: PetAction | null = null;
  let bestCount = 0;
  for (const action of PET_ACTION_ORDER) {
    const count = stats.actionCounts[action] ?? 0;
    if (count > bestCount) {
      bestCount = count;
      bestAction = action;
    }
  }
  if (bestAction === null || bestCount < minCount) return null;
  return { action: bestAction, count: bestCount };
}
