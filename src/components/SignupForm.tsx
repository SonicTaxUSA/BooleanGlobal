"use client";

import { useActionState } from "react";
import { signUp, type AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/Button";

const initialState: AuthFormState = { error: null };
const inputClass =
  "w-full rounded-lg border border-(--color-border) bg-(--color-surface-raised) px-4 py-3 text-sm text-(--color-ink) outline-none transition-colors focus:border-(--color-gold)";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="full_name" className="text-sm text-(--color-muted)">
          Full name
        </label>
        <input id="full_name" name="full_name" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-(--color-muted)">
          Email
        </label>
        <input id="email" name="email" type="email" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-(--color-muted)">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className={inputClass}
        />
      </div>
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Creating account..." : "Create account"}
      </Button>
      {state.error && <p className="m-0 text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
