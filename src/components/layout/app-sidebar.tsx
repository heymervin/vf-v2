"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  BarChart3,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  X,
  Heart,
  Banknote,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOut } from "@/app/(app)/actions";

// ---------------------------------------------------------------------------
// Nav structure — grouped by workflow. Dashboard is the home; the rest cluster
// into CRM (people + scheduling), Weddings (booked workspace + money), and
// Insights. No Pipeline: V2 has no pre-sales stages — GHL owns pre-sales.
// ---------------------------------------------------------------------------

type NavLink = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navSections: { heading?: string; items: NavLink[] }[] = [
  { items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    heading: "CRM",
    items: [
      { label: "Contacts", href: "/contacts", icon: Users },
      { label: "Appointments", href: "/appointments", icon: CalendarDays },
    ],
  },
  {
    heading: "Weddings",
    items: [
      { label: "Weddings", href: "/weddings", icon: Heart },
      { label: "Money", href: "/money", icon: Banknote },
    ],
  },
  {
    heading: "Insights",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Copilot", href: "/copilot", icon: Sparkles },
    ],
  },
];

const secondaryNav: NavLink[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AppSidebarProps {
  venueName: string;
  userEmail: string | undefined;
}

// ---------------------------------------------------------------------------
// Shared nav item — used in both expanded sidebar and icon rail
// ---------------------------------------------------------------------------

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  collapsed = false,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // 44px touch target on coarse pointers (DESIGN.md)
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 min-h-[44px] pointer-coarse:min-h-[44px]",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground hover:bg-white/10",
        collapsed && "justify-center px-2",
      )}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
    >
      <Icon className="size-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sidebar inner content — shared between desktop and mobile sheet
// ---------------------------------------------------------------------------

function SidebarContent({
  venueName,
  userEmail,
  collapsed = false,
  onNavClick,
}: AppSidebarProps & { collapsed?: boolean; onNavClick?: () => void }) {
  const pathname = usePathname();

  const initial = (userEmail ?? "V").charAt(0).toUpperCase();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Wordmark / V-mark */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border px-4",
          collapsed && "justify-center px-2",
        )}
      >
        {collapsed ? (
          <span className="text-lg font-bold tracking-tight text-sidebar-primary">
            V
          </span>
        ) : (
          <span className="text-base font-bold tracking-tight text-sidebar-primary">
            VenueFlow
          </span>
        )}
      </div>

      {/* Primary nav — grouped sections */}
      <nav
        className="flex flex-1 flex-col overflow-y-auto px-3 py-4"
        aria-label="Main navigation"
      >
        {navSections.map((section, i) => (
          <div
            key={section.heading ?? "home"}
            className={cn("flex flex-col gap-1", i > 0 && "mt-4")}
          >
            {section.heading && !collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/40">
                {section.heading}
              </p>
            )}
            {section.items.map((item) => (
              <span key={item.href} onClick={onNavClick}>
                <NavItem
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={isActive(item.href)}
                  collapsed={collapsed}
                />
              </span>
            ))}
          </div>
        ))}

        <Separator className="my-3 bg-sidebar-border" />

        {secondaryNav.map((item) => (
          <span key={item.href} onClick={onNavClick}>
            <NavItem
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          </span>
        ))}
      </nav>

      {/* User block */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/10 min-h-[44px]",
                collapsed && "justify-center",
              )}
              aria-label="User menu"
            >
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sidebar-foreground">
                    {venueName}
                  </p>
                  <p className="truncate text-xs text-sidebar-foreground/60">
                    {userEmail}
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onSelect={async () => {
                await signOut();
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop sidebar — full width with collapsible icon rail on tablet
// ---------------------------------------------------------------------------

function DesktopSidebar({ venueName, userEmail }: AppSidebarProps) {
  return (
    <>
      {/* Tablet: icon rail (md) */}
      <aside className="hidden md:flex lg:hidden w-[64px] shrink-0 flex-col border-r border-sidebar-border">
        <SidebarContent
          venueName={venueName}
          userEmail={userEmail}
          collapsed={true}
        />
      </aside>

      {/* Desktop: full sidebar (lg+) */}
      <aside className="hidden lg:flex w-[220px] shrink-0 flex-col border-r border-sidebar-border">
        <SidebarContent venueName={venueName} userEmail={userEmail} />
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Mobile topbar + sheet sidebar
// ---------------------------------------------------------------------------

function MobileNav({ venueName, userEmail }: AppSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex md:hidden h-14 shrink-0 items-center border-b border-border bg-background px-4">
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
          side="bottom"
          className="p-0 h-auto max-h-[80dvh] rounded-t-xl bg-sidebar border-sidebar-border"
          showCloseButton={false}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent
            venueName={venueName}
            userEmail={userEmail}
            onNavClick={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <span className="ml-3 text-sm font-semibold tracking-tight text-foreground">
        VenueFlow
      </span>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Public export — composes both into one component
// ---------------------------------------------------------------------------

export function AppSidebar({ venueName, userEmail }: AppSidebarProps) {
  return (
    <>
      <DesktopSidebar venueName={venueName} userEmail={userEmail} />
      <MobileNav venueName={venueName} userEmail={userEmail} />
    </>
  );
}
