"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  action: (formData: FormData) => Promise<{ error?: string }>;
}

export function PortalLoginForm({ action }: Props) {
  const [sent, setSent] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await action(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl bg-card px-6 py-8 shadow-sm ring-1 ring-border/60 text-center">
        <p className="text-lg font-semibold text-foreground">Check your email</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a sign-in link to your inbox. Click it to access your wedding
          portal.
        </p>
        <Button
          variant="outline"
          className="mt-5 w-full"
          onClick={() => setSent(false)}
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-card px-6 py-8 shadow-sm ring-1 ring-border/60 space-y-4"
    >
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending link..." : "Send magic link"}
      </Button>
    </form>
  );
}
