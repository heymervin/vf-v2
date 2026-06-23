// Pure next-action priority ladder for the Wedding Workspace hub.
// Order mirrors the deterministic insight priority in src/lib/copilot/insights.ts:
// overdue payment → payment due → overdue task → task due ≤30d → upcoming payment ≤90d → all-clear.

export interface LadderTask {
  title: string;
  due_date: string | null;
  done: boolean;
}

export interface LadderMilestone {
  label: string;
  status: string; // 'paid' | 'due' | 'upcoming' | 'overdue'
  due_date: string;
}

export interface NextAction {
  severity: "info" | "warning" | "destructive" | "success";
  title: string;
  detail?: string;
  href?: string;
  actionLabel?: string;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

/** Pick the single most-pressing next action for a wedding. `today` is an ISO date (YYYY-MM-DD). */
export function pickNextAction(
  tasks: LadderTask[],
  milestones: LadderMilestone[],
  base: string,
  today: string,
): NextAction {
  const openTasks = tasks.filter((t) => !t.done);

  const overduePayment = milestones.find(
    (m) => m.status !== "paid" && (m.status === "overdue" || m.due_date < today),
  );
  if (overduePayment)
    return {
      severity: "destructive",
      title: `Payment overdue — ${overduePayment.label}`,
      detail: `Was due ${fmtDate(overduePayment.due_date)}`,
      href: `${base}/payments`,
      actionLabel: "Payments",
    };

  const duePayment = milestones.find((m) => m.status === "due");
  if (duePayment)
    return {
      severity: "warning",
      title: `Payment due — ${duePayment.label}`,
      detail: `Due ${fmtDate(duePayment.due_date)}`,
      href: `${base}/payments`,
      actionLabel: "Payments",
    };

  const overdueTask = openTasks.find((t) => t.due_date && t.due_date < today);
  if (overdueTask)
    return {
      severity: "warning",
      title: `Overdue: ${overdueTask.title}`,
      detail: overdueTask.due_date ? `Was due ${fmtDate(overdueTask.due_date)}` : undefined,
    };

  const soonTask = openTasks.find((t) => t.due_date && daysBetween(today, t.due_date) <= 30);
  if (soonTask)
    return {
      severity: "info",
      title: `Next up: ${soonTask.title}`,
      detail: soonTask.due_date ? `Due ${fmtDate(soonTask.due_date)}` : undefined,
    };

  const upcomingPayment = milestones.find(
    (m) => m.status === "upcoming" && daysBetween(today, m.due_date) <= 90,
  );
  if (upcomingPayment)
    return {
      severity: "info",
      title: `Upcoming — ${upcomingPayment.label}`,
      detail: `Due ${fmtDate(upcomingPayment.due_date)}`,
      href: `${base}/payments`,
      actionLabel: "Payments",
    };

  if (openTasks.length > 0)
    return {
      severity: "info",
      title: `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}`,
      detail: "See the checklist below.",
    };

  return { severity: "success", title: "All caught up", detail: "No overdue payments or tasks." };
}
