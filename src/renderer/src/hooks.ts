import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../../shared/constants";
import { MAIN_PET_ID } from "../../shared/types";
import type { AppSnapshot, TodayStats } from "../../shared/types";

const initialStats: TodayStats = {
  date: "",
  breaksTaken: 0,
  watersLogged: 0,
  focusMinutes: 0,
  focusWarnings: 0
};

export function useSnapshot(): AppSnapshot {
  const [snapshot, setSnapshot] = useState<AppSnapshot>({
    appInfo: {
      version: "",
      releaseNotesUrl: ""
    },
    updateCheck: {
      status: "idle",
      currentVersion: "",
      latestVersion: null,
      releaseUrl: "",
      checkedAt: null,
      error: null
    },
    settings: DEFAULT_SETTINGS,
    stats: initialStats,
    statsHistory: {},
    timers: {
      breakDueAt: null,
      hydrationDueAt: null,
      focusEndsAt: null
    },
    distraction: {
      state: "idle",
      activeApp: "",
      activeWindowTitle: "",
      matchedRule: null,
      lastCheckedAt: null,
      lastWarningAt: null,
      error: null
    },
    petState: "idle",
    petFacing: "right",
    petMood: "calm",
    lastInteractionAt: null,
    pets: {
      [MAIN_PET_ID]: {
        id: MAIN_PET_ID,
        label: "Main",
        state: "idle",
        facing: "right",
        mood: "calm",
        lastInteractionAt: null,
        appearanceId: DEFAULT_SETTINGS.petAppearanceId,
        customPetAppearance: null,
        outfit: {},
        bornAt: 0,
        totalInteractions: 0,
        transient: null
      }
    },
    petDiary: { entries: [] },
    petGrowth: { bornAt: 0, totalInteractions: 0, lastMilestone: null },
    petMoodHistory: { samples: [] },
    petStats: {
      totalClicks: 0,
      totalDrags: 0,
      totalRightClicks: 0,
      longestLongPressMs: 0,
      lastVisitAt: null,
      seenEasterEggs: []
    },
    activePetId: MAIN_PET_ID,
    petRoster: {
      activePetId: MAIN_PET_ID,
      pets: [
        {
          id: MAIN_PET_ID,
          label: "Main",
          state: "idle",
          facing: "right",
          mood: "calm",
          lastInteractionAt: null,
          appearanceId: DEFAULT_SETTINGS.petAppearanceId,
          customPetAppearance: null,
          outfit: {},
          bornAt: 0,
          totalInteractions: 0,
          transient: null
        }
      ]
    },
    blockingMode: null,
    focusActive: false,
    dogVisible: true
  });

  useEffect(() => {
    let mounted = true;
    void window.pawpal.getSnapshot().then((next) => {
      if (mounted) setSnapshot(next);
    });
    const offPet = window.pawpal.onPetState((petState) =>
      setSnapshot((current) => ({ ...current, petState }))
    );
    const offSettings = window.pawpal.onSettingsUpdated((settings) =>
      setSnapshot((current) => ({ ...current, settings }))
    );
    const offStats = window.pawpal.onStatsUpdated((stats) =>
      setSnapshot((current) => ({ ...current, stats }))
    );
    const offSnapshot = window.pawpal.onSnapshot(setSnapshot);
    return () => {
      mounted = false;
      offPet();
      offSettings();
      offStats();
      offSnapshot();
    };
  }, []);

  return snapshot;
}

export function useNow(refreshMs = 30_000): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), refreshMs);
    return () => window.clearInterval(timer);
  }, [refreshMs]);

  return now;
}
