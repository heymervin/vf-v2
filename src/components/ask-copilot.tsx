"use client"

import * as React from "react"
import { toast } from "sonner"
import { ArrowRightIcon, SparklesIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopilotQuestion {
  id: string
  label: string
  category?: string
}

export interface AskCopilotProps {
  questions: CopilotQuestion[]
  onAsk?: (q: CopilotQuestion) => void
  triggerClassName?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AskCopilot({
  questions,
  onAsk,
  triggerClassName,
}: AskCopilotProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  // Cmd/Ctrl-K listener
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  // Reset query when the dialog closes (handled in onOpenChange, not an effect).
  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setQuery("")
  }

  function handleSelect(q: CopilotQuestion) {
    setOpen(false)
    if (onAsk) {
      onAsk(q)
    } else {
      toast(`Copilot: "${q.label}"`, {
        description: "Prototype — response would appear here.",
        duration: 3500,
      })
    }
  }

  function handleFreeText() {
    if (!query.trim()) return
    const freeQ: CopilotQuestion = { id: "__free__", label: query.trim() }
    handleSelect(freeQ)
  }

  // Group questions by category
  const categorised = React.useMemo(() => {
    const map = new Map<string, CopilotQuestion[]>()
    for (const q of questions) {
      const cat = q.category ?? "Suggestions"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(q)
    }
    return map
  }, [questions])

  const categories = Array.from(categorised.keys())
  const hasFreeText = query.trim().length > 0

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Ask Copilot (Cmd K)"
        className={cn(
          "gap-2 text-muted-foreground hover:text-foreground",
          triggerClassName
        )}
      >
        <SparklesIcon className="size-3.5 shrink-0" />
        <span>Ask Copilot</span>
        <kbd className="ml-1 hidden rounded border border-border bg-muted px-1 py-px text-[10px] font-mono text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </Button>

      {/* Command dialog */}
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Ask Copilot"
        description="Search or ask a question about your venue data"
      >
        <CommandInput
          placeholder="Ask anything about your weddings, pipeline, or revenue…"
          value={query}
          onValueChange={setQuery}
        />

        <CommandList>
          <CommandEmpty className="text-muted-foreground">
            {query.trim()
              ? "Press Enter to ask this question."
              : "No suggestions found."}
          </CommandEmpty>

          {/* Free-text row — appears at top when user is typing */}
          {hasFreeText && (
            <>
              <CommandGroup heading="Ask">
                <CommandItem
                  key="__free__"
                  value={`ask: ${query}`}
                  onSelect={handleFreeText}
                  className="gap-2"
                >
                  <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {query}
                  </span>
                  <span className="text-xs text-muted-foreground">Ask</span>
                </CommandItem>
              </CommandGroup>
              {categories.length > 0 && <CommandSeparator />}
            </>
          )}

          {/* Categorised suggestions */}
          {categories.map((cat, i) => (
            <React.Fragment key={cat}>
              <CommandGroup heading={cat}>
                {categorised.get(cat)!.map((q) => (
                  <CommandItem
                    key={q.id}
                    value={q.label}
                    onSelect={() => handleSelect(q)}
                    className="gap-2"
                  >
                    <SparklesIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-foreground">
                      {q.label}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {i < categories.length - 1 && <CommandSeparator />}
            </React.Fragment>
          ))}
        </CommandList>

        {/* Quiet footer hint */}
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <span className="text-[11px] text-muted-foreground">
            Powered by VenueFlow Copilot
          </span>
          <span className="text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[10px]">Esc</kbd>{" "}
            to close
          </span>
        </div>
      </CommandDialog>
    </>
  )
}
