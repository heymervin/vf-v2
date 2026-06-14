import Link from "next/link";
import { AlertTriangle, ChefHat, Utensils, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  primaryWedding,
  type MenuCourse,
  type MenuOption,
  type Guest,
} from "@/lib/mock";
import { cn } from "@/lib/utils";

export const metadata = { title: "Menu & catering" };

// ---------------------------------------------------------------------------
// Derived data helpers — no mock modifications
// ---------------------------------------------------------------------------

/** Total covers for a course (sum of all option chosenBy). */
function courseTotal(course: MenuCourse): number {
  return course.options.reduce((s, o) => s + o.chosenBy, 0);
}

/** Aggregate allergen → total guest-choices count across the whole menu. */
function buildAllergenRollup(
  courses: MenuCourse[],
): { allergen: string; count: number }[] {
  const map = new Map<string, number>();
  for (const course of courses) {
    for (const option of course.options) {
      for (const allergen of option.allergens) {
        map.set(allergen, (map.get(allergen) ?? 0) + option.chosenBy);
      }
    }
  }
  return Array.from(map.entries())
    .map(([allergen, count]) => ({ allergen, count }))
    .sort((a, b) => b.count - a.count);
}

/** Guests with at least one declared dietary need. */
function guestsWithDietary(guests: Guest[]): number {
  return guests.filter((g) => g.dietary.length > 0).length;
}

// ---------------------------------------------------------------------------
// Sub-components — all server-safe (no client hooks)
// ---------------------------------------------------------------------------

/** Small horizontal progress bar using pure divs — RSC-safe. */
function InlineBar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${value} of ${max} guests`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-fun-pink-strong"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Allergen chips. Empty → muted "No major allergens" label. */
function AllergenChips({ allergens }: { allergens: string[] }) {
  if (allergens.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No major allergens</span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {allergens.map((a) => (
        <span
          key={a}
          className="inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[11px] font-medium text-warning-foreground"
        >
          <AlertTriangle className="size-3 shrink-0" />
          {a}
        </span>
      ))}
    </div>
  );
}

/** Single menu option row inside a course card. */
function OptionRow({
  option,
  total,
}: {
  option: MenuOption;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((option.chosenBy / total) * 100);
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{option.name}</span>
        <span className="tabular-nums text-xs text-muted-foreground">
          chosen by{" "}
          <span className="font-semibold text-foreground">{option.chosenBy}</span>{" "}
          guest{option.chosenBy !== 1 ? "s" : ""}{" "}
          <span className="text-muted-foreground/60">({pct}%)</span>
        </span>
      </div>
      <InlineBar value={option.chosenBy} max={total} className="mb-2" />
      <AllergenChips allergens={option.allergens} />
    </div>
  );
}

/** A course section — header + options. */
function CourseSection({ course }: { course: MenuCourse }) {
  const total = courseTotal(course);
  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Utensils className="size-4 text-muted-foreground" />
            {course.course}
          </CardTitle>
          <Badge variant="secondary">
            <Users className="size-3" />
            {total} cover{total !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {course.options.map((o) => (
            <OptionRow key={o.id} option={o} total={total} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Kitchen counts summary — chef's prep sheet
// ---------------------------------------------------------------------------

function KitchenCountsPanel({ courses }: { courses: MenuCourse[] }) {
  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="flex items-center gap-2">
          <ChefHat className="size-4 text-muted-foreground" />
          Kitchen counts
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Chef&apos;s prep sheet — covers per option per course
        </p>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {courses.map((course) => {
            const total = courseTotal(course);
            return (
              <div key={course.id} className="py-3 first:pt-0 last:pb-0">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {course.course}
                  </span>
                  <span className="tabular-nums text-xs font-semibold text-foreground">
                    {total} total
                  </span>
                </div>
                <div className="space-y-1.5">
                  {course.options.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {o.name}
                      </span>
                      <span className="tabular-nums text-sm font-semibold text-foreground">
                        {o.chosenBy}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Allergen rollup — safety-critical view
// ---------------------------------------------------------------------------

function AllergenRollupPanel({
  courses,
  guests,
}: {
  courses: MenuCourse[];
  guests: Guest[];
}) {
  const rollup = buildAllergenRollup(courses);
  const dietaryCount = guestsWithDietary(guests);
  const totalMenuChoices = courses.reduce(
    (s, c) => s + courseTotal(c),
    0,
  );

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning-foreground" />
          Allergen rollup
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Total guest-choices containing each allergen across all courses
        </p>
      </CardHeader>
      <CardContent>
        {rollup.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No allergens declared across this menu.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rollup.map(({ allergen, count }) => {
              const pct =
                totalMenuChoices === 0
                  ? 0
                  : Math.round((count / totalMenuChoices) * 100);
              return (
                <div
                  key={allergen}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[11px] font-medium text-warning-foreground"
                    aria-label={`Allergen: ${allergen}`}
                  >
                    <AlertTriangle className="size-3 shrink-0" />
                    {allergen}
                  </span>
                  <div className="flex flex-1 items-center gap-3">
                    <InlineBar
                      value={count}
                      max={totalMenuChoices}
                      className="flex-1"
                    />
                    <span className="tabular-nums text-sm font-semibold text-foreground">
                      {count}
                    </span>
                    <span className="w-8 text-right tabular-nums text-xs text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dietary cross-check */}
        <div className="mt-4 rounded-lg bg-accent/60 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Dietary cross-check
          </p>
          <p className="mt-1 text-sm text-foreground">
            <span className="tabular-nums font-semibold">{dietaryCount}</span>{" "}
            guest{dietaryCount !== 1 ? "s" : ""} have declared dietary
            needs on their RSVP.{" "}
            {guests.length > 0 && (
              <span className="text-muted-foreground">
                Verify that their chosen options above are safe.
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MenuPage() {
  const wedding = primaryWedding();
  const weddingHref = `/preview/weddings/${wedding.id}`;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Menu & catering"
        subtitle={`${wedding.coupleName} · ${wedding.space} · ${wedding.guestCount} guests`}
        actions={
          <Link
            href={weddingHref}
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Back to wedding
          </Link>
        }
      />

      {/*
        Two-column layout:
        Left (2/3): course sections stacked
        Right (1/3): sticky kitchen counts + allergen rollup
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Course cards — full width on mobile, 2/3 on desktop */}
        <div className="space-y-6 lg:col-span-2">
          {wedding.menu.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Utensils className="mx-auto mb-3 size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">
                  No menu added yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Once courses are configured and guest choices collected,
                  per-option counts and allergen data will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            wedding.menu.map((course) => (
              <CourseSection key={course.id} course={course} />
            ))
          )}
        </div>

        {/* Right column: kitchen counts + allergen rollup */}
        <div className="space-y-6 lg:col-span-1">
          <KitchenCountsPanel courses={wedding.menu} />
          <AllergenRollupPanel courses={wedding.menu} guests={wedding.guests} />
        </div>
      </div>
    </div>
  );
}
