import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { ShieldCheck, Signature } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { postListAgreementsForClient } from "../endpoints/agreements/listForClient_POST.schema";
import { postGetAgreement } from "../endpoints/agreements/get_POST.schema";
import { postMarkDisclosureViewed } from "../endpoints/agreements/markDisclosureViewed_POST.schema";
import { postSignAgreement } from "../endpoints/agreements/sign_POST.schema";
import styles from "./portal.agreement.module.css";

function computeCancellationDeadlineDisplay(signedAt: Date | string): string {
  const date = new Date(signedAt);
  let businessDaysAdded = 0;
  while (businessDaysAdded < 3) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) businessDaysAdded += 1;
  }
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function PortalAgreementPage() {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["agreements", "listForClient", "self"],
    queryFn: () => postListAgreementsForClient({}),
  });
  const latest = listQuery.data?.[0];

  const detailQuery = useQuery({
    queryKey: ["agreements", "get", latest?.id],
    queryFn: () => postGetAgreement({ agreementId: latest!.id }),
    enabled: !!latest,
  });

  const [hasReadDisclosure, setHasReadDisclosure] = useState(false);
  const [consent, setConsent] = useState(false);
  const [signatureText, setSignatureText] = useState("");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agreement = detailQuery.data?.agreement;
  const signature = detailQuery.data?.signature;

  useEffect(() => {
    if (agreement?.disclosureViewedAt) setHasReadDisclosure(true);
  }, [agreement?.disclosureViewedAt]);

  const handleConfirmDisclosure = async () => {
    if (!agreement) return;
    await postMarkDisclosureViewed({ agreementId: agreement.id });
    setHasReadDisclosure(true);
    await queryClient.invalidateQueries({ queryKey: ["agreements", "get", agreement.id] });
  };

  const handleSign = async () => {
    if (!agreement) return;
    setSigning(true);
    setError(null);
    try {
      await postSignAgreement({ agreementId: agreement.id, consentGiven: true, signatureText });
      await queryClient.invalidateQueries({ queryKey: ["agreements", "get", agreement.id] });
      await queryClient.invalidateQueries({ queryKey: ["agreements", "listForClient", "self"] });
      await queryClient.invalidateQueries({ queryKey: ["clients", "get", "self"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  if (listQuery.isLoading) {
    return <Skeleton className={styles.skeleton} />;
  }

  if (!latest) {
    return (
      <div>
        <Helmet>
          <title>Service Agreement — Boolean Global</title>
        </Helmet>
        <h1 className={styles.title}>Service Agreement</h1>
        <div className={styles.empty}>
          <Signature size={24} />
          <p>Not sent yet — your advisor will send your service agreement once your intake is reviewed.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Helmet>
        <title>Service Agreement — Boolean Global</title>
      </Helmet>
      <h1 className={styles.title}>Service Agreement</h1>

      {!hasReadDisclosure && agreement && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <ShieldCheck size={18} /> Consumer Credit File Rights
          </h2>
          <pre className={styles.disclosure}>{agreement.disclosureBody}</pre>
          <Button type="button" onClick={handleConfirmDisclosure}>
            I have read this disclosure
          </Button>
        </div>
      )}

      {hasReadDisclosure && agreement && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{agreement.title}</h2>
          <pre className={styles.body}>{agreement.renderedBody}</pre>

          {(agreement.version.includes("placeholder") || agreement.renderedBody.includes("PLACEHOLDER")) && (
            <p role="status" className={styles.error}>This agreement is a draft awaiting legal review. Signing is unavailable.</p>
          )}
          {agreement.status === "pending" && !signature && !agreement.version.includes("placeholder") && !agreement.renderedBody.includes("PLACEHOLDER") && (
            <div className={styles.signForm}>
              <label className={styles.consentRow}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                I have read this agreement and the disclosure above, and I agree to the terms, including my
                right to cancel without penalty until midnight of the third business day after signing.
              </label>
              <label className={styles.field}>
                <span>Type your full legal name to sign</span>
                <Input
                  value={signatureText}
                  onChange={(e) => setSignatureText(e.target.value)}
                  className={styles.signatureInput}
                />
              </label>
              <Button type="button" onClick={handleSign} disabled={!consent || !signatureText || signing}>
                {signing ? "Signing..." : "Sign Agreement"}
              </Button>
              {error && <p className={styles.error}>{error}</p>}
            </div>
          )}

          {signature && (
            <div className={styles.signedInfo}>
              <p className={styles.signedText}>
                Signed by {signature.signatureText} on {new Date(signature.signedAt).toLocaleDateString()}.
              </p>
              <p className={styles.deadlineText}>
                You may cancel this agreement without penalty until{" "}
                <strong>{computeCancellationDeadlineDisplay(signature.signedAt)}</strong> by contacting our
                office.
              </p>
            </div>
          )}

          {agreement.status === "voided" && <p className={styles.voidedText}>This agreement was voided. Contact us with questions.</p>}
        </div>
      )}
    </div>
  );
}