import { Check } from "lucide-react";
import { Link } from "react-router-dom";

import CtaBand from "@/components/CtaBand";
import Layout from "@/components/layout/Layout";
import { Section, SectionHeading } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { HEALTH_SERVICES } from "@/lib/brand";

const PARTS: { part: string; name: string; covers: string }[] = [
  { part: "Part A", name: "Hospital", covers: "Inpatient hospital stays, skilled nursing, hospice, some home health care." },
  { part: "Part B", name: "Medical", covers: "Doctor visits, outpatient care, preventive services, durable medical equipment." },
  { part: "Part C", name: "Medicare Advantage", covers: "A private plan that bundles A, B, usually D, and often dental, vision, and hearing." },
  { part: "Part D", name: "Prescriptions", covers: "Drug coverage through a private plan with its own formulary and pharmacy network." },
];

const COMPARE: { row: string; advantage: string; supplement: string }[] = [
  { row: "Monthly premium", advantage: "Often $0 (plus your Part B)", supplement: "Higher, predictable premium" },
  { row: "Doctor choice", advantage: "Plan network, referrals may apply", supplement: "Any provider accepting Medicare" },
  { row: "Out-of-pocket costs", advantage: "Copays as you use care, capped annually", supplement: "Very little at the point of care" },
  { row: "Extra benefits", advantage: "Dental, vision, hearing, fitness often bundled", supplement: "Medical only — add standalone plans" },
  { row: "Drug coverage", advantage: "Usually built in", supplement: "Requires a separate Part D plan" },
  { row: "Travel", advantage: "Best within your service area", supplement: "Works nationwide" },
];

const DEADLINES: { t: string; d: string }[] = [
  { t: "Initial Enrollment Period", d: "The 7 months around your 65th birthday — three before, your birth month, and three after." },
  { t: "Annual Enrollment (Oct 15 – Dec 7)", d: "Change Advantage or Part D plans for a January 1 start date." },
  { t: "Medicare Advantage Open Enrollment (Jan 1 – Mar 31)", d: "If you're already in an Advantage plan, you get one switch." },
  { t: "Special Enrollment Periods", d: "Moving, losing employer coverage, or a plan leaving your area can open a new window." },
];

export default function Medicare() {
  const medicareServices = HEALTH_SERVICES.filter((s) => s.slug.startsWith("medicare") || s.slug === "prescription" || s.slug === "dental-vision");

  return (
    <Layout>
      <Section tone="navy" className="py-16 md:py-24">
        <p className="eyebrow text-gold">Medicare</p>
        <h1 className="display mt-5 max-w-3xl text-3xl leading-[1.12] text-ivory md:text-[3rem]">
          Turning 65 shouldn't feel like a test.
        </h1>
        <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-ivory/70">
          Advantage or Supplement. Part D or not. We explain the real trade-offs, check your doctors and every prescription, and let you decide
          without a single sales tactic.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-gold text-navy-deep hover:bg-gold-light">
            <Link to="/quote">Compare My Medicare Options</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-ivory/25 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory">
            <Link to="/book">Book a Medicare Review</Link>
          </Button>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="The Basics" title="The four parts of Medicare" intro="Learn these once and the rest of the decision becomes simple." />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PARTS.map((p, i) => (
            <div key={p.part} className="card-lift animate-rise rounded-lg border border-border bg-card p-6" style={{ animationDelay: `${i * 70}ms` }}>
              <p className="eyebrow text-gold">{p.part}</p>
              <h3 className="display mt-3 text-lg text-navy">{p.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.covers}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="ivory">
        <SectionHeading eyebrow="Coverage Comparison" title="Medicare Advantage vs. Medicare Supplement" />
        <div className="mt-12 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy text-ivory">
              <tr>
                <th className="px-5 py-4 text-[0.68rem] font-medium uppercase tracking-[0.12em]">&nbsp;</th>
                <th className="px-5 py-4 text-[0.68rem] font-medium uppercase tracking-[0.12em]">Advantage (Part C)</th>
                <th className="px-5 py-4 text-[0.68rem] font-medium uppercase tracking-[0.12em]">Supplement (Medigap)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {COMPARE.map((c) => (
                <tr key={c.row}>
                  <td className="px-5 py-4 font-medium text-navy">{c.row}</td>
                  <td className="px-5 py-4 text-muted-foreground">{c.advantage}</td>
                  <td className="px-5 py-4 text-muted-foreground">{c.supplement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Neither is universally better. Advantage often wins on monthly cost and extras; Supplement wins on freedom and predictability. Your
          doctors, travel habits, and prescriptions decide it.
        </p>
      </Section>

      <Section>
        <SectionHeading eyebrow="What We Review" title="Medicare services at Victora" />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {medicareServices.map((s, i) => (
            <div key={s.slug} className="card-lift animate-rise rounded-lg border border-border bg-card p-7" style={{ animationDelay: `${i * 70}ms` }}>
              <h3 className="display text-xl text-navy">{s.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.blurb}</p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {s.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-navy/75">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="ivory">
        <SectionHeading eyebrow="Deadlines" title="Dates that actually matter" intro="Late enrollment penalties can follow you for life. We track these so you don't have to." />
        <div className="mt-12 divide-y divide-border border-y border-border">
          {DEADLINES.map((d) => (
            <div key={d.t} className="grid gap-2 py-6 md:grid-cols-[1fr_1.4fr]">
              <h3 className="display text-lg text-navy">{d.t}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{d.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
          We do not offer every plan available in your area. Any information we provide is limited to the plans we do offer in your area.
          Please contact Medicare.gov, 1-800-MEDICARE, or your State Health Insurance Assistance Program for information on all your options.
        </p>
      </Section>

      <CtaBand headline="Let's review your Medicare options together." sub="One call, no obligation. We'll compare what's actually available to you and explain every difference in plain English." />
    </Layout>
  );
}
