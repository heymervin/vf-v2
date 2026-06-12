"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { createContact, updateContact } from "./actions";

export interface ContactFormValues {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  partner_first_name: string;
  partner_last_name: string;
  wedding_date: string;
  wedding_date_flexible: boolean;
  guest_count: string;
  budget: string;
  source: string;
}

const EMPTY: ContactFormValues = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  partner_first_name: "",
  partner_last_name: "",
  wedding_date: "",
  wedding_date_flexible: false,
  guest_count: "",
  budget: "",
  source: "",
};

interface ContactFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit for create; provide id + values for edit. */
  contactId?: string;
  initialValues?: Partial<ContactFormValues>;
}

export function ContactFormSheet({
  open,
  onOpenChange,
  contactId,
  initialValues,
}: ContactFormSheetProps) {
  const router = useRouter();
  const isEdit = contactId != null;
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({ defaultValues: EMPTY });

  // Reset form to the right values whenever the sheet opens.
  React.useEffect(() => {
    if (open) {
      reset({ ...EMPTY, ...initialValues });
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const flexible = watch("wedding_date_flexible");

  async function onSubmit(values: ContactFormValues) {
    setServerError(null);
    const result = isEdit
      ? await updateContact(contactId!, values)
      : await createContact(values);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    toast.success(isEdit ? "Contact updated." : "Contact created.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit contact" : "New contact"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update the details for this enquiry."
              : "Add an enquiry. It starts in Inbound enquiry on your pipeline."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            {/* Lead */}
            <div className="grid grid-cols-2 gap-3">
              <Field
                htmlFor="first_name"
                label="First name"
                required
                error={errors.first_name?.message}
              >
                <Input
                  id="first_name"
                  {...register("first_name", {
                    required: "First name is required.",
                    maxLength: { value: 100, message: "Too long." },
                  })}
                  aria-invalid={!!errors.first_name}
                  autoFocus
                />
              </Field>
              <Field htmlFor="last_name" label="Last name">
                <Input id="last_name" {...register("last_name", { maxLength: 100 })} />
              </Field>
            </div>

            {/* Contact details */}
            <Field htmlFor="email" label="Email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                inputMode="email"
                {...register("email", {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Enter a valid email address.",
                  },
                })}
                aria-invalid={!!errors.email}
              />
            </Field>
            <Field htmlFor="phone" label="Phone">
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                {...register("phone", { maxLength: 40 })}
              />
            </Field>

            {/* Partner */}
            <div className="grid grid-cols-2 gap-3">
              <Field htmlFor="partner_first_name" label="Partner first name">
                <Input
                  id="partner_first_name"
                  {...register("partner_first_name", { maxLength: 100 })}
                />
              </Field>
              <Field htmlFor="partner_last_name" label="Partner last name">
                <Input
                  id="partner_last_name"
                  {...register("partner_last_name", { maxLength: 100 })}
                />
              </Field>
            </div>

            {/* Wedding */}
            <Field htmlFor="wedding_date" label="Wedding date">
              <Input id="wedding_date" type="date" {...register("wedding_date")} />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <Label htmlFor="wedding_date_flexible" className="cursor-pointer">
                Date is flexible
              </Label>
              <Switch
                id="wedding_date_flexible"
                checked={flexible}
                onCheckedChange={(v) => setValue("wedding_date_flexible", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                htmlFor="guest_count"
                label="Guest count"
                error={errors.guest_count?.message}
              >
                <Input
                  id="guest_count"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  {...register("guest_count", {
                    pattern: { value: /^\d*$/, message: "Whole number only." },
                  })}
                  aria-invalid={!!errors.guest_count}
                />
              </Field>
              <Field
                htmlFor="budget"
                label="Budget (£)"
                error={errors.budget?.message}
              >
                <Input
                  id="budget"
                  type="number"
                  min={0}
                  step="1"
                  inputMode="decimal"
                  {...register("budget", {
                    pattern: { value: /^\d*\.?\d*$/, message: "Numbers only." },
                  })}
                  aria-invalid={!!errors.budget}
                />
              </Field>
            </div>

            <Field htmlFor="source" label="Source">
              <Input
                id="source"
                placeholder="e.g. Website, Hitched, referral"
                {...register("source", { maxLength: 80 })}
              />
            </Field>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Create contact"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
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
        <Label htmlFor={htmlFor} className={cn(error && "text-destructive")}>
          {label}
        </Label>
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
