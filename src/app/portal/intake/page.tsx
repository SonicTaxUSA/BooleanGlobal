import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { IntakeForm } from "@/components/IntakeForm";
import { FTC_DISCLOSURE_TEXT } from "@/lib/consent";
import { ClipboardList, ShieldCheck } from "lucide-react";

export default async function PortalIntakePage() {
  const supabase = await createClient();
  const { data: clientId } = await supabase.rpc("current_client_id");

  const { data: intake } = clientId
    ? await supabase.from("credit_intakes").select("*").eq("client_id", clientId).maybeSingle()
    : { data: null };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="mt-0">Intake</h1>

      <Card title="Consumer Credit File Rights" icon={<ShieldCheck size={18} />}>
        <details>
          <summary className="cursor-pointer text-sm text-(--color-gold)">
            Read your rights under state and federal law
          </summary>
          <pre className="mt-4 whitespace-pre-wrap font-sans text-sm text-(--color-muted)">
            {FTC_DISCLOSURE_TEXT}
          </pre>
        </details>
      </Card>

      <Card title="Your Information" icon={<ClipboardList size={18} />}>
        {clientId ? (
          <IntakeForm clientId={clientId} intake={intake} />
        ) : (
          <p className="text-(--color-muted)">
            We couldn&apos;t find your client record. Contact your advisor for help.
          </p>
        )}
      </Card>
    </div>
  );
}
