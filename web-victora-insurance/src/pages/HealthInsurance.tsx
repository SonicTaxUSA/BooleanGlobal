import { ArrowRight, Check, Info } from "lucide-react";
import { Link } from "react-router-dom";

import CtaBand from "@/components/CtaBand";
import Layout from "@/components/layout/Layout";
import { Section, SectionHeading } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { HEALTH_SERVICES } from "@/lib/brand";
import { cn } from "@/lib/utils";

const METAL_TIERS: { tier: string; pays: string; who: string; premium: string; deductible: string }[] = [
  { tier: "Bronze", pays: "~60% of costs", who: "Healthy, rarely see a doctor, want worst-case protection", premium: "Lowest", deductible: "Highest" },
  { tier: "Silver", pays: "~70% of costs", who: "Most people — and the only tier that unlocks extra cost-sharing savings", premium: "Moderate", deductible: "Moderate" },
  { tier: "Gold", pays: "~80% of costs", who: "Regular prescriptions, specialists, ongoing care", premium: "Higher", deductible: "Low" },
];

const NETWORKS: { type: string; freedom: string; referrals: string; cost: string }[] = [
  { type: "HMO", freedom: "In-network only, except emergencies", referrals: "Usually required for specialists", cost: "Lower premium" },
  { type: "PPO", freedom: "In and out of network", referrals: "Not required", cost: "Higher premium" },
  { type: "EPO", freedom: "In-network only", referrals: "Typically not required", cost: "Middle" },
];

export default function HealthInsurance() {
  return (
    <Layout>
      <Section tone="navy" className="py-16 md:py-24">
        <p className="eyebrow text-gold">Health Insurance</p>
        <h1 className="display mt-5 max-w-3xl text-3xl leading-[1.12] text-ivory md:text-[3rem]">
          Compare plans without the guesswork.
        </h1>
        <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-ivory/70">
          Individual, family, self-employed, and Marketplace coverage — reviewed against your income, your doctors, and your prescriptions
          before we ever hand you a recommendation.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-gold text-navy-deep hover:bg-gold-light">
            <Link to="/quote">Request a Quote</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-ivory/25 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory">
            <Link to="/book">Book a Consultation</Link>
          </Button>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Our Plans" title="What we can quote for you today" />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {HEALTH_SERVICES.filter((s) => !s.slug.startsWith("medicare")).map((s, i) => (
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
        <SectionHeading
          eyebrow="Coverage Comparison"
          title="Bronze vs. Silver vs. Gold"
          intro="Metal tiers describe how much of your medical costs the plan absorbs on average. They do not describe quality of care."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {METAL_TIERS.map((t, i) => (
            <div
              key={t.tier}
              className={cn(
                "card-lift animate-rise rounded-lg border bg-card p-7",
                t.tier === "Silver" ? "border-gold/60 ring-1 ring-gold/25" : "border-border",
              )}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <h3 className="display text-xl text-navy">{t.tier}</h3>
              <p className="mt-2 text-sm text-gold">{t.pays}</p>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{t.who}</p>
              <dl className="mt-6 space-y-2.5 border-t border-border pt-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Monthly premium</dt>
                  <dd className="font-medium text-navy">{t.premium}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Deductible</dt>
                  <dd className="font-medium text-navy">{t.deductible}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-md border border-gold/40 bg-gold/10 p-5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <p className="text-sm leading-relaxed text-navy/80">
            If your household income is under roughly 250% of the federal poverty level, a <strong>Silver</strong> plan can qualify for
            cost-sharing reductions — lowering your deductible and copays, not just your premium. This is the single most missed savings
            opportunity we see.
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Networks" title="HMO vs. PPO vs. EPO" intro="Network type decides which doctors you can use and how much freedom you have." />
        <div className="mt-12 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy text-ivory">
              <tr>
                <th className="px-5 py-4 font-medium uppercase tracking-[0.12em] text-[0.68rem]">Type</th>
                <th className="px-5 py-4 font-medium uppercase tracking-[0.12em] text-[0.68rem]">Doctor freedom</th>
                <th className="px-5 py-4 font-medium uppercase tracking-[0.12em] text-[0.68rem]">Referrals</th>
                <th className="px-5 py-4 font-medium uppercase tracking-[0.12em] text-[0.68rem]">Typical cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {NETWORKS.map((n) => (
                <tr key={n.type}>
                  <td className="px-5 py-4 display text-base text-navy">{n.type}</td>
                  <td className="px-5 py-4 text-muted-foreground">{n.freedom}</td>
                  <td className="px-5 py-4 text-muted-foreground">{n.referrals}</td>
                  <td className="px-5 py-4 text-muted-foreground">{n.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section tone="ivory">
        <SectionHeading
          eyebrow="Enrollment Windows"
          title="When you can actually enroll"
          intro="Missing a window is the most expensive mistake in health insurance. Here's how the calendar works."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            { t: "Open Enrollment", d: "Nov 1 – Jan 15 in most states. Anyone can enroll or switch plans, no questions asked." },
            { t: "Special Enrollment", d: "A 60-day window after a qualifying life event: marriage, birth, moving, or losing coverage." },
            { t: "Year-Round", d: "Medicaid, CHIP, and short-term options may be available at any time depending on eligibility." },
          ].map((w, i) => (
            <div key={w.t} className="animate-rise rounded-lg border border-border bg-card p-7" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="h-px w-10 rule-gold" />
              <h3 className="display mt-5 text-lg text-navy">{w.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{w.d}</p>
            </div>
          ))}
        </div>
        <Link to="/quote" className="mt-10 inline-flex items-center gap-2 text-sm uppercase tracking-[0.14em] text-navy transition-colors hover:text-gold">
          Check which window applies to you
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Section>

      <CtaBand />
    </Layout>
  );
}
