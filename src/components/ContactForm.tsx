"use client";

import { useActionState } from "react";
import { submitLead, type LeadFormState } from "@/lib/actions/leads";
import { Button } from "@/components/Button";

const initialState: LeadFormState = { error: null, success: false };

const inputClass =
  "w-full rounded-lg border border-(--color-border) bg-(--color-surface-raised) px-4 py-3 text-sm text-(--color-ink) outline-none transition-colors focus:border-(--color-gold)";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitLead, initialState);

  if (state.success) {
    return (
      <div className="rounded-2xl border border-(--color-border-gold) bg-(--color-surface) p-8 text-center">
        <h2 className="mt-0 text-xl font-semibold text-(--color-gold-bright)">Request received</h2>
        <p className="mb-0 text-(--color-muted)">
          Thanks for reaching out — a Boolean Global advisor will contact you shortly to schedule your
          free consultation.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm text-(--color-muted)">
          Full name
        </label>
        <input id="name" name="name" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-(--color-muted)">
          Email
        </label>
        <input id="email" name="email" type="email" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm text-(--color-muted)">
          Phone (optional)
        </label>
        <input id="phone" name="phone" type="tel" className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="message" className="text-sm text-(--color-muted)">
          What can we help with?
        </label>
        <textarea id="message" name="message" rows={4} className={inputClass} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending..." : "Request Free Consultation"}
      </Button>
      {state.error && <p className="m-0 text-sm text-red-400">{state.error}</p>}
      <p className="m-0 text-xs text-(--color-muted)">
        This form is for general inquiries only — please don&apos;t include your Social Security number
        or other sensitive information here.
      </p>
    </form>
  );
}
