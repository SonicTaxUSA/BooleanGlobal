import Link from "next/link";
import { ShieldCheck, TrendingUp, FileCheck, Users } from "lucide-react";
import { LinkButton } from "@/components/Button";
import { Card } from "@/components/Card";

const TRUST_POINTS = [
  { icon: ShieldCheck, label: "CROA-compliant process" },
  { icon: FileCheck, label: "No repair fees charged upfront" },
  { icon: Users, label: "Dedicated advisor for every client" },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-(--color-gold)">
          Build. Grow. Achieve.
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
          Your credit, <span className="gold-text">rebuilt and reinforced</span> — the right way.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-(--color-muted)">
          Boolean Global helps you dispute inaccurate items on your credit report and build the credit
          profile you need for what&apos;s next — a home, a car, a business. Clear process, no upfront
          repair fees, no guarantees we can&apos;t back up.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <LinkButton href="/contact">Get Started</LinkButton>
          <LinkButton href="/services" variant="outline">
            See Our Services
          </LinkButton>
        </div>
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {TRUST_POINTS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center justify-center gap-2 rounded-full border border-(--color-border) px-4 py-3 text-sm text-(--color-muted)"
            >
              <Icon size={16} className="text-(--color-gold)" />
              {label}
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-(--color-border) bg-(--color-surface)">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-semibold">Two services. One goal: your best profile.</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card title="Credit Repair" icon={<ShieldCheck size={18} />}>
              <p className="text-(--color-muted)">
                We review your credit reports across all three bureaus, identify inaccurate, unverifiable,
                or outdated items, and pursue disputes on your behalf — with full transparency and no
                guarantees of results we can&apos;t deliver.
              </p>
              <Link href="/services" className="mt-4 inline-block text-(--color-gold) no-underline">
                Learn more &rarr;
              </Link>
            </Card>
            <Card title="Credit Builder" icon={<TrendingUp size={18} />}>
              <p className="text-(--color-muted)">
                Beyond repair, we help you establish and strengthen your credit profile — utilization
                coaching, primary tradelines, and a plan tailored to your goals, whether that&apos;s a
                mortgage, an auto loan, or funding for your business.
              </p>
              <Link href="/services" className="mt-4 inline-block text-(--color-gold) no-underline">
                Learn more &rarr;
              </Link>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold">Ready to start?</h2>
        <p className="mx-auto mt-4 max-w-xl text-(--color-muted)">
          Book a free consultation. We&apos;ll review where your credit stands today and walk you through
          what a plan with Boolean Global looks like — no pressure, no obligation.
        </p>
        <div className="mt-8">
          <LinkButton href="/contact">Book Your Free Consultation</LinkButton>
        </div>
      </section>
    </>
  );
}
