import { Clock, Loader2, Mail, Phone, Send, ShieldCheck } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import Layout from "@/components/layout/Layout";
import { Section, SectionHeading } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BRAND } from "@/lib/brand";
import { api } from "@/lib/api";
import { loadLeads, newId, saveLeads, type Lead } from "@/lib/crm";

export default function Contact() {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [heard, setHeard] = useState<string>("Website");
  const [language, setLanguage] = useState<string>("English");
  const [consent, setConsent] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);

  const valid = useMemo<boolean>(
    () => name.trim().length > 1 && /.+@.+\..+/.test(email) && message.trim().length > 4 && consent,
    [name, email, message, consent],
  );

  const submit = useCallback(async () => {
    if (!valid) {
      toast.error("Please add your name, a valid email, and a short message.");
      return;
    }
    setSending(true);
    try {
      const now = new Date().toISOString();
      const [first, ...rest] = name.trim().split(" ");
      const lead: Lead = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        stage: "new",
        source: "phone",
        firstName: first ?? name.trim(),
        lastName: rest.join(" "),
        email: email.trim(),
        phone: phone.trim(),
        preferredContact: phone.trim().length > 0 ? "phone" : "email",
        quote: {
          coverageType: "marketplace",
          zip: "",
          state: "",
          householdSize: 1,
          annualIncome: 0,
          applicants: [],
          currentlyInsured: false,
          priorities: [],
          doctors: "",
          prescriptions: "",
          notes: message.trim(),
        },
        estimate: null,
        activity: [{ id: newId(), at: now, label: "Contact form message received" }],
      };
      saveLeads([lead, ...loadLeads()]);
      try {
        await api.captureLead({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          source: heard,
          campaign: new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined,
          preferred_language: language,
          details: `Contact form: ${message.trim()}`,
        });
      } catch (apiError) {
        console.warn("Server lead sync failed; kept local copy", apiError);
      }
      setSent(true);
      toast.success("Message received — we'll be in touch shortly.");
    } catch (error) {
      console.error("Contact submission failed", error);
      toast.error("We couldn't send that. Please call us directly and we'll help right away.");
    } finally {
      setSending(false);
    }
  }, [valid, name, email, phone, message, heard, language, consent]);

  return (
    <Layout>
      <Section tone="navy" className="py-16 md:py-24">
        <p className="eyebrow text-gold">Contact</p>
        <h1 className="display mt-5 max-w-3xl text-3xl leading-[1.12] text-ivory md:text-[3rem]">
          A real person, same business day.
        </h1>
        <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-ivory/70">
          Call, email, or send a note. If you'd rather we come prepared with numbers, start with a quote request instead.
        </p>
      </Section>

      <div className="container py-14 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-5">
            <a
              href={BRAND.phoneHref}
              className="card-lift block rounded-lg border border-border bg-card p-7"
            >
              <Phone className="h-5 w-5 text-gold" />
              <p className="eyebrow mt-5 text-navy/60">Call us</p>
              <p className="display mt-2 text-2xl text-navy">{BRAND.phone}</p>
            </a>
            <a href={`mailto:${BRAND.email}`} className="card-lift block rounded-lg border border-border bg-card p-7">
              <Mail className="h-5 w-5 text-gold" />
              <p className="eyebrow mt-5 text-navy/60">Email us</p>
              <p className="mt-2 text-lg text-navy">{BRAND.email}</p>
            </a>
            <div className="rounded-lg border border-border bg-secondary/50 p-7">
              <Clock className="h-5 w-5 text-gold" />
              <p className="eyebrow mt-5 text-navy/60">Office hours</p>
              <p className="mt-2 leading-relaxed text-navy/80">{BRAND.hours}</p>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-gold/40 bg-gold/10 p-6">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <p className="text-sm leading-relaxed text-navy/80">
                We follow HIPAA privacy standards. Please don't include sensitive medical details in this form — we'll collect what's needed
                securely during your consultation.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-7 shadow-crest md:p-9">
            {sent ? (
              <div className="animate-rise py-6 text-center">
                <Send className="mx-auto h-8 w-8 text-gold" />
                <h2 className="display mt-6 text-2xl text-navy">Message sent.</h2>
                <p className="mx-auto mt-4 max-w-sm leading-relaxed text-muted-foreground">
                  Thank you, {name.split(" ")[0]}. A licensed Victora agent will follow up within one business day.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button asChild className="bg-navy text-ivory hover:bg-navy-soft">
                    <Link to="/quote">Request a quote too</Link>
                  </Button>
                  <Button asChild variant="outline" className="border-navy/20 text-navy">
                    <Link to="/book">Book a consultation</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="display text-2xl text-navy">Send us a note</h2>
                <p className="mt-2 text-sm text-muted-foreground">We answer every message personally.</p>
                <div className="mt-7 space-y-5">
                  <div>
                    <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Full name</Label>
                    <Input className="mt-2" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Email</Label>
                      <Input className="mt-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Phone (optional)</Label>
                      <Input className="mt-2" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">How did you hear about us?</Label>
                      <select
                        className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-navy"
                        value={heard}
                        onChange={(e) => setHeard(e.target.value)}
                      >
                        {["Instagram", "Facebook", "Google", "Website", "Referral", "Sonic Tax USA", "Partner", "Walk-in", "Agent", "Other"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Preferred language</Label>
                      <select
                        className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-navy"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        <option>English</option>
                        <option>Spanish</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">How can we help?</Label>
                    <Textarea className="mt-2" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
                  </div>
                  <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                    <Checkbox className="mt-0.5" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
                    <span>
                      I agree to be contacted by Victora Insurance about my coverage options. We never sell your information, and we only collect
                      what we need to help you.
                    </span>
                  </label>
                </div>
                <Button onClick={submit} disabled={sending} className="mt-7 w-full bg-navy text-ivory hover:bg-navy-soft">
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4 text-gold" />}
                  Send message
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <Section tone="ivory">
        <SectionHeading
          align="center"
          eyebrow="Faster route"
          title="Want numbers on the first call?"
          intro="Fill out the quote request and your agent arrives already knowing your subsidy range, doctors, and prescriptions."
        />
        <div className="mt-10 flex justify-center">
          <Button asChild size="lg" className="bg-gold text-navy-deep hover:bg-gold-light">
            <Link to="/quote">Request a Quote</Link>
          </Button>
        </div>
      </Section>
    </Layout>
  );
}
