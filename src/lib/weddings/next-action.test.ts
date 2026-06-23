import { describe, it, expect } from "vitest";
import { pickNextAction } from "./next-action";

const base = "/weddings/x";
const today = "2026-06-23";

describe("pickNextAction", () => {
  it("overdue payment outranks everything", () => {
    const r = pickNextAction(
      [{ title: "Numbers", due_date: "2026-01-01", done: false }],
      [{ label: "Deposit", status: "overdue", due_date: "2026-06-01" }],
      base,
      today,
    );
    expect(r.severity).toBe("destructive");
    expect(r.title).toContain("Deposit");
    expect(r.href).toBe("/weddings/x/payments");
  });

  it("a past due_date counts as overdue even if status is still 'due'", () => {
    const r = pickNextAction([], [{ label: "Balance", status: "due", due_date: "2026-06-01" }], base, today);
    expect(r.severity).toBe("destructive");
  });

  it("a future 'due' payment outranks an overdue task", () => {
    const r = pickNextAction(
      [{ title: "Late task", due_date: "2026-01-01", done: false }],
      [{ label: "Deposit", status: "due", due_date: "2026-12-01" }],
      base,
      today,
    );
    expect(r.title).toContain("Payment due");
  });

  it("overdue task wins when there are no payments", () => {
    const r = pickNextAction([{ title: "Numbers", due_date: "2026-06-01", done: false }], [], base, today);
    expect(r.severity).toBe("warning");
    expect(r.title).toContain("Numbers");
  });

  it("done tasks are ignored", () => {
    const r = pickNextAction([{ title: "Done thing", due_date: "2026-01-01", done: true }], [], base, today);
    expect(r.severity).toBe("success");
  });

  it("open-but-not-soon tasks surface as info, not all-clear", () => {
    const r = pickNextAction([{ title: "Someday", due_date: null, done: false }], [], base, today);
    expect(r.severity).toBe("info");
    expect(r.title).toContain("1 open task");
  });

  it("nothing outstanding → all caught up", () => {
    const r = pickNextAction([], [], base, today);
    expect(r.severity).toBe("success");
  });
});
