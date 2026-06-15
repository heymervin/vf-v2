"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsNavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export interface SettingsNavGroup {
  label: string
  items: SettingsNavItem[]
}

export interface SettingsShellProps {
  groups: SettingsNavGroup[]
  title?: string
  children: React.ReactNode
}

// ---------------------------------------------------------------------------
// Rail nav — shared by desktop aside and mobile Sheet
// ---------------------------------------------------------------------------

function SettingsRail({
  groups,
  onNavClick,
}: {
  groups: SettingsNavGroup[]
  onNavClick?: () => void
}) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <nav
      aria-label="Settings navigation"
      className="flex flex-col gap-1 px-3 py-4"
    >
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {group.label}
          </p>

          {group.items.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavClick}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-accent-foreground" : "text-muted-foreground"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function SettingsShell({ groups, title, children }: SettingsShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* ------------------------------------------------------------------ */}
      {/* Desktop: persistent left rail ~220px                                */}
      {/* ------------------------------------------------------------------ */}
      <aside className="hidden lg:flex lg:w-[220px] lg:shrink-0 lg:flex-col lg:border-r lg:border-border">
        {title && (
          <div className="border-b border-border px-6 py-5">
            <h1 className="text-base font-semibold text-foreground">{title}</h1>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          <SettingsRail groups={groups} />
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile: sticky top bar with sheet trigger                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex lg:hidden shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open settings navigation"
            >
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>

          <SheetContent
            side="left"
            className="w-[260px] p-0 bg-background"
            showCloseButton={false}
          >
            <SheetHeader className="border-b border-border px-6 py-5">
              <SheetTitle className="text-base font-semibold text-foreground">
                {title ?? "Settings"}
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto">
              <SettingsRail
                groups={groups}
                onNavClick={() => setMobileOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>

        {title && (
          <span className="text-sm font-semibold text-foreground">{title}</span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content pane                                                         */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-[1400px] py-6 lg:pl-6">
          {children}
        </div>
      </main>
    </div>
  )
}
