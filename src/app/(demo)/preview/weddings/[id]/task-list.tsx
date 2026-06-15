"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatLongDate, type WeddingTask } from "@/lib/mock";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function categoryVariant(
  cat: WeddingTask["category"],
): "outline" | "warning" | "teal" | "blue" {
  switch (cat) {
    case "money":
      return "warning";
    case "suppliers":
      return "teal";
    case "admin":
      return "blue";
    case "planning":
      return "outline";
  }
}

function categoryLabel(cat: WeddingTask["category"]): string {
  switch (cat) {
    case "money":
      return "Money";
    case "suppliers":
      return "Suppliers";
    case "admin":
      return "Admin";
    case "planning":
      return "Planning";
  }
}

interface TaskItemProps {
  task: WeddingTask & { done: boolean };
  onToggle: (id: string, next: boolean) => void;
}

function TaskItem({ task, onToggle }: TaskItemProps) {
  return (
    <li className="flex min-h-[44px] items-start gap-3 py-3">
      <Checkbox
        checked={task.done}
        onCheckedChange={(checked) => onToggle(task.id, !!checked)}
        className="mt-0.5 shrink-0"
        aria-label={task.done ? `Mark "${task.label}" incomplete` : `Mark "${task.label}" complete`}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <span
          className={cn(
            "text-sm leading-snug text-foreground transition-colors",
            task.done && "line-through text-muted-foreground",
          )}
        >
          {task.label}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {task.dueDate && (
            <span
              className={cn(
                "text-xs tabular-nums text-muted-foreground",
                task.done && "line-through",
              )}
            >
              {formatLongDate(task.dueDate)}
            </span>
          )}
          <Badge variant={categoryVariant(task.category)}>
            {categoryLabel(task.category)}
          </Badge>
        </div>
      </div>
    </li>
  );
}

export function TaskList({ tasks }: { tasks: WeddingTask[] }) {
  // Optimistic state — mirrors the initial data but toggles immediately
  const [doneMap, setDoneMap] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(tasks.map((t) => [t.id, t.done])),
  );

  function handleToggle(id: string, next: boolean) {
    // Optimistic update
    setDoneMap((prev) => ({ ...prev, [id]: next }));

    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    if (next) {
      toast.success(`"${task.label}" marked complete`);
    } else {
      toast("Task reopened", {
        description: task.label,
      });
    }
  }

  // Merge optimistic state into tasks; sort: incomplete first, then by dueDate
  const sorted = tasks
    .map((t) => ({ ...t, done: doneMap[t.id] ?? t.done }))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  return (
    <ul className="divide-y divide-border" aria-label="Wedding tasks">
      {sorted.map((task) => (
        <TaskItem key={task.id} task={task} onToggle={handleToggle} />
      ))}
    </ul>
  );
}
