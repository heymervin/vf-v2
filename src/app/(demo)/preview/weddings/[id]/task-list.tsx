"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatLongDate, type WeddingTask } from "@/lib/mock";
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

export function TaskList({ tasks }: { tasks: WeddingTask[] }) {
  // Incomplete tasks first, then completed; within each group sort by dueDate asc
  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <ul className="divide-y divide-border">
      {sorted.map((task) => (
        <li
          key={task.id}
          className="flex min-h-[44px] items-start gap-3 py-3"
        >
          <Checkbox
            defaultChecked={task.done}
            disabled
            className="mt-0.5 shrink-0"
          />
          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <span
              className={cn(
                "text-sm leading-snug text-foreground",
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
      ))}
    </ul>
  );
}
