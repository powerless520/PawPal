import { createEmptyStats, normalizeTodayStats, PET_ACTION_ORDER, todayKey } from "../shared/constants";
import type { StatsHistory, TodayStats } from "../shared/types";

export type StatsStore = {
  get(key: "stats", defaultValue: TodayStats): TodayStats;
  get(key: "statsHistory", defaultValue: StatsHistory): StatsHistory;
  set(key: "stats", value: TodayStats): void;
  set(key: "statsHistory", value: StatsHistory): void;
};

export function getStatsHistory(store: StatsStore): StatsHistory {
  return store.get("statsHistory", {});
}

export function isSameStats(left: TodayStats | undefined, right: TodayStats): boolean {
  if (!left || left.date !== right.date) return false;
  if (
    left.breaksTaken !== right.breaksTaken ||
    left.watersLogged !== right.watersLogged ||
    left.focusMinutes !== right.focusMinutes ||
    left.focusWarnings !== right.focusWarnings ||
    left.launches !== right.launches ||
    left.workStartMinute !== right.workStartMinute
  ) {
    return false;
  }
  for (const action of PET_ACTION_ORDER) {
    if ((left.actionCounts[action] ?? 0) !== (right.actionCounts[action] ?? 0)) return false;
  }
  return sameNotes(left.habitNotes ?? [], right.habitNotes ?? []);
}

function sameNotes(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((note, i) => note === b[i]);
}

export function saveStatsToHistory(store: StatsStore, stats: TodayStats): void {
  if (!stats.date) return;
  const history = getStatsHistory(store);
  if (isSameStats(history[stats.date], stats)) return;
  store.set("statsHistory", {
    ...history,
    [stats.date]: stats
  });
}

export function getCurrentStats(store: StatsStore, date = todayKey()): TodayStats {
  const stats = normalizeTodayStats(store.get("stats", createEmptyStats()));
  if (stats.date !== date) {
    saveStatsToHistory(store, stats);
    const current = getStatsHistory(store)[date] ?? createEmptyStats(date);
    const normalized = normalizeTodayStats(current);
    store.set("stats", normalized);
    saveStatsToHistory(store, normalized);
    return normalized;
  }

  saveStatsToHistory(store, stats);
  return stats;
}

export function updateCurrentStats(
  store: StatsStore,
  mutator: (stats: TodayStats) => TodayStats
): TodayStats {
  const next = normalizeTodayStats(mutator(getCurrentStats(store)));
  store.set("stats", next);
  saveStatsToHistory(store, next);
  return next;
}

export function resetCurrentStats(store: StatsStore, date = todayKey()): TodayStats {
  const reset = createEmptyStats(date);
  store.set("stats", reset);
  saveStatsToHistory(store, reset);
  return reset;
}
