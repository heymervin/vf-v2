"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadBrochure } from "../actions";

export function BrochureUpload({ hasActive }: { hasActive: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const result = await uploadBrochure(new FormData(e.currentTarget));
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Brochure updated.");
    setFileName(null);
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title (optional)</Label>
        <Input id="title" name="title" placeholder="e.g. 2027 Wedding Brochure" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="file">PDF file</Label>
        <label
          htmlFor="file"
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40"
        >
          <Upload className="size-5 shrink-0" />
          <span className="min-w-0 truncate">
            {fileName ?? "Choose a PDF (max 10MB)"}
          </span>
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf"
          required
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Uploading…" : hasActive ? "Replace brochure" : "Upload brochure"}
      </Button>
    </form>
  );
}
