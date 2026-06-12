import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ error: "Please enter a valid email address." }),
  password: z.string().min(8, { error: "Password must be at least 8 characters." }),
});

export const signupSchema = z
  .object({
    email: z.email({ error: "Please enter a valid email address." }),
    password: z
      .string()
      .min(8, { error: "Password must be at least 8 characters." }),
    confirm: z
      .string()
      .min(1, { error: "Please confirm your password." }),
  })
  .refine((data) => data.password === data.confirm, {
    error: "Passwords do not match.",
    path: ["confirm"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
