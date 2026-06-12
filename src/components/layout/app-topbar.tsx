import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface AppTopbarProps {
  venueName: string;
  userEmail: string | undefined;
}

/**
 * Slim topbar shown on desktop/tablet alongside the sidebar.
 * Shows current venue name (static for M1 — switcher comes when multi-venue exists)
 * and a user avatar initial on the right.
 * Hidden on mobile; the sidebar's MobileNav handles that breakpoint.
 */
export function AppTopbar({ venueName, userEmail }: AppTopbarProps) {
  const initial = (userEmail ?? "V").charAt(0).toUpperCase();

  return (
    <header className="hidden md:flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <p className="text-sm font-medium text-muted-foreground">{venueName}</p>
      <Avatar className="size-8">
        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
          {initial}
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
