"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { AccessState } from "@/lib/tenant";

interface AccessBannerProps {
  access: AccessState;
  trialEndsAt: string | null;
}

function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400_000));
}

/**
 * App-shell banner for trial and access state.
 *
 * trialing  → dismissible-per-session info bar showing days remaining
 * past_due  → non-dismissible warning bar
 * expired   → non-dismissible destructive bar (read-only enforcement)
 * active    → renders nothing
 */
export function AccessBanner({ access, trialEndsAt }: AccessBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (access === "active") return null;
  if (access === "trialing" && dismissed) return null;

  const days = daysLeft(trialEndsAt);

  if (access === "trialing") {
    return (
      <div className="flex items-center justify-between gap-4 bg-[oklch(0.906_0.073_319)] px-6 py-2.5 text-sm text-[oklch(0.217_0.053_269)]">
        <p className="font-medium">
          {days !== null && days > 0
            ? `Free trial — ${days} day${days === 1 ? "" : "s"} remaining.`
            : "Your free trial ends today."}{" "}
          <Link
            href="/settings/billing"
            className="underline underline-offset-2 hover:no-underline"
          >
            Subscribe to keep access.
          </Link>
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss banner"
          className="shrink-0 rounded p-0.5 hover:bg-black/10"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (access === "past_due") {
    return (
      <div className="flex items-center gap-4 bg-[oklch(0.938_0.051_81)] px-6 py-2.5 text-sm text-[oklch(0.477_0.09_76)]">
        <p className="font-medium">
          Your subscription payment is overdue.{" "}
          <Link
            href="/settings/billing"
            className="underline underline-offset-2 hover:no-underline"
          >
            Update your billing details.
          </Link>
        </p>
      </div>
    );
  }

  // expired
  return (
    <div className="flex items-center gap-4 bg-[oklch(0.594_0.186_25)] px-6 py-2.5 text-sm text-[oklch(0.985_0.004_273)]">
      <p className="font-medium">
        Your account is read-only — trial has ended.{" "}
        <Link
          href="/settings/billing"
          className="underline underline-offset-2 hover:no-underline"
        >
          Subscribe to restore access.
        </Link>
      </p>
    </div>
  );
}
