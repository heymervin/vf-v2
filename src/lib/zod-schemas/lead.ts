import { z } from "zod";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

/**
 * Public enquiry-form input. Only the couple's name + email are required;
 * everything else is optional (highest conversion). `website` is a honeypot —
 * real users never fill it. UTM/referrer come from hidden fields.
 */
export const leadFormSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, { error: "Please tell us your name." })
    .max(100),
  last_name: optionalText(100),
  email: z.preprocess(
    emptyToUndefined,
    z.email({ error: "Enter a valid email address." }),
  ),
  phone: optionalText(40),
  partner_first_name: optionalText(100),
  partner_last_name: optionalText(100),
  wedding_date: z.preprocess(
    emptyToUndefined,
    z.iso
      .date()
      .refine(
        (v) => v >= new Date().toISOString().slice(0, 10),
        { error: "Please choose a date today or in the future." },
      )
      .optional(),
  ),
  wedding_date_flexible: z.coerce.boolean().optional().default(false),
  // Optional field: never hard-fail on junk input. Coerce + floor to a whole
  // number (e.g. "12.7" → 12); empty / un-parseable / out-of-range values
  // simply drop to undefined rather than blocking the whole submission.
  guest_count: z.preprocess((v) => {
    const t = emptyToUndefined(v);
    if (t === undefined) return undefined;
    const n = typeof t === "string" || typeof t === "number" ? Number(t) : NaN;
    return Number.isFinite(n) ? Math.floor(n) : t;
  }, z.coerce.number().int().min(0).max(100000).optional().catch(undefined)),
  message: optionalText(2000),
  // Attribution (hidden fields)
  utm_source: optionalText(120),
  utm_medium: optionalText(120),
  utm_campaign: optionalText(120),
  source: optionalText(120),
  referrer: optionalText(500),
  // Honeypot — must be empty.
  website: optionalText(200),
});

export type LeadFormInput = z.input<typeof leadFormSchema>;
export type LeadFormParsed = z.output<typeof leadFormSchema>;
