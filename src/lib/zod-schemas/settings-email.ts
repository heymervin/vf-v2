import { z } from "zod";

export const emailSettingsSchema = z.object({
  from_name: z
    .string()
    .min(1, { message: "Display name is required." })
    .max(100, { message: "Display name must be 100 characters or less." })
    .trim(),
  reply_to: z
    .string()
    .email({ message: "Please enter a valid email address." })
    .trim(),
});

export type EmailSettingsInput = z.infer<typeof emailSettingsSchema>;
