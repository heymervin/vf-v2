import { cn } from "@/lib/utils";

interface VenueMonogramProps {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Dark navy square with pink initials — used as logo fallback.
 * Exported for reuse in the sidebar and elsewhere.
 */
export function VenueMonogram({
  name,
  className,
  size = "md",
}: VenueMonogramProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const sizeClasses = {
    sm: "size-8 text-xs",
    md: "size-12 text-sm",
    lg: "size-16 text-base",
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg font-semibold",
        "bg-sidebar text-sidebar-primary",
        sizeClasses[size],
        className,
      )}
    >
      {initials || "V"}
    </div>
  );
}
