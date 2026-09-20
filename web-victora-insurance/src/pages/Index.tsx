import {
  ArrowRight,
  CalendarCheck,
  FileSearch,
  HandHeart,
  HeartPulse,
  Phone,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import CtaBand from "@/components/CtaBand";
import Crest from "@/components/Crest";
import Layout from "@/components/layout/Layout";
import { Section, SectionHeading } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { AUDIENCES, BRAND, CORE_VALUES, FAQS, HEALTH_SERVICES, MISSION } from "@/lib/brand";
import { cn } from "@/lib/utils";

const PROOF: { value: string; label: string }[] = [
  { value: "$0", label: "Cost to work with us" },
  { value: "Multi-carrier", label: "Independent, not captive" },
  { value: "Same day", label: "Response to your questions" },
  { value: "All year", label: "Service after enrollment" },
];

const WHY: { icon: typeof ShieldCheck; title: string; body: string }[] = [
  {
    icon: FileSearch,
    title: "We compare, you decide",
    body: "As an independent agency we shop multiple carriers and lay the options side by side — premium, deductible, network, and drug costs together.",
  },
  {
    icon: Stethoscope,
    title: "Your doctors get verified",
    body: "Before we recommend anything, we check your physicians and prescriptions against the plan's actual network and formulary.",
  },
  {
    icon: HandHeart,
    title: "We stay after you enroll",
    body: "Billing questions, ID cards, claim denials, mid-year changes, renewals — you call us, not a 1-800 queue.",
  },
  {
    icon: ScrollText,
    title: "Plain English, always",
    body: "Deductible, copay, coinsurance, out-of-pocket max. You will understand exactly what you're buying before you sign.",
  },
];

export default function Index() {
  return (
    <Layout>
      {/* Hero */}
      <section className="navy-canvas relative overflow-hidden">
        <div className="grid-veil absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute -right-24 top-10 h-[420px] w-[420px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(41 54% 54% / 0.35), transparent 70%)" }}
          aria-hidden
        />
        <div className="container relative grid gap-16 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-28">
          <div>
            <p className="eyebrow animate-fade text-gold">Health Insurance · Independent Agency</p>
            <h1 className="display mt-7 text-[2.45rem] leading-[1.08] text-ivory sm:text-5xl lg:text-[3.6rem]">
              {["Your Health.", "Your Family.", "Your Future."].map((line, i) => (
                <span key={line} className="animate-rise block" style={{ animationDelay: `${120 + i * 110}ms` }}>
                  {line}
                </span>
              ))}
              <span className="animate-rise block text-gold-foil" style={{ animationDelay: "460ms" }}>
                Protected.
              </span>
            </h1>
            <p className="animate-rise mt-8 max-w-xl text-[1.06rem] leading-relaxed text-ivory/70" style={{ animationDelay: "560ms" }}>
              Health insurance doesn't have to be confusing. We'll help you compare plans, understand your options, and choose coverage that
              fits your needs and your budget.
            </p>
            <div className="animate-rise mt-10 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "660ms" }}>
              <Button asChild size="lg" className="group bg-gold text-navy-deep hover:bg-gold-light">
                <Link to="/quote">
                  Get My Free Quote
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-ivory/25 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory">
                <Link to="/book">
                  <CalendarCheck className="mr-2 h-4 w-4 text-gold" />
                  Free Consultation
                </Link>
              </Button>
              <a href={BRAND.phoneHref} className="flex items-center gap-2 px-2 py-2 text-sm text-ivory/70 transition-colors hover:text-gold-light">
                <Phone className="h-4 w-4 text-gold" />
                {BRAND.phone}
              </a>
            </div>
            <div className="animate-fade mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-ivory/10 pt-8 sm:grid-cols-4" style={{ animationDelay: "800ms" }}>
              {PROOF.map((p) => (
                <div key={p.label}>
                  <p className="display text-xl text-gold-light">{p.value}</p>
                  <p className="mt-1.5 text-[0.7rem] uppercase leading-relaxed tracking-[0.12em] text-ivory/50">{p.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-rise relative mx-auto w-full max-w-sm" style={{ animationDelay: "300ms" }}>
            <div className="relative rounded-lg border border-ivory/12 bg-ivory/[0.04] p-8 backdrop-blur-sm">
              <div className="absolute inset-x-8 top-0 h-px rule-gold animate-sheen" aria-hidden />
              <Crest onDark className="h-16" />
              <p className="eyebrow mt-7 text-gold">Where do we start?</p>
              <h2 className="display mt-3 text-2xl leading-snug text-ivory">Two minutes now, real numbers today.</h2>
              <ul className="mt-7 space-y-4">
                {[
                  { icon: HeartPulse, t: "Check your subsidy eligibility" },
                  { icon: Users, t: "Cover your whole household" },
                  { icon: Stethoscope, t: "Keep the doctors you trust" },
                  { icon: ShieldCheck, t: "Private, HIPAA-conscious intake" },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <li key={row.t} className="flex items-center gap-3 text-sm text-ivory/75">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-gold/10">
                        <Icon className="h-4 w-4 text-gold" />
                      </span>
                      {row.t}
                    </li>
                  );
                })}
              </ul>
              <Button asChild className="mt-8 w-full bg-ivory text-navy hover:bg-gold hover:text-navy-deep">
                <Link to="/quote">Start My Quote</Link>
              </Button>
              <p className="mt-4 text-center text-[0.68rem] uppercase tracking-[0.14em] text-ivory/40">No cost · No obligation</p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission strip */}
      <div className="border-b border-border bg-secondary/50">
        <div className="container py-10">
          <p className="mx-auto max-w-4xl text-center text-[1.05rem] leading-relaxed text-navy/80 md:text-[1.15rem]">
            <span className="display text-gold">“</span>
            {MISSION}
            <span className="display text-gold">”</span>
          </p>
        </div>
      </div>

      {/* Coverage */}
      <Section>
        <SectionHeading
          eyebrow="Health Coverage"
          title="Coverage for every stage of life"
          intro="We specialize in health insurance today — from a 24-year-old leaving a parent's plan to a family of five to a retiree turning 65."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {HEALTH_SERVICES.map((s, i) => (
            <Link
              key={s.slug}
              to={s.slug.startsWith("medicare") ? "/medicare" : "/health-insurance"}
              className="card-lift animate-rise group rounded-lg border border-border bg-card p-6"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="h-px w-10 rule-gold" />
              <h3 className="display mt-5 text-lg leading-snug text-navy">{s.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.blurb}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-navy/60 transition-colors group-hover:text-gold">
                Explore
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* Why Victora */}
      <Section tone="navy">
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionHeading
            onDark
            eyebrow="Why Victora"
            title={<>You deserve coverage you understand.</>}
            intro="No confusing terms. No pressure. No hidden surprises. Just honest advice and personalized health insurance options."
          />
          <div className="grid gap-6 sm:grid-cols-2">
            {WHY.map((w, i) => {
              const Icon = w.icon;
              return (
                <div
                  key={w.title}
                  className="animate-rise rounded-lg border border-ivory/12 bg-ivory/[0.035] p-6 transition-colors duration-300 hover:border-gold/40"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <Icon className="h-6 w-6 text-gold" />
                  <h3 className="display mt-5 text-lg text-ivory">{w.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ivory/65">{w.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Audiences */}
      <Section tone="ivory">
        <SectionHeading
          eyebrow="Who We Help"
          title="Insurance shaped around your situation"
          intro="Your coverage should reflect your life, not a template. These are the people we work with every day."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {AUDIENCES.map((a, i) => (
            <div
              key={a.title}
              className="card-lift animate-rise rounded-lg border border-border bg-card p-6"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <h3 className="display text-lg text-navy">{a.title}</h3>
              <p className="mt-1.5 text-sm text-gold">{a.detail}</p>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {a.points.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-gold" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Values */}
      <Section>
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHeading
            eyebrow="Our Standard"
            title="Six values we actually operate by"
            intro="Every quote, phone call, and renewal at Victora runs through these. They're not wall art — they're the process."
          />
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {CORE_VALUES.map((v, i) => (
              <div key={v.title} className="animate-rise" style={{ animationDelay: `${i * 70}ms` }}>
                <p className={cn("display text-lg text-navy")}>
                  <span className="mr-2 text-gold">0{i + 1}</span>
                  {v.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section tone="ivory">
        <SectionHeading align="center" eyebrow="Common Questions" title="The things everyone asks first" />
        <div className="mx-auto mt-14 max-w-3xl divide-y divide-border border-y border-border">
          {FAQS.map((f) => (
            <div key={f.term} className="py-6">
              <h3 className="display text-lg text-navy">{f.term}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{f.plain}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand />
    </Layout>
  );
}
