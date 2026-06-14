"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { submitLeadForm } from "./actions";

interface LeadFormValues {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  partner_first_name: string;
  partner_last_name: string;
  wedding_date: string;
  wedding_date_flexible: boolean;
  guest_count: string;
  message: string;
  website: string; // honeypot
}

const EMPTY: LeadFormValues = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  partner_first_name: "",
  partner_last_name: "",
  wedding_date: "",
  wedding_date_flexible: false,
  guest_count: "",
  message: "",
  website: "",
};

export function LeadForm({
  venueSlug,
  venueName,
  embed = false,
}: {
  venueSlug: string;
  venueName: string;
  embed?: boolean;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{
    email: string;
    brochureSent: boolean;
  } | null>(null);
  const attribution = React.useRef<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues>({ defaultValues: EMPTY });

  // Capture UTM + referrer once on mount (client only).
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    attribution.current = {
      utm_source: p.get("utm_source") ?? "",
      utm_medium: p.get("utm_medium") ?? "",
      utm_campaign: p.get("utm_campaign") ?? "",
      source: p.get("source") ?? "",
      referrer: document.referrer ?? "",
    };
  }, []);

  const flexible = watch("wedding_date_flexible");
  // Local-today (YYYY-MM-DD) so the native date picker can't offer past dates.
  const today = React.useMemo(() => {
    const n = new Date();
    return new Date(n.getTime() - n.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
  }, []);

  async function onSubmit(values: LeadFormValues) {
    setServerError(null);
    const result = await submitLeadForm(venueSlug, {
      ...values,
      ...attribution.current,
    });
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setDone({ email: values.email, brochureSent: result.data.brochureSent });
  }

  if (done) {
    return (
      <div
        className={cn(
          "animate-in fade-in duration-500 text-center",
          embed ? "py-10" : "py-6",
        )}
      >
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-fun-green">
          <Check className="size-7 text-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-[-0.022em] text-foreground">
          {done.brochureSent
            ? "Thank you — your brochure is on its way"
            : "Thank you — we’ve received your enquiry"}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">
          {done.brochureSent ? (
            <>
              We&apos;ve sent your {venueName} brochure to{" "}
              <span className="font-medium text-foreground">{done.email}</span>.
              Check your inbox shortly — it should arrive within a few minutes.
              We&apos;ll be in touch soon to help plan your day.
            </>
          ) : (
            <>
              We&apos;ve received your {venueName} enquiry and will be in touch
              soon to help plan your day.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Honeypot — visually hidden, off-screen, not announced. */}
      <div aria-hidden className="absolute left-[-9999px] top-[-9999px]" tabIndex={-1}>
        <label>
          Leave this empty
          <input type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field htmlFor="first_name" label="Your name" required error={errors.first_name?.message}>
          <Input
            id="first_name"
            className="text-base"
            {...register("first_name", { required: "Please tell us your name." })}
            aria-invalid={!!errors.first_name}
          />
        </Field>
        <Field htmlFor="partner_first_name" label="Partner's name">
          <Input
            id="partner_first_name"
            className="text-base"
            {...register("partner_first_name")}
          />
        </Field>
      </div>

      <Field htmlFor="email" label="Email" required error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="text-base"
          {...register("email", {
            required: "We need your email to send your brochure.",
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: "Enter a valid email address.",
            },
          })}
          aria-invalid={!!errors.email}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field htmlFor="phone" label="Phone">
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" className="text-base" {...register("phone")} />
        </Field>
        <Field htmlFor="guest_count" label="Approx. guests" error={errors.guest_count?.message}>
          <Input
            id="guest_count"
            type="number"
            min={0}
            inputMode="numeric"
            className="text-base"
            {...register("guest_count", {
              pattern: { value: /^\d*$/, message: "Whole number only." },
            })}
            aria-invalid={!!errors.guest_count}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field htmlFor="wedding_date" label="Wedding date">
          <Input id="wedding_date" type="date" min={today} className="text-base" {...register("wedding_date")} />
        </Field>
        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2.5 text-base text-foreground">
            <Switch
              checked={flexible}
              onCheckedChange={(v) => setValue("wedding_date_flexible", v)}
            />
            My date is flexible
          </label>
        </div>
      </div>

      <Field htmlFor="message" label="Anything you'd like us to know?">
        <Textarea
          id="message"
          rows={3}
          className="text-base"
          placeholder="Tell us a little about your day…"
          {...register("message")}
        />
      </Field>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full text-base">
        {isSubmitting ? "Sending…" : "Send enquiry"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        We&apos;ll only use your details to send your brochure and help plan your
        wedding.
      </p>
    </form>
  );
}

function Field({
  htmlFor,
  label,
  required,
  error,
  children,
}: {
  htmlFor?: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-0.5">
        <Label htmlFor={htmlFor} className={cn("text-base", error && "text-destructive")}>
          {label}
        </Label>
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </div>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
