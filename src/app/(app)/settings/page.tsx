import Link from "next/link";
import { FileText, Code2, ChevronRight, Building2, LayoutGrid, Users, Mail } from "lucide-react";

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
    href: "/settings/venue",
    icon: Building2,
    title: "Venue profile & hours",
    desc: "Your venue name, description, location, and opening hours.",
  },
  {
    href: "/settings/spaces",
    icon: LayoutGrid,
    title: "Spaces",
    desc: "Manage the individual spaces and rooms couples can book.",
  },
  {
    href: "/settings/team",
    icon: Users,
    title: "Team",
    desc: "Invite team members and manage their roles.",
  },
  {
    href: "/settings/email",
    icon: Mail,
    title: "Email identity",
    desc: "The sender name and reply-to address used in outgoing emails.",
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
