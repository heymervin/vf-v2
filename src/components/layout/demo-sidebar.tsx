"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Kanban,
  Users,
  Banknote,
  Heart,
  Clock,
  Grid3x3,
  UserCheck,
  Utensils,
  Truck,
  Sparkles,
  BarChart3,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { VENUE } from "@/lib/mock";

// ---------------------------------------------------------------------------
// Grouped nav — the full v2 combined platform (PRODUCT.md › module map)
// ---------------------------------------------------------------------------

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string | null; items: NavItem[] };

const NAV: NavGroup[] = [
  { label: null, items: [{ label: "Overview", href: "/preview", icon: LayoutDashboard }] },
  {
    label: "Sales & Marketing",
    items: [
      { label: "Unified Inbox", href: "/preview/inbox", icon: MessageSquare },
      { label: "Pipeline", href: "/preview/pipeline", icon: Kanban },
      { label: "Contacts", href: "/preview/contacts", icon: Users },
    ],
  },
  {
    label: "Booking & Money",
    items: [{ label: "Proposals & Payments", href: "/preview/money", icon: Banknote }],
  },
  {
    label: "Wedding Planning",
    items: [
      { label: "Weddings", href: "/preview/weddings", icon: Heart },
      { label: "Run-sheet", href: "/preview/runsheet", icon: Clock },
      { label: "Floor plan", href: "/preview/floorplan", icon: Grid3x3 },
      { label: "Guests", href: "/preview/guests", icon: UserCheck },
      { label: "Menu", href: "/preview/menu", icon: Utensils },
      { label: "Suppliers", href: "/preview/suppliers", icon: Truck },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Copilot", href: "/preview/copilot", icon: Sparkles },
      { label: "Reports", href: "/preview/reports", icon: BarChart3 },
    ],
  },
];

function NavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 min-h-[44px]",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground hover:bg-white/10",
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

function SidebarBody({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/preview" ? pathname === "/preview" : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Wordmark */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <span className="text-base font-bold tracking-tight text-sidebar-primary">
          VenueFlow
        </span>
        <span className="rounded-full border border-sidebar-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/70">
          v2 preview
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Main">
        {NAV.map((group, gi) => (
          <div key={group.label ?? `g${gi}`} className="flex flex-col gap-1">
            {group.label && (
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/40">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                onClick={onNavClick}
              />
            ))}
          </div>
        ))}

        <Separator className="my-3 bg-sidebar-border" />

        {/* Couple portal — different audience, opens its own chrome */}
        <Link
          href="/portal"
          target="_blank"
          onClick={onNavClick}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-white/10 min-h-[44px]"
        >
          <Heart className="size-5 shrink-0 text-fun-pink" />
          <span>Couple Portal</span>
          <ExternalLink className="ml-auto size-3.5 opacity-60" />
        </Link>
      </nav>

      {/* Venue block */}
      <div className="shrink-0 border-t border-sidebar-border p-4">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{VENUE.name}</p>
        <p className="truncate text-xs text-sidebar-foreground/60">Prototype · seeded data</p>
      </div>
    </div>
  );
}

export function DemoSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-[232px] shrink-0 flex-col border-r border-sidebar-border">
        <SidebarBody />
      </aside>

      {/* Mobile top bar + sheet */}
      <header className="flex lg:hidden h-14 shrink-0 items-center border-b border-border bg-background px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className="flex size-11 items-center justify-center rounded-md text-foreground hover:bg-muted"
              aria-label="Open navigation"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[260px] p-0 bg-sidebar border-sidebar-border"
            showCloseButton={false}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <SidebarBody onNavClick={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="ml-3 text-sm font-semibold tracking-tight text-foreground">
          VenueFlow <span className="text-muted-foreground">v2 preview</span>
        </span>
      </header>
    </>
  );
}
