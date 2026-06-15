"use client"

import * as React from "react"
import { CheckIcon, UserPlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssigneeTeamMember {
  id: string
  name: string
  initials: string
  role: string
}

export interface AssigneePopoverProps {
  team: AssigneeTeamMember[]
  currentOwnerId?: string
  onAssign: (id: string) => void
  trigger?: React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssigneePopover({
  team,
  currentOwnerId,
  onAssign,
  trigger,
}: AssigneePopoverProps) {
  const [open, setOpen] = React.useState(false)

  const current = team.find((m) => m.id === currentOwnerId)

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={current ? `Assigned to ${current.name}` : "Assign team member"}
      title={current ? current.name : "Assign"}
    >
      {current ? (
        <Avatar size="sm">
          <AvatarFallback className="text-[10px] font-semibold bg-accent text-accent-foreground">
            {current.initials}
          </AvatarFallback>
        </Avatar>
      ) : (
        <UserPlusIcon className="size-4 text-muted-foreground" />
      )}
    </Button>
  )

  function handleSelect(id: string) {
    onAssign(id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Wrap in a span so custom trigger nodes also get asChild passthrough */}
        {trigger ? (
          <span className="inline-flex">{trigger}</span>
        ) : (
          defaultTrigger
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 p-1.5"
      >
        {/* Header */}
        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Assign to
        </p>

        <div className="flex flex-col gap-0.5">
          {team.map((member) => {
            const isSelected = member.id === currentOwnerId
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelect(member.id)}
                className={cn(
                  "flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected && "bg-accent"
                )}
              >
                <Avatar size="sm">
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-semibold",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {member.initials}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {member.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.role}
                  </p>
                </div>

                {isSelected && (
                  <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden />
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
