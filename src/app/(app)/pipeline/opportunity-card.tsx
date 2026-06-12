"use client";

import * as React from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Users, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGES, type PipelineStage } from "@/lib/pipeline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatWeddingDate } from "../contacts/format";
import type { BoardOpportunity } from "./types";

interface CardProps {
  opportunity: BoardOpportunity;
  overlay?: boolean;
  celebrating?: boolean;
  onSelect?: (opp: BoardOpportunity) => void;
  onMoveToStage?: (id: string, toStage: PipelineStage) => void;
}

function CardBody({
  opportunity,
  overlay,
  celebrating,
  onSelect,
  onMoveToStage,
  dragging,
  setNodeRef,
  style,
  attributes,
  listeners,
}: CardProps & {
  dragging?: boolean;
  setNodeRef?: (el: HTMLElement | null) => void;
  style?: React.CSSProperties;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners?: any;
}) {
  const o = opportunity;
  const date = formatWeddingDate(o.weddingDate);

  return (
    <div
      ref={setNodeRef}
      style={style}
      aria-label={o.name}
      {...attributes}
      {...listeners}
      onClick={() => onSelect?.(o)}
      className={cn(
        "group relative cursor-grab touch-none rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-shadow",
        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging && "opacity-40",
        overlay && "cursor-grabbing rotate-[1.5deg] shadow-md",
        celebrating && "animate-celebrate",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {o.name}
          </p>
          {o.partnerName && (
            <p className="truncate text-xs text-muted-foreground">
              & {o.partnerName}
            </p>
          )}
        </div>

        {!overlay && onMoveToStage && (
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Card actions"
              className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 pointer-coarse:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Move to stage</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {STAGES.filter((s) => s.value !== o.stage).map((s) => (
                    <DropdownMenuItem
                      key={s.value}
                      onSelect={() => onMoveToStage(o.id, s.value)}
                    >
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/contacts/${o.contactId}`}>Open full contact</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Calendar className="size-3" />
          {date ?? "No date"}
        </span>
        {o.guestCount != null && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Users className="size-3" />
            {o.guestCount}
          </span>
        )}
      </div>

      {o.source && (
        <span className="mt-2 inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {o.source}
        </span>
      )}
    </div>
  );
}

function SortableCard(props: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.opportunity.id });

  return (
    <CardBody
      {...props}
      dragging={isDragging}
      setNodeRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      attributes={attributes}
      listeners={listeners}
    />
  );
}

/** Memoized so a 200-card column doesn't re-render every card on each move. */
export const OpportunityCard = React.memo(function OpportunityCard(
  props: CardProps,
) {
  // The DragOverlay clone renders a plain body (no sortable hooks).
  if (props.overlay) return <CardBody {...props} />;
  return <SortableCard {...props} />;
});
