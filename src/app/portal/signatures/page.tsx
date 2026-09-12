import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { SignAgreementForm } from "@/components/SignAgreementForm";
import { EmptyState } from "@/components/EmptyState";
import { cancellationDeadline, formatDate } from "@/lib/dateFormat";
import { Signature } from "lucide-react";

export default async function PortalSignaturesPage() {
  const supabase = await createClient();
  const { data: clientId } = await supabase.rpc("current_client_id");

  const { data: request } = clientId
    ? await supabase
        .from("signature_requests")
        .select("id, title, rendered_body, status, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: signature } = request
    ? await supabase
        .from("signatures")
        .select("signature_text, signed_at")
        .eq("signature_request_id", request.id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="mt-0">Service Agreement</h1>

      {!request ? (
        <EmptyState icon={Signature}>
          Not sent yet — your advisor will send your service agreement once your intake is reviewed.
        </EmptyState>
      ) : (
        <Card title={request.title} icon={<Signature size={18} />}>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-surface-raised) p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm text-(--color-muted)">
              {request.rendered_body}
            </pre>
          </div>

          {request.status === "pending" && <SignAgreementForm requestId={request.id} />}

          {request.status === "signed" && signature && (
            <div className="mt-6 border-t border-(--color-border) pt-6">
              <p className="text-(--color-gold-bright)">
                Signed by {signature.signature_text} on {formatDate(signature.signed_at)}.
              </p>
              <p className="text-sm text-(--color-muted)">
                You may cancel this agreement without penalty until{" "}
                <strong className="text-(--color-ink)">
                  {formatDate(cancellationDeadline(signature.signed_at))}
                </strong>{" "}
                by contacting our office.
              </p>
            </div>
          )}

          {request.status === "voided" && (
            <p className="mt-6 text-sm text-(--color-muted)">
              This agreement was voided. Contact us if you have questions.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
