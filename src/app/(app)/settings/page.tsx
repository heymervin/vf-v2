import Link from "next/link";
import { FileText, Code2, Mail, CalendarDays, CreditCard, ChevronRight } from "lucide-react";

export const metadata = { title: "Settings" };

const SECTIONS = [
  {
    href: "/settings/forms",
    icon: Code2,
    title: "Enquiry form",
    desc: "Your public form link and the embed code for your website.",
  },
  {
    href: "/settings/brochure",
    icon: FileText,
    title: "Brochure",
    desc: "Upload the PDF that's auto-emailed to every new enquiry.",
  },
  {
    href: "/settings/sequences",
    icon: Mail,
    title: "Nurture sequence",
    desc: "Edit the 3-step follow-up email sequence sent to new enquiries.",
  },
  {
    href: "/settings/availability",
    icon: CalendarDays,
    title: "Availability",
    desc: "Set staff availability windows and tune meeting type durations.",
  },
  {
    href: "/settings/billing",
    icon: CreditCard,
    title: "Billing",
    desc: "Manage your VenueFlow subscription and payment details.",
  },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Settings
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Configure how couples reach you and what they receive.
        </p>
      </div>

      <ul className="space-y-3">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <s.icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
