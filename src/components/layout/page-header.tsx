import { cn } from "@/lib/utils";

/**
 * Shared page header for /preview modules — matches the real app pattern
 * (title-shimmer-underline H1 + muted subtitle, optional right-aligned actions).
 * Keeps every prototype surface visually consistent.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  shimmer = true,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  shimmer?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mb-7 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1
          className={cn(
            "inline-block text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground",
            shimmer && "title-shimmer-underline",
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
