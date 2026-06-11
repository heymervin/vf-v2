import type { HourRow } from "@/lib/zod-schemas/onboarding";

/**
 * Default hours: Mon-Sat open 09:00-17:00, Sunday closed.
 * weekday int: 0=Sunday, 1=Monday ... 6=Saturday (matches venue_hours.weekday)
 */
export const DEFAULT_HOURS: HourRow[] = [
  { weekday: 1, open: true, open_time: "09:00", close_time: "17:00" },
  { weekday: 2, open: true, open_time: "09:00", close_time: "17:00" },
  { weekday: 3, open: true, open_time: "09:00", close_time: "17:00" },
  { weekday: 4, open: true, open_time: "09:00", close_time: "17:00" },
  { weekday: 5, open: true, open_time: "09:00", close_time: "17:00" },
  { weekday: 6, open: true, open_time: "09:00", close_time: "17:00" },
  { weekday: 0, open: false, open_time: null, close_time: null },
];
