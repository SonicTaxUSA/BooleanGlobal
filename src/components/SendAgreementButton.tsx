"use client";

import { useState, useTransition } from "react";
import { createAgreementRequest, voidAgreementRequest } from "@/lib/actions/signatures";
import { Button } from "@/components/Button";

export function SendAgreementButton({ clientId }: { clientId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await createAgreementRequest(clientId);
            if (result.error) setError(result.error);
          })
        }
      >
        {pending ? "Sending..." : "Send Credit Agreement"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function VoidAgreementButton({ requestId, clientId }: { requestId: string; clientId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      className="!px-0 text-xs underline"
      onClick={() =>
        startTransition(() => {
          void voidAgreementRequest(requestId, clientId);
        })
      }
    >
      Void
    </Button>
  );
}
