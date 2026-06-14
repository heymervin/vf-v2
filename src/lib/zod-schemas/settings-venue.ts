import { z } from "zod";
import { slugSchema } from "./onboarding";

export const venueProfileSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Venue name must be at least 2 characters." })
    .max(100, { message: "Venue name must be 100 characters or less." })
    .trim(),
  slug: slugSchema,
  timezone: z.string().min(1, { message: "Please select a timezone." }),
  // logo handled separately as FormData File — not included here
});

export type VenueProfileInput = z.infer<typeof venueProfileSchema>;

// weekday: 0=Sunday, 1=Monday ... 6=Saturday (matches venue_hours.weekday)
// PostgREST serialises time as "HH:MM:SS"; accept both and normalise to "HH:MM"
const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/)
  .transform((v) => v.slice(0, 5));

export const hourRowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  open: z.boolean(),
  open_time: timeStringSchema.nullable(),
  close_time: timeStringSchema.nullable(),
});

export const venueHoursSchema = z.object({
  rows: z.array(hourRowSchema).length(7),
});

export type VenueHourRow = z.infer<typeof hourRowSchema>;
