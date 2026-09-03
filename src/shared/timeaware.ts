export type TimeAwareKind =
  | "fridayEvening"
  | "lateNight"
  | "morning"
  | "noon"
  | "evening"
  | "weekend"
  | "timeNow"
  | "chatter";

/**
 * Classifies the current moment so the pet can say a time-appropriate line:
 * special moments (Friday evening, late night, morning, lunch, evening,
 * weekend days) win over a generic "check the clock" message.
 */
export function timeAwareKind(now: Date): TimeAwareKind {
  const day = now.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
  const hour = now.getHours();
  const minute = now.getMinutes();

  if (day === 5 && hour >= 17 && hour < 20) return "fridayEvening";
  if (hour >= 22 || hour < 5) return "lateNight";
  if (hour >= 5 && hour < 8) return "morning";
  if (hour >= 12 && hour < 14) return "noon";
  if (hour >= 17 && hour < 20) return "evening";
  if ((day === 0 || day === 6) && hour >= 9 && hour < 22) return "weekend";
  // Near the top of an hour → the pet states the time.
  if (minute <= 15 || minute >= 45) return "timeNow";
  return "chatter";
}

export type Season = "spring" | "summer" | "autumn" | "winter";

/** Northern-hemisphere season from the month (1-12). */
export function seasonOfMonth(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}
