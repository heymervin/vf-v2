"use server";

import { createClient } from "@/lib/supabase/server";

export async function sendPortalMagicLink(
  formData: FormData,
): Promise<{ error?: string }> {
  const email = formData.get("email");
  if (!email || typeof email !== "string" || !email.trim()) {
    return { error: "Email address is required." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${appUrl}/api/portal/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}
