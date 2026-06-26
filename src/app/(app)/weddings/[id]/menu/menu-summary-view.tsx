import type { MenuSummary } from "./menu-data";

/**
 * Print-friendly render of a wedding's kitchen menu summary — allergen rollup,
 * dish counts by course, and special-dietary guests. Shared by the chef sheet
 * and the BEO. Pure render (server-compatible).
 */
export function MenuSummaryView({ summary }: { summary: MenuSummary }) {
  const { dishesByCourse, rollup, dietaryGuests } = summary;

  if (dishesByCourse.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No dishes selected for this wedding yet.
      </p>
    );
  }

  return (
    <>
      <Section title="Allergen summary">
        {rollup.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No allergens across the chosen dishes.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                <th className="py-1.5 font-semibold">Allergen</th>
                <th className="py-1.5 text-right font-semibold">Guests affected</th>
                <th className="py-1.5 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {rollup.map((r) => (
                <tr key={r.allergen} className="border-b border-border/60">
                  <td className="py-1.5 font-medium text-foreground">{r.allergen}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground">{r.count}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{r.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Dishes & counts">
        <div className="space-y-4">
          {dishesByCourse.map(({ course, dishes }) => (
            <div key={course}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {course}
              </p>
              <ul className="space-y-1.5">
                {dishes.map((d) => (
                  <li key={d.itemId} className="flex items-baseline gap-3">
                    <span className="w-12 shrink-0 text-right text-base font-bold tabular-nums text-foreground">
                      {d.chosenBy}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{d.name}</span>
                      {d.allergens.length > 0 && (
                        <span className="ml-2 text-xs text-destructive">
                          {d.allergens.join(", ")}
                        </span>
                      )}
                      {d.dietaryTags.length > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {d.dietaryTags.join(", ")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Special dietary requirements">
        {dietaryGuests.length === 0 ? (
          <p className="text-sm text-muted-foreground">None recorded.</p>
        ) : (
          <ul className="space-y-2">
            {dietaryGuests.map((g) => (
              <li key={g.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="font-medium text-foreground">{g.name}</span>
                <span className="text-destructive">{g.dietary.join(", ")}</span>
                {g.picks.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    chose: {g.picks.join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h2 className="mb-2 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
