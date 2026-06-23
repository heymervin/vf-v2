/**
 * Unit tests for portal-types.ts — pure DB-row → client-prop mappers.
 * DB-free and secret-free per the project's vitest rules.
 */

import { describe, it, expect } from "vitest";
import type { Tables } from "@/lib/supabase/types";
import {
  mapGuest,
  mapTask,
  mapPayment,
  mapDoc,
  groupMenuByCourse,
  splitCoupleNames,
  daysUntil,
  formatLongDate,
} from "./portal-types";

function guestRow(over: Partial<Tables<"wedding_guests">> = {}): Tables<"wedding_guests"> {
  return {
    allergen_notes: null,
    created_at: "2026-01-01T00:00:00Z",
    dietary: [],
    email: null,
    household_id: null,
    household_name: null,
    id: "11111111-1111-1111-1111-111111111111",
    meal_choice: null,
    name: "Aunt Margaret",
    notes: null,
    phone: null,
    plus_one: false,
    plus_one_name: null,
    rsvp: "yes",
    rsvp_chased_at: null,
    seat_index: null,
    session_type: null,
    side: "partner1",
    table_number: 4,
    tags: [],
    updated_at: "2026-01-01T00:00:00Z",
    venue_id: "v1",
    wedding_id: "w1",
    ...over,
  };
}

describe("mapGuest", () => {
  it("maps couple-facing fields and keeps table/side", () => {
    const g = mapGuest(guestRow({ dietary: ["Vegan"], plus_one: true, plus_one_name: "Tom" }));
    expect(g).toMatchObject({
      id: "11111111-1111-1111-1111-111111111111",
      name: "Aunt Margaret",
      side: "partner1",
      table: 4,
      rsvp: "yes",
      dietary: ["Vegan"],
      plusOne: true,
      plusOneName: "Tom",
      sessionType: "day",
    });
  });

  it("falls back to safe defaults for unknown enum-ish values", () => {
    const g = mapGuest(guestRow({ rsvp: "weird", side: "x", session_type: "z" }));
    expect(g.rsvp).toBe("pending");
    expect(g.side).toBe("both");
    expect(g.sessionType).toBe("day");
  });
});

describe("mapTask", () => {
  it("maps title→label and clamps unknown category", () => {
    const base: Tables<"wedding_tasks"> = {
      category: "weird",
      created_at: "2026-01-01T00:00:00Z",
      done: true,
      due_date: "2026-05-01",
      id: "t1",
      owner: null,
      sort_index: 0,
      title: "Pick flowers",
      updated_at: "2026-01-01T00:00:00Z",
      venue_id: "v1",
      visible_to_couple: true,
      wedding_id: "w1",
    };
    const t = mapTask(base);
    expect(t).toMatchObject({ id: "t1", label: "Pick flowers", done: true, category: "planning" });
  });
});

describe("mapPayment", () => {
  it("converts minor units to major and maps status", () => {
    const base: Tables<"payment_milestones"> = {
      amount_minor: 150000,
      created_at: "2026-01-01T00:00:00Z",
      due_date: "2026-06-01",
      ghl_invoice_id: null,
      id: "p1",
      label: "Deposit",
      paid_on: "2026-02-01",
      proposal_id: null,
      receipt_url: "https://x/receipt.pdf",
      reminder_sent: false,
      reminder_sent_at: null,
      sort_order: 0,
      status: "paid",
      updated_at: "2026-01-01T00:00:00Z",
      venue_id: "v1",
      wedding_id: "w1",
    };
    const p = mapPayment(base);
    expect(p.amount).toBe(1500);
    expect(p.status).toBe("paid");
    expect(p.paidOn).toBe("2026-02-01");
    expect(p.receiptUrl).toBe("https://x/receipt.pdf");
  });
});

describe("mapDoc", () => {
  it("derives signed status from signed_at and defaults the name", () => {
    const base: Tables<"wedding_documents"> = {
      created_at: "2026-01-01T00:00:00Z",
      expiry_date: null,
      id: "d1",
      kind: "contract",
      last_chased_at: null,
      name: null,
      signed_at: "2026-03-01T00:00:00Z",
      storage_path: "docs/contract.pdf",
      supplier_id: null,
      updated_at: "2026-01-01T00:00:00Z",
      uploaded_by: null,
      venue_id: "v1",
      wedding_id: "w1",
    };
    const d = mapDoc(base);
    expect(d).toMatchObject({ id: "d1", name: "Document", kind: "contract", status: "signed" });
  });
});

describe("groupMenuByCourse", () => {
  function item(over: Partial<Tables<"menu_items">>): Tables<"menu_items"> {
    return {
      allergens: [],
      course: "Starter",
      created_at: "2026-01-01T00:00:00Z",
      description: null,
      dietary_tags: [],
      id: "i1",
      is_active: true,
      meal_period: null,
      name: "Soup",
      photo_path: null,
      price_per_head_minor: null,
      sort_order: 0,
      updated_at: "2026-01-01T00:00:00Z",
      venue_id: "v1",
      ...over,
    };
  }

  it("groups active items by course, ordered, with chosenBy counts; drops inactive", () => {
    const courses = groupMenuByCourse(
      [
        item({ id: "i1", course: "Starter", name: "Soup", sort_order: 1 }),
        item({ id: "i2", course: "Main", name: "Beef", sort_order: 2 }),
        item({ id: "i3", course: "Main", name: "Fish", sort_order: 3 }),
        item({ id: "i4", course: "Dessert", name: "Old", sort_order: 4, is_active: false }),
      ],
      new Map([["i2", 5]]),
    );
    expect(courses.map((c) => c.course)).toEqual(["Starter", "Main"]);
    const main = courses.find((c) => c.course === "Main")!;
    expect(main.id).toBe("Main"); // course key is the id (lines up with selections)
    expect(main.options.map((o) => o.name)).toEqual(["Beef", "Fish"]);
    expect(main.options.find((o) => o.id === "i2")!.chosenBy).toBe(5);
  });
});

describe("splitCoupleNames", () => {
  it("splits on & / and / + and takes first names", () => {
    expect(splitCoupleNames("Emma Henderson & James Carter")).toEqual({
      partner1First: "Emma",
      partner2First: "James",
    });
    expect(splitCoupleNames("Sam and Alex")).toEqual({
      partner1First: "Sam",
      partner2First: "Alex",
    });
  });

  it("uses fallbacks when a partner is missing", () => {
    expect(splitCoupleNames("Solo Person")).toEqual({
      partner1First: "Solo",
      partner2First: "Partner 2",
    });
  });
});

describe("daysUntil / formatLongDate", () => {
  it("counts calendar days to a future date", () => {
    const today = new Date("2027-09-01T12:00:00Z");
    expect(daysUntil("2027-09-18", today)).toBe(17);
  });

  it("returns 0 and a placeholder for a null date", () => {
    expect(daysUntil(null)).toBe(0);
    expect(formatLongDate(null)).toBe("Date to be confirmed");
  });

  it("formats an ISO date as a long UK date", () => {
    expect(formatLongDate("2027-09-18")).toBe("18 September 2027");
  });
});
