/**
 * Shared types for the Run-sheet tool.
 * Plain module (not "use server") so client components can import freely.
 */

export type Category =
  | "ceremony"
  | "reception"
  | "catering"
  | "supplier"
  | "logistics";

export interface TimelineEvent {
  id: string;
  title: string;
  starts_at_time: string; // "HH:MM"
  duration_min: number;
  category: Category;
  owner: string | null;
  notes: string | null;
  supplier_id: string | null;
  done: boolean;
  sort_order: number;
}

export interface WeddingSupplierRef {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  checked_in_at: string | null;
}

export const CATEGORY_META: Record<
  Category,
  { label: string; dot: string; chip: string }
> = {
  ceremony: {
    label: "Ceremony",
    dot: "bg-fun-pink-strong",
    chip: "bg-fun-pink text-fun-pink-foreground",
  },
  reception: {
    label: "Reception",
    dot: "bg-fun-blue-strong",
    chip: "bg-fun-blue text-foreground",
  },
  catering: {
    label: "Catering",
    dot: "bg-fun-green-strong",
    chip: "bg-fun-green text-foreground",
  },
  supplier: {
    label: "Supplier",
    dot: "bg-fun-teal-strong",
    chip: "bg-fun-teal text-foreground",
  },
  logistics: {
    label: "Logistics",
    dot: "bg-accent-foreground",
    chip: "bg-mint text-foreground",
  },
};

export const CATEGORY_ORDER: Category[] = [
  "ceremony",
  "reception",
  "catering",
  "supplier",
  "logistics",
];

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function getNowNext(
  items: Pick<TimelineEvent, "id" | "starts_at_time" | "duration_min">[],
  clockTime: string,
): { nowId: string | null; nextId: string | null } {
  const nowMins = timeToMinutes(clockTime);
  let nowId: string | null = null;
  let nextId: string | null = null;

  for (const item of items) {
    const start = timeToMinutes(item.starts_at_time);
    const end = start + item.duration_min;
    if (nowMins >= start && nowMins < end) {
      nowId = item.id;
    }
  }

  for (const item of items) {
    const start = timeToMinutes(item.starts_at_time);
    if (start > nowMins) {
      nextId = item.id;
      break;
    }
  }

  return { nowId, nextId };
}
