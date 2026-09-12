import Link from "next/link";
import { ClipboardList, Signature, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { cancellationDeadline, formatDate } from "@/lib/dateFormat";

export default async function PortalDashboardPage() {
  const supabase = await createClient();
  const { data: clientId } = await supabase.rpc("current_client_id");

  const [{ data: intake }, { data: request }] = await Promise.all([
    clientId
      ? supabase.from("credit_intakes").select("status").eq("client_id", clientId).maybeSingle()
      : Promise.resolve({ data: null }),
    clientId
      ? supabase
          .from("signature_requests")
          .select("id, status, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: signedRow } = request
    ? await supabase
        .from("signatures")
        .select("signed_at")
        .eq("signature_request_id", request.id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="mt-0">Welcome back</h1>

      <Card title="Intake" icon={<ClipboardList size={18} />}>
        {!intake ? (
          <p className="text-(--color-muted)">
            You haven&apos;t started your intake yet — we need this before we can send your service
            agreement.
          </p>
        ) : intake.status === "submitted" ? (
          <p className="text-(--color-gold-bright)">Submitted — thanks! Your advisor is reviewing it.</p>
        ) : (
          <p className="text-(--color-muted)">In progress — pick up where you left off.</p>
        )}
        <Link href="/portal/intake" className="mt-2 inline-flex items-center gap-1 text-(--color-gold) no-underline">
          {intake?.status === "submitted" ? "View intake" : "Continue intake"} <ArrowRight size={14} />
        </Link>
      </Card>

      <Card title="Service Agreement" icon={<Signature size={18} />}>
        {!request ? (
          <p className="text-(--color-muted)">
            Not sent yet — your advisor will send your service agreement once your intake is reviewed.
          </p>
        ) : request.status === "pending" ? (
          <>
            <p className="text-(--color-gold-bright)">Ready for your signature.</p>
            <Link href="/portal/signatures" className="inline-flex items-center gap-1 text-(--color-gold) no-underline">
              Review &amp; sign <ArrowRight size={14} />
            </Link>
          </>
        ) : request.status === "signed" ? (
          <>
            <p className="text-(--color-gold-bright)">
              Signed {signedRow?.signed_at ? `on ${formatDate(signedRow.signed_at)}` : ""}.
            </p>
            {signedRow?.signed_at && (
              <p className="text-sm text-(--color-muted)">
                You may cancel this agreement without penalty until{" "}
                <strong className="text-(--color-ink)">
                  {formatDate(cancellationDeadline(signedRow.signed_at))}
                </strong>{" "}
                by contacting our office.
              </p>
            )}
          </>
        ) : (
          <p className="text-(--color-muted)">This agreement was voided. Contact us with questions.</p>
        )}
      </Card>
    </div>
  );
}
