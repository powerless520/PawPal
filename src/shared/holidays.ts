// Festive calendar shared by the main process (bubble reminders) and the
// settings renderer (countdown display). Dates are fixed single-day targets
// chosen to mirror the seasonal outfit windows in outfits.ts.
export type HolidayKey =
  | "newYear"
  | "springFestival"
  | "valentines"
  | "arborDay"
  | "easter"
  | "laborDay"
  | "childrensDay"
  | "midAutumn"
  | "nationalDay"
  | "halloween"
  | "thanksgiving"
  | "christmas";

export const HOLIDAY_KEYS: readonly HolidayKey[] = [
  "newYear",
  "springFestival",
  "valentines",
  "arborDay",
  "easter",
  "laborDay",
  "childrensDay",
  "midAutumn",
  "nationalDay",
  "halloween",
  "thanksgiving",
  "christmas"
];

export const HOLIDAY_DATES: Record<HolidayKey, { month: number; day: number }> = {
  newYear: { month: 1, day: 1 },
  springFestival: { month: 2, day: 1 },
  valentines: { month: 2, day: 14 },
  arborDay: { month: 3, day: 12 },
  easter: { month: 4, day: 15 },
  laborDay: { month: 5, day: 1 },
  childrensDay: { month: 6, day: 1 },
  midAutumn: { month: 9, day: 15 },
  nationalDay: { month: 10, day: 1 },
  halloween: { month: 10, day: 31 },
  thanksgiving: { month: 11, day: 25 },
  christmas: { month: 12, day: 25 }
};

export type NextHolidayEvent = {
  key: HolidayKey | "birthday";
  daysUntil: number;
  isToday: boolean;
};

// Returns the next festive event at or after `now` (today counts as 0 days),
// or null when no fixed date and no user birthday are configured.
export function nextHolidayEvent(
  now: Date,
  userBirthday?: { month: number; day: number } | null
): NextHolidayEvent | null {
  const candidates: Array<{ key: HolidayKey | "birthday"; month: number; day: number }> = [
    ...HOLIDAY_KEYS.map((key) => ({ key, ...HOLIDAY_DATES[key] }))
  ];
  if (userBirthday?.month && userBirthday?.day) {
    candidates.push({ key: "birthday", month: userBirthday.month, day: userBirthday.day });
  }

  const todayDay = now.getDate();
  const nowMonth = now.getMonth() + 1;
  const currentStamp = nowMonth * 100 + todayDay;

  let best: NextHolidayEvent | null = null;
  for (const candidate of candidates) {
    const stamp = candidate.month * 100 + candidate.day;
    let days = daysBetween(now, stamp);
    if (days < 0) {
      // Already passed this year -> next occurrence is next year.
      days = daysBetween(now, stamp, 1);
    }
    if (stamp === currentStamp) days = 0;
    if (best === null || days < best.daysUntil) {
      best = { key: candidate.key, daysUntil: days, isToday: days === 0 };
    }
  }
  return best;
}

function daysBetween(now: Date, monthDayStamp: number, yearOffset = 0): number {
  const month = Math.floor(monthDayStamp / 100);
  const day = monthDayStamp % 100;
  const target = Date.UTC(now.getFullYear() + yearOffset, month - 1, day);
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - start) / 86_400_000);
}
