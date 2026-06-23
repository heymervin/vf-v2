"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

/**
 * Couple Portal login — magic-link only (no password auth, per spec §2.3).
 *
 * A returning couple enters their email and receives a fresh magic link that
 * lands on /portal/auth/magic-link, which establishes the session and
 * redirects into /portal. shouldCreateUser is false: only couples already
 * invited (their auth user already exists) can sign in here.
 */
export default function PortalLoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address to get a sign-in link.");
      return;
    }
    setPending(true);
    setError(null);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${appUrl}/portal/auth/magic-link`,
      },
    });

    setPending(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
              Check your email
            </CardTitle>
            <CardDescription>
              We sent a sign-in link to {email}. Click it to open your wedding
              portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSent(false)}
            >
              Use a different email
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
          Your wedding portal
        </CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a secure link to sign in. No
          password needed.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending link..." : "Email me a sign-in link"}
          </Button>
        </form>
      </CardContent>
    </Card>
    </main>
  );
}
