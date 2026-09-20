import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Check,
  Loader2,
  Lock,
  Phone,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BRAND } from "@/lib/brand";
import { api } from "@/lib/api";
import {
  COVERAGE_LABEL,
  currency,
  estimateQuote,
  loadLeads,
  newId,
  saveLeads,
  type Applicant,
  type CoverageType,
  type Lead,
  type QuoteEstimate,
  type QuoteRequest,
} from "@/lib/crm";
import { cn } from "@/lib/utils";

const COVERAGE_OPTIONS: { value: CoverageType; label: string; hint: string }[] = [
  { value: "marketplace", label: "Marketplace (ACA)", hint: "I want to see if I qualify for savings" },
  { value: "individual", label: "Individual Plan", hint: "Coverage for just me" },
  { value: "family", label: "Family Plan", hint: "Me, my spouse and/or children" },
  { value: "self-employed", label: "Self-Employed", hint: "1099, contractor, or business owner" },
  { value: "medicare-advantage", label: "Medicare Advantage", hint: "Part C with bundled extras" },
  { value: "medicare-supplement", label: "Medicare Supplement", hint: "Medigap alongside Original Medicare" },
  { value: "dental-vision", label: "Dental & Vision", hint: "Standalone dental and vision only" },
];

const PRIORITIES: string[] = [
  "Lowest monthly premium",
  "Keep my current doctors",
  "Prescription coverage",
  "Low deductible",
  "Maternity / pregnancy",
  "Mental health care",
  "Specialist access",
  "Dental & vision included",
];

const STEPS: string[] = ["Coverage", "Household", "Who's Covered", "Your Priorities", "Contact"];

const emptyApplicant = (): Applicant => ({ firstName: "", lastName: "", dob: "", tobacco: false });

type ContactInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredContact: "phone" | "email" | "text";
  language: string;
};

export default function Quote() {
  const [step, setStep] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<{ estimate: QuoteEstimate; lead: Lead } | null>(null);

  const [quote, setQuote] = useState<QuoteRequest>({
    coverageType: "marketplace",
    zip: "",
    state: "",
    householdSize: 1,
    annualIncome: 45000,
    applicants: [emptyApplicant()],
    currentlyInsured: false,
    priorities: [],
    doctors: "",
    prescriptions: "",
    notes: "",
  });

  const [contact, setContact] = useState<ContactInfo>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    preferredContact: "phone",
    language: "English",
  });

  const isMedicare = quote.coverageType === "medicare-advantage" || quote.coverageType === "medicare-supplement";

  const patch = useCallback((next: Partial<QuoteRequest>) => {
    setQuote((prev) => ({ ...prev, ...next }));
  }, []);

  const setApplicant = useCallback((index: number, next: Partial<Applicant>) => {
    setQuote((prev) => ({
      ...prev,
      applicants: prev.applicants.map((a, i) => (i === index ? { ...a, ...next } : a)),
    }));
  }, []);

  const addApplicant = useCallback(() => {
    setQuote((prev) => (prev.applicants.length >= 8 ? prev : { ...prev, applicants: [...prev.applicants, emptyApplicant()] }));
  }, []);

  const removeApplicant = useCallback((index: number) => {
    setQuote((prev) => ({
      ...prev,
      applicants: prev.applicants.length <= 1 ? prev.applicants : prev.applicants.filter((_, i) => i !== index),
    }));
  }, []);

  const togglePriority = useCallback((p: string) => {
    setQuote((prev) => ({
      ...prev,
      priorities: prev.priorities.includes(p) ? prev.priorities.filter((x) => x !== p) : [...prev.priorities, p],
    }));
  }, []);

  const stepValid = useMemo<boolean>(() => {
    if (step === 0) return quote.coverageType.length > 0;
    if (step === 1) return /^\d{5}$/.test(quote.zip) && quote.householdSize >= 1;
    if (step === 2) return quote.applicants.every((a) => a.firstName.trim().length > 0 && a.dob.length > 0);
    if (step === 3) return true;
    return (
      contact.firstName.trim().length > 1 &&
      /.+@.+\..+/.test(contact.email) &&
      contact.phone.replace(/\D/g, "").length >= 10
    );
  }, [step, quote, contact]);

  const next = useCallback(() => {
    if (!stepValid) {
      toast.error("Please complete this step so we can quote you accurately.");
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }, [stepValid]);

  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  const submit = useCallback(async () => {
    if (!stepValid) {
      toast.error("We need your name, email, and phone to send your quote.");
      return;
    }
    setSubmitting(true);
    try {
      const estimate = estimateQuote(quote);
      const now = new Date().toISOString();
      const lead: Lead = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        stage: "new",
        source: "website-quote",
        firstName: contact.firstName.trim(),
        lastName: contact.lastName.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
        preferredContact: contact.preferredContact,
        quote,
        estimate,
        activity: [{ id: newId(), at: now, label: "Quote request submitted through website" }],
      };
      saveLeads([lead, ...loadLeads()]);
      // Sync to the Victora server so the lead lands in the staff console.
      // If the API is unreachable the local copy above still stands.
      try {
        await api.captureLead({
          name: `${contact.firstName.trim()} ${contact.lastName.trim()}`.trim(),
          email: contact.email.trim().toLowerCase(),
          phone: contact.phone.trim(),
          source: "Website",
          campaign: new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined,
          preferred_language: contact.language,
          coverage_type: quote.coverageType,
          zip: quote.zip,
          details: `Preferred contact: ${contact.preferredContact} · Priorities: ${quote.priorities.join(", ") || "—"} · Doctors: ${quote.doctors || "—"} · Prescriptions: ${quote.prescriptions || "—"} · Notes: ${quote.notes || "—"}`,
        });
      } catch (apiError) {
        console.warn("Server lead sync failed; kept local copy", apiError);
      }
      setResult({ estimate, lead });
      toast.success("Quote request received — a licensed agent will reach out within one business day.");
    } catch (error) {
      console.error("Quote submission failed", error);
      toast.error("Something went wrong preparing your estimate. Please call us and we'll handle it personally.");
    } finally {
      setSubmitting(false);
    }
  }, [stepValid, quote, contact]);

  if (result) {
    return (
      <Layout>
        <QuoteResult estimate={result.estimate} lead={result.lead} />
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="navy-canvas relative overflow-hidden">
        <div className="grid-veil absolute inset-0" aria-hidden />
        <div className="container relative py-14 md:py-20">
          <p className="eyebrow text-gold">Request a Quote</p>
          <h1 className="display mt-4 max-w-2xl text-3xl leading-[1.15] text-ivory md:text-[2.7rem]">
            Five short steps. A real comparison at the end.
          </h1>
          <p className="mt-5 max-w-xl text-[1.02rem] leading-relaxed text-ivory/70">
            No pressure and no obligation. We use this to check your subsidy eligibility, your doctors, and your prescriptions before we
            recommend anything.
          </p>
          <p className="mt-6 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-ivory/50">
            <Lock className="h-3.5 w-3.5 text-gold" />
            Private &amp; HIPAA-conscious — never sold or shared
          </p>
        </div>
      </section>

      <div className="container py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <ol className="mb-10 flex flex-wrap items-center gap-x-2 gap-y-3">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-all",
                    i < step && "border-gold bg-gold text-navy-deep",
                    i === step && "border-navy bg-navy text-ivory",
                    i > step && "border-border bg-background text-muted-foreground",
                  )}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cn("text-xs uppercase tracking-[0.14em]", i === step ? "text-navy" : "text-muted-foreground")}>
                  {label}
                </span>
                {i < STEPS.length - 1 ? <span className="mx-1 hidden h-px w-6 bg-border sm:block" /> : null}
              </li>
            ))}
          </ol>

          <div className="rounded-lg border border-border bg-card p-6 shadow-crest md:p-9">
            {step === 0 ? (
              <div className="animate-rise">
                <StepTitle title="What kind of coverage are you looking for?" hint="Pick the closest match — we'll refine it together." />
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {COVERAGE_OPTIONS.map((opt) => {
                    const active = quote.coverageType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => patch({ coverageType: opt.value })}
                        className={cn(
                          "group flex flex-col items-start rounded-md border p-4 text-left transition-all duration-300",
                          active
                            ? "border-gold bg-gold/10 shadow-[0_10px_30px_-18px_hsl(41_54%_44%/0.6)]"
                            : "border-border bg-background hover:border-navy/30 hover:bg-secondary/50",
                        )}
                      >
                        <span className="flex w-full items-center justify-between">
                          <span className="display text-[1.05rem] text-navy">{opt.label}</span>
                          {active ? <Check className="h-4 w-4 text-gold" /> : null}
                        </span>
                        <span className="mt-1.5 text-sm text-muted-foreground">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="animate-rise">
                <StepTitle
                  title="Where do you live, and who's in your household?"
                  hint="ZIP decides your plan menu. Household and income decide your savings."
                />
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <Field label="ZIP Code">
                    <Input
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="78201"
                      value={quote.zip}
                      onChange={(e) => patch({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                    />
                  </Field>
                  <Field label="State">
                    <Input
                      placeholder="TX"
                      maxLength={2}
                      value={quote.state}
                      onChange={(e) => patch({ state: e.target.value.toUpperCase().slice(0, 2) })}
                    />
                  </Field>
                  <Field label="People in household (tax family)">
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={quote.householdSize}
                      onChange={(e) => patch({ householdSize: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
                    />
                  </Field>
                  <Field label="Estimated household income (per year)" hint="Used only for subsidy eligibility.">
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={quote.annualIncome}
                      onChange={(e) => patch({ annualIncome: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </Field>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Toggle
                    active={quote.currentlyInsured}
                    label="I have coverage right now"
                    onClick={() => patch({ currentlyInsured: !quote.currentlyInsured })}
                  />
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="animate-rise">
                <StepTitle title="Who needs to be covered?" hint="Age drives your rate, so dates of birth matter." />
                <div className="mt-7 space-y-4">
                  {quote.applicants.map((a, i) => (
                    <div key={`applicant-${i}`} className="rounded-md border border-border bg-background p-4">
                      <div className="flex items-center justify-between">
                        <p className="eyebrow text-navy/60">{i === 0 ? "Primary applicant" : `Person ${i + 1}`}</p>
                        {i > 0 ? (
                          <button
                            type="button"
                            onClick={() => removeApplicant(i)}
                            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        <Field label="First name">
                          <Input value={a.firstName} onChange={(e) => setApplicant(i, { firstName: e.target.value })} />
                        </Field>
                        <Field label="Last name">
                          <Input value={a.lastName} onChange={(e) => setApplicant(i, { lastName: e.target.value })} />
                        </Field>
                        <Field label="Date of birth">
                          <Input type="date" value={a.dob} onChange={(e) => setApplicant(i, { dob: e.target.value })} />
                        </Field>
                      </div>
                      <div className="mt-4">
                        <Toggle active={a.tobacco} label="Tobacco user" onClick={() => setApplicant(i, { tobacco: !a.tobacco })} />
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" onClick={addApplicant} className="mt-4 border-navy/20 text-navy">
                  <Plus className="mr-2 h-4 w-4 text-gold" />
                  Add another person
                </Button>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="animate-rise">
                <StepTitle title="What matters most in your plan?" hint="Select everything that applies. This shapes what we shortlist." />
                <div className="mt-7 flex flex-wrap gap-2.5">
                  {PRIORITIES.map((p) => (
                    <Toggle key={p} active={quote.priorities.includes(p)} label={p} onClick={() => togglePriority(p)} />
                  ))}
                </div>
                <div className="mt-8 grid gap-5">
                  <Field label="Doctors or hospitals you want to keep" hint="We verify each one against the plan network.">
                    <Textarea
                      rows={2}
                      placeholder="Dr. Alvarez — family medicine, Methodist Hospital"
                      value={quote.doctors}
                      onChange={(e) => patch({ doctors: e.target.value })}
                    />
                  </Field>
                  <Field label="Prescriptions you take regularly">
                    <Textarea
                      rows={2}
                      placeholder="Metformin 500mg, Levothyroxine 50mcg"
                      value={quote.prescriptions}
                      onChange={(e) => patch({ prescriptions: e.target.value })}
                    />
                  </Field>
                  <Field label="Anything else we should know?">
                    <Textarea
                      rows={3}
                      placeholder="Expecting a baby in the spring, and I just left my employer plan."
                      value={quote.notes}
                      onChange={(e) => patch({ notes: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="animate-rise">
                <StepTitle title="How should your agent reach you?" hint="A licensed Victora agent responds within one business day." />
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <Field label="First name">
                    <Input value={contact.firstName} onChange={(e) => setContact((c) => ({ ...c, firstName: e.target.value }))} />
                  </Field>
                  <Field label="Last name">
                    <Input value={contact.lastName} onChange={(e) => setContact((c) => ({ ...c, lastName: e.target.value }))} />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
                  </Field>
                  <Field label="Phone">
                    <Input type="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
                  </Field>
                  <Field label="Preferred language">
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-navy"
                      value={contact.language}
                      onChange={(e) => setContact((c) => ({ ...c, language: e.target.value }))}
                    >
                      <option>English</option>
                      <option>Spanish</option>
                    </select>
                  </Field>
                </div>
                <p className="mt-7 eyebrow text-navy/60">Preferred contact method</p>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {(["phone", "text", "email"] as const).map((m) => (
                    <Toggle
                      key={m}
                      active={contact.preferredContact === m}
                      label={m === "phone" ? "Phone call" : m === "text" ? "Text message" : "Email"}
                      onClick={() => setContact((c) => ({ ...c, preferredContact: m }))}
                    />
                  ))}
                </div>
                <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
                  By submitting, you consent to be contacted by Victora Insurance about health coverage. We never sell your information.
                  {isMedicare ? " We do not offer every plan available in your area; any information we provide is limited to the plans we do offer." : ""}
                </p>
              </div>
            ) : null}

            <div className="mt-10 flex items-center justify-between gap-4 border-t border-border pt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={back}
                disabled={step === 0}
                className="text-navy/70 hover:text-navy disabled:opacity-40"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={next} className="group bg-navy text-ivory hover:bg-navy-soft">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              ) : (
                <Button type="button" onClick={submit} disabled={submitting} className="bg-gold text-navy-deep hover:bg-gold-light">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  See My Estimate
                </Button>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Prefer to talk it through?{" "}
            <a href={BRAND.phoneHref} className="text-navy underline decoration-gold decoration-2 underline-offset-4">
              Call {BRAND.phone}
            </a>
          </p>
        </div>
      </div>
    </Layout>
  );
}

function StepTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="display text-2xl leading-snug text-navy md:text-[1.7rem]">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">{label}</Label>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Toggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-all duration-200 active:scale-[0.97]",
        active
          ? "border-gold bg-gold/15 text-navy"
          : "border-border bg-background text-muted-foreground hover:border-navy/30 hover:text-navy",
      )}
    >
      {label}
    </button>
  );
}

function QuoteResult({ estimate, lead }: { estimate: QuoteEstimate; lead: Lead }) {
  return (
    <>
      <section className="navy-canvas relative overflow-hidden">
        <div className="grid-veil absolute inset-0" aria-hidden />
        <div className="container relative py-16 md:py-20">
          <div className="flex items-center gap-3">
            <BadgeCheck className="h-6 w-6 text-gold" />
            <p className="eyebrow text-gold">Quote request received</p>
          </div>
          <h1 className="display mt-5 max-w-2xl text-3xl leading-[1.15] text-ivory md:text-[2.7rem]">
            Thank you, {lead.firstName}. Here's your starting point.
          </h1>
          <p className="mt-5 max-w-2xl text-[1.02rem] leading-relaxed text-ivory/70">
            These are illustrative estimates for {COVERAGE_LABEL[lead.quote.coverageType]} in ZIP {lead.quote.zip || "your area"}. A licensed
            Victora agent will confirm your real plan options, verify your doctors, and check every prescription — usually within one business
            day.
          </p>
          {estimate.subsidyEligible ? (
            <div className="mt-8 inline-flex flex-wrap items-center gap-3 rounded-md border border-gold/40 bg-gold/10 px-5 py-4">
              <Sparkles className="h-5 w-5 text-gold" />
              <span className="text-sm text-ivory">
                You appear to qualify for roughly{" "}
                <strong className="text-gold-light">{currency(estimate.estimatedSubsidy)}/mo</strong> in premium tax credits at{" "}
                {estimate.fplPercent}% of the federal poverty level.
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <div className="container py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {estimate.tiers.map((t, i) => (
            <div
              key={t.tier}
              className={cn(
                "card-lift animate-rise rounded-lg border bg-card p-7",
                t.tier === "Silver" ? "border-gold/60 ring-1 ring-gold/25" : "border-border",
              )}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {t.tier === "Silver" ? <p className="eyebrow mb-3 text-gold">Most chosen</p> : null}
              <h3 className="display text-xl text-navy">{t.tier}</h3>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="display text-4xl text-navy">{currency(t.netPremium)}</span>
                <span className="text-sm text-muted-foreground">/mo est.</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.bestFor}</p>
              <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
                <Row label="Deductible" value={currency(t.deductible)} />
                <Row label="Out-of-pocket max" value={currency(t.oopMax)} />
                <Row label="Doctor visit" value={t.copay > 0 ? `${currency(t.copay)} copay` : "After deductible"} />
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-lg border border-border bg-secondary/50 p-7 md:p-9">
          <h2 className="display text-2xl text-navy">What happens next</h2>
          <div className="mt-7 grid gap-6 md:grid-cols-3">
            {[
              { n: "01", t: "We review your details", d: "Income, household, doctors, and prescriptions are checked against every plan available to you." },
              { n: "02", t: "We compare side by side", d: "You get a plain-English comparison — premium, deductible, network, and drug costs together." },
              { n: "03", t: "You choose, we enroll you", d: "We handle the paperwork, confirm effective dates, and stay your agent all year." },
            ].map((s) => (
              <div key={s.n}>
                <p className="display text-2xl text-gold">{s.n}</p>
                <h3 className="mt-3 font-semibold text-navy">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="bg-navy text-ivory hover:bg-navy-soft">
              <Link to="/book">
                <CalendarCheck className="mr-2 h-4 w-4 text-gold" />
                Book your review call
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-navy/20 text-navy">
              <a href={BRAND.phoneHref}>
                <Phone className="mr-2 h-4 w-4 text-gold" />
                Call {BRAND.phone}
              </a>
            </Button>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">
          Estimates are illustrative only and are not an offer of insurance. Actual premiums, subsidies, deductibles, and benefits are
          determined by the carrier and the Health Insurance Marketplace based on verified information.
        </p>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-navy">{value}</dd>
    </div>
  );
}
