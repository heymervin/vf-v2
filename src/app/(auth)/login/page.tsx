"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/zod-schemas/auth";
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

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  missing_code: "That sign-in link has expired or was already used. Please request a new one.",
  callback_failed: "Something went wrong completing your sign-in. Please try again.",
  no_user: "We couldn't find an account linked to that sign-in. Please try a different method.",
};

// Only /accept-invite/* is allowed as a post-auth redirect to prevent open-redirect.
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (/^\/accept-invite\/[0-9a-f-]+$/i.test(decoded)) return decoded;
  } catch {
    // ignore malformed %xx
  }
  return null;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  const callbackErrorMessage = callbackError
    ? (CALLBACK_ERROR_MESSAGES[callbackError] ?? "Sign-in failed. Please try again.")
    : null;
  const next = safeNext(searchParams.get("next"));

  const [serverError, setServerError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkPending, setMagicLinkPending] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    router.push(next ?? "/dashboard");
    router.refresh();
  }

  async function handleMagicLink() {
    const email = getValues("email");
    if (!email) {
      setServerError("Enter your email address first, then request a magic link.");
      return;
    }
    setMagicLinkPending(true);
    setServerError(null);
    const supabase = createClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const callbackUrl = next
      ? `${origin}/callback?next=${encodeURIComponent(next)}`
      : `${origin}/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: callbackUrl,
      },
    });
    setMagicLinkPending(false);
    if (error) {
      setServerError(error.message);
      return;
    }
    setMagicLinkSent(true);
  }

  if (magicLinkSent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
            Check your email
          </CardTitle>
          <CardDescription>
            We sent a sign-in link to your email address. Click it to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setMagicLinkSent(false)}
          >
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
          Sign in
        </CardTitle>
        <CardDescription>
          Welcome back. Enter your details to continue.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Callback error (e.g. expired/used magic link) */}
          {callbackErrorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {callbackErrorMessage}
            </p>
          )}

          {/* Server-level error */}
          {serverError && (
            <p className="text-sm text-destructive" role="alert">
              {serverError}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@venue.com"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="At least 8 characters"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Primary CTA — signature pink-to-navy per DESIGN.md */}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>

          {/* Magic link — secondary action */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={magicLinkPending || isSubmitting}
            onClick={handleMagicLink}
          >
            {magicLinkPending ? "Sending link..." : "Email me a magic link"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link
            href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
