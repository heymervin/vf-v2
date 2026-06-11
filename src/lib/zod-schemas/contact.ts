import { z } from "zod";

/** Treat empty strings (react-hook-form's default for blank inputs) as absent. */
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

/**
 * Contact create/edit input. Shared by the create + update server actions.
 * `budget` is captured in major units (pounds) for humans; the action converts
 * to `budget_minor` (integer pence) before it touches the DB.
 */
export const contactInputSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, { error: "First name is required." })
    .max(100, { error: "First name must be 100 characters or less." }),
  last_name: optionalText(100),
  email: z.preprocess(
    emptyToUndefined,
    z.email({ error: "Enter a valid email address." }).optional(),
  ),
  phone: optionalText(40),
  partner_first_name: optionalText(100),
  partner_last_name: optionalText(100),
  wedding_date: z.preprocess(emptyToUndefined, z.iso.date().optional()),
  wedding_date_flexible: z.boolean().default(false),
  guest_count: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "Guest count must be a number." })
      .int({ error: "Guest count must be a whole number." })
      .min(0, { error: "Guest count cannot be negative." })
      .max(100000, { error: "That guest count looks too high." })
      .optional(),
  ),
  budget: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "Budget must be a number." })
      .min(0, { error: "Budget cannot be negative." })
      .max(10000000, { error: "That budget looks too high." })
      .optional(),
  ),
  source: optionalText(80),
});

export type ContactInput = z.input<typeof contactInputSchema>;
export type ContactParsed = z.output<typeof contactInputSchema>;
