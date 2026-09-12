import { ShieldCheck, TrendingUp, CheckCircle2 } from "lucide-react";
import { LinkButton } from "@/components/Button";
import { Card } from "@/components/Card";

const REPAIR_POINTS = [
  "Full credit report review across Equifax, Experian, and TransUnion",
  "Disputes filed for inaccurate, unverifiable, or outdated items",
  "Goodwill and validation letters where appropriate",
  "Regular progress updates through your client portal",
];

const BUILDER_POINTS = [
  "Utilization coaching to optimize your reported balances",
  "Guidance on primary tradelines, credit-builder loans, and rent reporting",
  "A plan built around your specific goal — mortgage, auto, or business funding",
  "Ongoing check-ins as your profile improves",
];

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-(--color-gold)">
          What We Do
        </p>
        <h1 className="text-4xl font-semibold">Credit Repair &amp; Credit Builder Services</h1>
        <p className="mx-auto mt-4 max-w-2xl text-(--color-muted)">
          Two distinct services, offered together or on their own, depending on where you&apos;re
          starting from.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card title="Credit Repair" icon={<ShieldCheck size={20} />}>
          <p className="text-(--color-muted)">
            For clients with negative items on their credit report — late payments, collections,
            charge-offs — that may be inaccurate, unverifiable, or outdated.
          </p>
          <ul className="mt-4 flex flex-col gap-3 pl-0">
            {REPAIR_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm text-(--color-muted)">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-(--color-gold)" />
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-(--color-muted)">
            We cannot guarantee removal of accurate, timely, and verifiable negative information — and we
            never charge for repair work before it&apos;s performed.
          </p>
        </Card>

        <Card title="Credit Builder" icon={<TrendingUp size={20} />}>
          <p className="text-(--color-muted)">
            For clients starting fresh, rebuilding after repair, or simply looking to strengthen an
            already-decent profile ahead of a major purchase.
          </p>
          <ul className="mt-4 flex flex-col gap-3 pl-0">
            {BUILDER_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm text-(--color-muted)">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-(--color-gold)" />
                {point}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-16 text-center">
        <LinkButton href="/contact">Book Your Free Consultation</LinkButton>
      </div>
    </div>
  );
}
