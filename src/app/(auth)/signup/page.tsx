"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/zod-schemas/auth";
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

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  async function onSubmit(values: SignupInput) {
    setServerError(null);
    const supabase = createClient();

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";

    const callbackUrl = next
      ? `${origin}/callback?next=${encodeURIComponent(next)}`
      : `${origin}/callback`;

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    // If Supabase email confirmation is disabled, a session is returned immediately
    if (data.session) {
      // Invited users go back to the invite link; new owners go to onboarding
      router.push(next ?? "/onboarding");
      router.refresh();
      return;
    }

    // Email confirmation is enabled — show inline check-your-email state
    setConfirmationPending(true);
  }

  if (confirmationPending) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
            Check your email
          </CardTitle>
          <CardDescription>
            We sent a confirmation link to your email address. Click it to
            activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setConfirmationPending(false)}
          >
            Back to sign up
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
          Create your account
        </CardTitle>
        <CardDescription>
          Get started with VenueFlow. No credit card required.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
              autoComplete="new-password"
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

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Same password again"
              aria-invalid={!!errors.confirm}
              {...register("confirm")}
            />
            {errors.confirm && (
              <p className="text-xs text-destructive">
                {errors.confirm.message}
              </p>
            )}
          </div>

          {/* Primary CTA — signature pink-to-navy per DESIGN.md */}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
