# DESIGN.md — VenueFlow

Visual system ported from the TWM-Hub "Pulse" brand (see `logs/data/2026-06-11-twm-hub-brand.md`), converted from HSL to OKLCH and adapted to impeccable's laws. Register: **product** (light, airy internal tool) with a warmer treatment on couple-facing public pages.

## Theme

**Light.** Scene: a venue sales manager triaging enquiries on a laptop in a bright office between viewings, or on an iPad walking the grounds. Daylight environments, task-focused, glanceable. Dark mode is a supported variant, not the default.

Color strategy: **Restrained** on app surfaces — navy-tinted neutrals, the dark navy sidebar as the second neutral layer, pastel pink as the single action accent (≤10% of any screen). Public pages (form, booking) may step up to **Committed**: pink/pastels carry more of the surface because there the brand IS the venue's front door.

## Color Palette (OKLCH only — never raw hex/HSL in code)

### Core brand

| Token | Value | Source |
|---|---|---|
| Deep navy (anchor) | `oklch(0.217 0.053 269)` | #101833 |
| Pulse pink (signature accent) | `oklch(0.906 0.073 319)` | #F6D1FF |
| Mint teal | `oklch(0.882 0.062 195)` | #A8E6E5 |
| Periwinkle | `oklch(0.782 0.087 275)` | #A6B2F0 |
| Soft green | `oklch(0.934 0.076 134)` | #D5F5C1 |

### Semantic — light mode (`:root`)

```css
--background: oklch(0.965 0.006 273);          /* near-white, navy-tinted */
--foreground: oklch(0.217 0.053 269);          /* deep navy */
--card: oklch(0.992 0.003 273);                /* navy-tinted white — never pure #fff */
--card-foreground: oklch(0.217 0.053 269);
--popover: oklch(0.992 0.003 273);
--popover-foreground: oklch(0.217 0.053 269);
--primary: oklch(0.42 0.13 268);               /* TWM navy-blue */
--primary-foreground: oklch(0.985 0.004 273);
--secondary: oklch(0.845 0.071 195);           /* teal */
--secondary-foreground: oklch(0.377 0.05 194);
--muted: oklch(0.933 0.008 273);
--muted-foreground: oklch(0.541 0.061 271);
--accent: oklch(0.923 0.023 272);              /* soft navy tint */
--accent-foreground: oklch(0.278 0.077 268);
--success: oklch(0.93 0.068 134);
--success-foreground: oklch(0.447 0.098 135);
--warning: oklch(0.938 0.051 81);
--warning-foreground: oklch(0.477 0.09 76);
--destructive: oklch(0.594 0.186 25);
--destructive-foreground: oklch(0.985 0.004 273);
--border: oklch(0.899 0.013 273);
--input: oklch(0.881 0.015 272);
--ring: oklch(0.42 0.13 268);
--radius: 0.75rem;
```

### Fun pastels (+ strong variants for text/icons on light bg)

```css
--fun-pink: oklch(0.906 0.073 319);    --fun-pink-strong: oklch(0.703 0.189 319);
--fun-pink-foreground: oklch(0.217 0.053 269);
--fun-green: oklch(0.934 0.076 134);   --fun-green-strong: oklch(0.774 0.161 135);
--fun-blue: oklch(0.782 0.087 275);    --fun-blue-strong: oklch(0.584 0.152 272);
--fun-teal: oklch(0.882 0.062 195);    --fun-teal-strong: oklch(0.731 0.1 194);
--mint: oklch(0.935 0.035 195);
```

Text on pastel surfaces is always deep navy (`--foreground` or the matching `-foreground` pair); `-strong` variants are for icons and accents on light backgrounds, never for text on their own pastel (fails AA).

### Sidebar (permanently dark navy, even in light mode — signature)

```css
--sidebar: oklch(0.199 0.046 269);              /* #101833 */
--sidebar-foreground: oklch(0.828 0.031 264);
--sidebar-primary: oklch(0.906 0.073 319);      /* pink active/selected */
--sidebar-primary-foreground: oklch(0.199 0.046 269);
--sidebar-accent: oklch(0.906 0.073 319);
--sidebar-accent-foreground: oklch(0.199 0.046 269);
--sidebar-border: oklch(0.267 0.057 270);
--sidebar-ring: oklch(0.703 0.189 319);
```

### Dark mode (`.dark`)

```css
--background: oklch(0.163 0.031 270);
--foreground: oklch(0.934 0.007 273);
--card: oklch(0.192 0.039 270);
--popover: oklch(0.192 0.039 270);
--primary: oklch(0.708 0.128 250);              /* light blue */
--primary-foreground: oklch(0.163 0.031 270);
--secondary: oklch(0.402 0.042 194);
--secondary-foreground: oklch(0.895 0.043 195);
--muted: oklch(0.241 0.046 270);
--muted-foreground: oklch(0.585 0.044 272);
--accent: oklch(0.302 0.081 319);
--accent-foreground: oklch(0.881 0.078 319);
--success: oklch(0.338 0.059 134);
--success-foreground: oklch(0.892 0.083 134);
--warning: oklch(0.337 0.05 79);
--warning-foreground: oklch(0.897 0.059 81);
--destructive: oklch(0.514 0.163 25);
--destructive-foreground: oklch(0.985 0.004 273);
--border: oklch(0.259 0.051 270);
--input: oklch(0.241 0.046 270);
--ring: oklch(0.708 0.128 250);
--sidebar: oklch(0.171 0.037 269);
--sidebar-primary: oklch(0.764 0.102 249);
--sidebar-accent: oklch(0.23 0.049 269);
```

### Pipeline stage colors

Each of the 8 stages gets a fixed pastel chip (pastel background + navy text), assigned once and used consistently in kanban headers, stage badges, and reports:

| Stage | bg | text |
|---|---|---|
| Inbound enquiry | `--accent` (soft navy) | `--accent-foreground` |
| Responded | `--fun-teal` | `--foreground` |
| Viewing interest | `--mint` | `--foreground` |
| Appointment booked | `--fun-blue` (periwinkle) | `--foreground` |
| Appointment attended | `--fun-pink` | `--fun-pink-foreground` |
| Date on hold | `--warning` | `--warning-foreground` |
| Wedding booked | `--fun-green` (celebration moment) | `--foreground` |
| Archived | `--muted` | `--muted-foreground` |

No opacity-diluted variants; chips use these tokens at full strength. Stage name always rendered alongside color (AA, no color-only state).

## Typography

- **Single family: DM Sans** (Google Fonts via `next/font`, weights 300–700 + 400 italic). Used for everything — headings, body, labels, data. No display font.
- **Display/headings:** weight 600–700, `letter-spacing: -0.022em`, `line-height: 1.1`. Page titles are **solid deep navy** (`--foreground`). No gradient text anywhere (`background-clip: text` is banned); the TWM shimmer survives only as a non-text accent (see Signature elements).
- **Eyebrow labels:** 11–12px, weight 500–600, uppercase, `letter-spacing: 0.08em`, `--muted-foreground`.
- **Scale (fixed rem, ratio ~1.2):** 12 / 14 / 16 / 20 / 24 / 30 / 36px. Body 14px in app, 16px on public pages and all inputs (iOS no-zoom).
- **Numbers:** `tabular-nums` on counts, money, dates in tables and chips.
- Prose capped at 65–75ch; tables and kanban run denser.

## Radius, Elevation, Spacing

- **Radius:** `--radius: 0.75rem` (cards, dialogs); md = calc(−2px) for buttons/inputs; sm = calc(−4px) for chips; `999px` pills for stage badges.
- **Shadows:** `shadow-sm` on cards, `shadow-md` on hover/raised, popovers `0 8px 30px oklch(0.217 0.053 269 / 0.18)`. No heavy drops on light surfaces.
- **Cards:** solid `--card` background with `--border` and `shadow-sm`. The TWM glass-card (backdrop-blur) is **not ported** — glassmorphism only if a specific overlay earns it.
- **Spacing:** 4px base grid. Vary section rhythm — page header roomy (32–40px below), data regions tight (12–16px gaps). Container max 1400px, 2rem padding.
- **Touch:** 44px min targets on mobile, `100dvh`, safe-area utilities on public pages.

## Motion

- **Easings:** `--ease-spring: cubic-bezier(0.16, 1, 0.3, 1)` (primary, ease-out-expo character), `--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1)`. The TWM bounce curve is not ported (no bounce/elastic).
- **Durations:** 150–250ms. State changes only: hover lifts (`-translate-y-0.5` + shadow strengthen), dropdown/dialog reveal, kanban card drop settle, toast entry.
- **No page-load choreography.** The TWM `stagger-1..8` system is not ported to app surfaces; a single subtle fade-up is permitted on public form/booking pages only.
- **Skeletons** for loading (shimmer gradient over `--muted`), never centered spinners.
- One celebration exception: moving a card to **Wedding booked** may play a brief (<600ms) confetti/pulse moment. `prefers-reduced-motion` disables all of the above.

## Components

- **shadcn/ui** (CSS variables, neutral base) + Tailwind. Same component vocabulary on every screen.
- **Signature CTA (ported):** default Button = pulse-pink background, navy text, **inverts to navy bg / near-white text on hover**. This is the brand's handshake — use for primary actions only. Secondary = outline navy; destructive = `--destructive`; ghost for toolbars.
- **Signature elements ported:** dark navy sidebar with pink active item · pastel stage chips · skeleton shimmer · hover micro-lift · pill score/status dots.
- **Adapted:** page-title shimmer → an optional 2px animated shimmer **underline accent** beneath the H1 (non-text), used sparingly (dashboard, reports).
- **Empty states teach:** every list/board empty state explains the feature and offers the first action (e.g. empty pipeline → "Share your enquiry form" + copy-embed button). Never bare "No data".
- **Banned here (impeccable + product register):** side-stripe borders, gradient text, glass-as-default, hero-metric template, identical card grids, modal-as-first-thought (prefer inline edit, sheets for create/edit), decorative motion, display fonts in UI.

## Layout

- **App shell:** permanently dark navy sidebar (collapsible to icons on tablet, bottom-sheet nav on mobile) + light content area. Topbar minimal: venue switcher, search, user menu.
- **Kanban:** full-bleed horizontal scroll region, columns 300–320px, stage-chip headers with counts, cards dense (couple names, wedding date, guest count, source chip).
- **Tables/lists:** dense rows, sticky headers, inline actions on hover.
- **Public pages:** no app chrome, centered single column (max ~560px form / ~720px booking), generous whitespace, venue name + logo forward, VenueFlow only as a quiet footer mark.
