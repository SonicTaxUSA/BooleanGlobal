import { Building2, Check, Clock, Users } from "lucide-react";
import { Link } from "react-router-dom";

import CtaBand from "@/components/CtaBand";
import Layout from "@/components/layout/Layout";
import { Section, SectionHeading } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { FUTURE_SERVICES } from "@/lib/brand";

const OFFERINGS: { title: string; body: string; bullets: string[] }[] = [
  {
    title: "Small Group Health",
    body: "Traditional group coverage for teams that want one plan with employer contribution.",
    bullets: ["Carrier and network comparison", "Employer contribution modeling", "Employee education meetings", "Annual renewal negotiation"],
  },
  {
    title: "ICHRA Strategy",
    body: "Give employees a tax-free allowance to buy their own individual plan — often cheaper than group.",
    bullets: ["Allowance design by class", "Individual plan guidance per employee", "Compliance documentation", "Administration setup"],
  },
  {
    title: "Employee Benefit Education",
    body: "The reason benefits go unused is that nobody explains them. We fix that on your behalf.",
    bullets: ["Onboarding benefit sessions", "Plain-English plan summaries", "Open enrollment support", "Year-round employee helpline"],
  },
  {
    title: "Self-Employed & Solo",
    body: "One-person businesses, contractors, and partners with variable 1099 income.",
    bullets: ["Income estimation strategy", "Premium deductibility guidance", "Spouse and dependent options", "Mid-year income change reporting"],
  },
];

export default function Business() {
  return (
    <Layout>
      <Section tone="navy" className="py-16 md:py-24">
        <p className="eyebrow text-gold">Business Insurance</p>
        <h1 className="display mt-5 max-w-3xl text-3xl leading-[1.12] text-ivory md:text-[3rem]">
          Benefits that keep good people.
        </h1>
        <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-ivory/70">
          Whether you're a team of two or twenty, we design health benefits your employees actually understand and use — then we handle the
          questions so you don't have to.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-gold text-navy-deep hover:bg-gold-light">
            <Link to="/quote">Request a Group Quote</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-ivory/25 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory">
            <Link to="/book">Book a Benefits Consultation</Link>
          </Button>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="What We Offer" title="Group and self-employed health strategies" />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {OFFERINGS.map((o, i) => (
            <div key={o.title} className="card-lift animate-rise rounded-lg border border-border bg-card p-7" style={{ animationDelay: `${i * 70}ms` }}>
              <h3 className="display text-xl text-navy">{o.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{o.body}</p>
              <ul className="mt-6 grid gap-2.5">
                {o.bullets.map((b) => (
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
        <SectionHeading eyebrow="Why It Matters" title="Benefits are a retention tool, not a line item" />
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {[
            { icon: Users, t: "People stay where they feel covered", d: "Health benefits are consistently among the top reasons employees decline outside offers." },
            { icon: Clock, t: "You get your time back", d: "Employees call us with plan questions, ID card issues, and claim problems — not your office manager." },
            { icon: Building2, t: "Predictable annual planning", d: "We review renewals early, model alternatives, and bring you options before rates lock in." },
          ].map((w, i) => {
            const Icon = w.icon;
            return (
              <div key={w.t} className="animate-rise" style={{ animationDelay: `${i * 90}ms` }}>
                <Icon className="h-6 w-6 text-gold" />
                <h3 className="display mt-5 text-lg text-navy">{w.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{w.d}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Coming Soon"
          title="Commercial lines on the roadmap"
          intro="Health coverage is our focus today. These commercial products are being added as Victora expands its carrier appointments."
        />
        <div className="mt-12 flex flex-wrap gap-3">
          {FUTURE_SERVICES.map((f) => (
            <span key={f} className="rounded-full border border-border bg-card px-5 py-2.5 text-sm text-navy/70">
              {f}
            </span>
          ))}
        </div>
      </Section>

      <CtaBand headline="Let's design benefits your team will actually use." sub="A short consultation tells us whether group coverage, an ICHRA allowance, or individual plans is the smarter route for your business." />
    </Layout>
  );
}
