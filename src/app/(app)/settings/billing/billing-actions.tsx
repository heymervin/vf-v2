"use client";

import { useActionState } from "react";
import { startCheckout, openPortal } from "./actions";
import type { ActionResult } from "@/lib/actions";

const initialState: ActionResult<void> = { ok: true, data: undefined };

export function CheckoutButton() {
  const [state, formAction, pending] = useActionState(startCheckout, initialState);

  return (
    <form action={formAction}>
      {state && !state.ok && (
        <p className="mb-3 text-sm text-destructive">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-[oklch(0.906_0.073_319)] px-5 text-sm font-semibold text-[oklch(0.217_0.053_269)] transition-colors hover:bg-[oklch(0.217_0.053_269)] hover:text-[oklch(0.985_0.004_273)] disabled:opacity-50"
      >
        {pending ? "Loading..." : "Subscribe now"}
      </button>
    </form>
  );
}

export function PortalButton() {
  const [state, formAction, pending] = useActionState(openPortal, initialState);

  return (
    <form action={formAction}>
      {state && !state.ok && (
        <p className="mb-3 text-sm text-destructive">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Loading..." : "Manage subscription"}
      </button>
    </form>
  );
}
