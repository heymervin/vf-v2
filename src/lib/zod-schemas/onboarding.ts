import { z } from "zod";

// Slug: ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$ — mirrors DB constraint
export const slugSchema = z
  .string()
  .min(3, { error: "Web address must be at least 3 characters." })
  .max(50, { error: "Web address must be 50 characters or less." })
  .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, {
    error:
      "Use lowercase letters, numbers, and hyphens only. Must start and end with a letter or number.",
  });

export const step1Schema = z.object({
  name: z
    .string()
    .min(2, { error: "Venue name must be at least 2 characters." })
    .max(100, { error: "Venue name must be 100 characters or less." })
    .trim(),
  slug: slugSchema,
  timezone: z.string().min(1, { error: "Please select a timezone." }),
  // logo is handled separately as a File — not in the schema proper
});

export type Step1Input = z.infer<typeof step1Schema>;

export const step2Schema = z.object({
  name: z
    .string()
    .min(2, { error: "Space name must be at least 2 characters." })
    .max(100, { error: "Space name must be 100 characters or less." })
    .trim(),
  capacity_seated: z
    .number({ error: "Must be a number." })
    .int()
    .min(0)
    .nullable()
    .optional(),
  capacity_standing: z
    .number({ error: "Must be a number." })
    .int()
    .min(0)
    .nullable()
    .optional(),
  description: z
    .string()
    .max(500, { error: "Description must be 500 characters or less." })
    .optional(),
});

export type Step2Input = z.infer<typeof step2Schema>;

// weekday: 0=Sunday, 1=Monday ... 6=Saturday (matches venue_hours.weekday)
export const hourRowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  open: z.boolean(),
  open_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  close_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
});

export const step3Schema = z.object({
  rows: z.array(hourRowSchema).length(7),
});

export type Step3Input = z.infer<typeof step3Schema>;
export type HourRow = z.infer<typeof hourRowSchema>;
