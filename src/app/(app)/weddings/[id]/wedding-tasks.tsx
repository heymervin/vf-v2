"use client";

import * as React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toggleWeddingTask } from "../actions";

export interface HubTask {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
}

function fmtDue(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function WeddingTasks({ tasks: initial }: { tasks: HubTask[] }) {
  const [tasks, setTasks] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();

  const done = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  function toggle(id: string, next: boolean) {
    // Optimistic — flip locally, revert if the action fails.
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: next } : t)));
    startTransition(async () => {
      const res = await toggleWeddingTask({ taskId: id, done: next });
      if (!res.ok) {
        setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !next } : t)));
      }
    });
  }

  if (tasks.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No tasks yet — they&rsquo;re seeded automatically when a wedding is booked.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Progress value={pct} className="h-1.5 flex-1" />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {done}/{tasks.length}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            <button
              type="button"
              onClick={() => toggle(t.id, !t.done)}
              disabled={pending}
              className="flex size-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-pressed={t.done}
              aria-label={t.done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
            >
              {t.done ? (
                <CheckCircle2 className="size-5 text-fun-green-strong" aria-hidden />
              ) : (
                <Circle className="size-5" aria-hidden />
              )}
            </button>
            <span className={cn("flex-1 text-sm", t.done && "text-muted-foreground line-through")}>
              {t.title}
            </span>
            {t.due_date && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {fmtDue(t.due_date)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
