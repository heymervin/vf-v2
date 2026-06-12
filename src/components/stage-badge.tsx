import { cn } from "@/lib/utils";
import { stageMeta, type PipelineStage } from "@/lib/pipeline";

/**
 * Pipeline stage chip — pastel background + navy text per DESIGN.md. The stage
 * name is always rendered (never color-only state, AA).
 */
export function StageBadge({
  stage,
  className,
}: {
  stage: PipelineStage;
  className?: string;
}) {
  const meta = stageMeta(stage);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.chip,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
