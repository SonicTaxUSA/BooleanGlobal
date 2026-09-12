"use client";

import { useActionState } from "react";
import { submitSignature, type SignatureActionState } from "@/lib/actions/signatures";
import { Button } from "@/components/Button";

const initialState: SignatureActionState = { error: null };

export function SignAgreementForm({ requestId }: { requestId: string }) {
  const action = submitSignature.bind(null, requestId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4 border-t border-(--color-border) pt-6">
      <label className="flex items-start gap-2 text-sm text-(--color-muted)">
        <input type="checkbox" name="consent" className="mt-0.5" required />
        I have read this agreement and the Consumer Credit File Rights disclosure, and I agree to the
        terms above, including my right to cancel without penalty until midnight of the third business
        day after signing.
      </label>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="signature_text" className="text-sm text-(--color-muted)">
          Type your full legal name to sign
        </label>
        <input
          id="signature_text"
          name="signature_text"
          required
          className="w-full rounded-lg border border-(--color-border) bg-(--color-surface-raised) px-4 py-3 font-serif text-lg italic text-(--color-ink) outline-none focus:border-(--color-gold)"
        />
      </div>
      <input type="hidden" name="signature_type" value="typed" />
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Signing..." : "Sign Agreement"}
      </Button>
      {state.error && <p className="m-0 text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
