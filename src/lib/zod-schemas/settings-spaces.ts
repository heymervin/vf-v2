import { z } from "zod";

export const spaceSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Space name must be at least 2 characters." })
    .max(100, { message: "Space name must be 100 characters or less." })
    .trim(),
  capacity_seated: z
    .number({ message: "Must be a number." })
    .int()
    .min(0)
    .nullable()
    .optional(),
  capacity_standing: z
    .number({ message: "Must be a number." })
    .int()
    .min(0)
    .nullable()
    .optional(),
  description: z
    .string()
    .max(500, { message: "Description must be 500 characters or less." })
    .optional(),
});

export type SpaceInput = z.infer<typeof spaceSchema>;
