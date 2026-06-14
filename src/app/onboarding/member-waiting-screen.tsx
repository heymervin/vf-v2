"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/(app)/actions";

export function MemberWaitingScreen() {
  const router = useRouter();

  return (
    <div className="flex h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-base font-medium text-foreground">
          Your venue is still being set up by the owner.
        </p>
        <p className="text-sm text-muted-foreground">
          You will get access as soon as they finish.
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="block w-full text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Refresh
        </button>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
