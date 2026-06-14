"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { emailSettingsSchema, type EmailSettingsInput } from "@/lib/zod-schemas/settings-email";
import { saveEmailSettings } from "./actions";

interface EmailFormProps {
  defaultFromName: string;
  defaultReplyTo: string;
}

export function EmailForm({ defaultFromName, defaultReplyTo }: EmailFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailSettingsInput>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      from_name: defaultFromName,
      reply_to: defaultReplyTo,
    },
  });

  async function onSubmit(values: EmailSettingsInput) {
    setServerError(null);
    const fd = new FormData();
    fd.set("from_name", values.from_name);
    fd.set("reply_to", values.reply_to);

    const result = await saveEmailSettings(fd);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    toast.success("Email settings saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Display name */}
      <div className="space-y-1.5">
        <Label htmlFor="from_name">Display name</Label>
        <Input
          id="from_name"
          type="text"
          placeholder="The Grand Hall"
          aria-invalid={!!errors.from_name}
          {...register("from_name")}
        />
        {errors.from_name ? (
          <p className="text-xs text-destructive">{errors.from_name.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Shown in the &ldquo;From&rdquo; field — e.g.{" "}
            <span className="font-medium text-foreground">The Grand Hall</span>{" "}
            via mail.venueflow.io
          </p>
        )}
      </div>

      {/* Reply-to */}
      <div className="space-y-1.5">
        <Label htmlFor="reply_to">Reply-to address</Label>
        <Input
          id="reply_to"
          type="email"
          placeholder="hello@yourvenue.com"
          autoComplete="email"
          aria-invalid={!!errors.reply_to}
          {...register("reply_to")}
        />
        {errors.reply_to ? (
          <p className="text-xs text-destructive">{errors.reply_to.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            When couples hit reply, their message goes here — not to the
            VenueFlow sending address.
          </p>
        )}
      </div>

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={isSubmitting} className="min-w-28">
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
