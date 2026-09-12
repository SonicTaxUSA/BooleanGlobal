"use client";

import { useActionState } from "react";
import { saveIntake, type IntakeFormState } from "@/lib/actions/intake";
import { Button } from "@/components/Button";
import type { Tables } from "@/lib/supabase/database.types";

const initialState: IntakeFormState = { error: null };
const inputClass =
  "w-full rounded-lg border border-(--color-border) bg-(--color-surface-raised) px-4 py-3 text-sm text-(--color-ink) outline-none transition-colors focus:border-(--color-gold)";
const labelClass = "text-sm text-(--color-muted)";

export function IntakeForm({
  clientId,
  intake,
}: {
  clientId: string;
  intake: Tables<"credit_intakes"> | null;
}) {
  const action = saveIntake.bind(null, clientId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const readOnly = intake?.status === "submitted";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="date_of_birth" className={labelClass}>
            Date of birth
          </label>
          <input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            defaultValue={intake?.date_of_birth ?? ""}
            disabled={readOnly}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="employment_status" className={labelClass}>
            Employment status
          </label>
          <input
            id="employment_status"
            name="employment_status"
            defaultValue={intake?.employment_status ?? ""}
            disabled={readOnly}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="monthly_income" className={labelClass}>
            Monthly income ($)
          </label>
          <input
            id="monthly_income"
            name="monthly_income"
            type="number"
            min="0"
            step="0.01"
            defaultValue={intake ? (intake.monthly_income_cents ?? 0) / 100 || "" : ""}
            disabled={readOnly}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="estimated_debt" className={labelClass}>
            Estimated total debt ($)
          </label>
          <input
            id="estimated_debt"
            name="estimated_debt"
            type="number"
            min="0"
            step="0.01"
            defaultValue={intake ? (intake.estimated_debt_cents ?? 0) / 100 || "" : ""}
            disabled={readOnly}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="primary_goal" className={labelClass}>
          What&apos;s your primary goal?
        </label>
        <input
          id="primary_goal"
          name="primary_goal"
          placeholder="e.g. raise my score, remove collections, become mortgage-ready"
          defaultValue={intake?.primary_goal ?? ""}
          disabled={readOnly}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="known_negative_items" className={labelClass}>
          Known negative items on your credit (if any)
        </label>
        <textarea
          id="known_negative_items"
          name="known_negative_items"
          rows={3}
          defaultValue={intake?.known_negative_items ?? ""}
          disabled={readOnly}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ssn" className={labelClass}>
          Social Security Number
        </label>
        <input
          id="ssn"
          name="ssn"
          placeholder="XXX-XX-XXXX"
          defaultValue={intake?.ssn ?? ""}
          disabled={readOnly}
          className={inputClass}
        />
        <p className="m-0 text-xs text-(--color-muted)">
          Required so we can pull your credit report. Stored securely and only visible to you and your
          assigned advisor.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm text-(--color-muted)">
        <input
          type="checkbox"
          name="authorized_credit_pull"
          defaultChecked={intake?.authorized_credit_pull ?? false}
          disabled={readOnly}
          className="mt-0.5"
        />
        I authorize Boolean Global to pull my credit report from one or more consumer reporting agencies.
      </label>

      {!readOnly && (
        <div className="flex gap-3">
          <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
            Save draft
          </Button>
          <Button type="submit" name="intent" value="submit" disabled={pending}>
            Submit intake
          </Button>
        </div>
      )}
      {readOnly && (
        <p className="m-0 text-sm text-(--color-gold-bright)">
          Submitted — contact your advisor if anything needs to change.
        </p>
      )}
      {state.error && <p className="m-0 text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
