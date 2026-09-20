import { BookOpen, CalendarDays, FileCheck2, Lightbulb } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import CtaBand from "@/components/CtaBand";
import Layout from "@/components/layout/Layout";
import { Section, SectionHeading } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { CONTENT_CALENDAR, FAQS, GLOSSARY, SOPS } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Tab = "glossary" | "content" | "sops" | "faq";

const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: "glossary", label: "Plain-English Glossary", icon: BookOpen },
  { id: "faq", label: "Client FAQ", icon: Lightbulb },
  { id: "content", label: "Education Calendar", icon: CalendarDays },
  { id: "sops", label: "Operating Manual", icon: FileCheck2 },
];

export default function Resources() {
  const [tab, setTab] = useState<Tab>("glossary");

  return (
    <Layout>
      <Section tone="navy" className="py-16 md:py-24">
        <p className="eyebrow text-gold">Resources</p>
        <h1 className="display mt-5 max-w-3xl text-3xl leading-[1.12] text-ivory md:text-[3rem]">
          Understand it before you buy it.
        </h1>
        <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-ivory/70">
          Every term explained in plain English, the questions clients ask most, our weekly education schedule, and the operating standards
          every Victora agent follows.
        </p>
      </Section>

      <div className="border-b border-border bg-background">
        <div className="container flex gap-1 overflow-x-auto py-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-all active:scale-[0.98]",
                  active ? "border-gold bg-gold/15 text-navy" : "border-border text-muted-foreground hover:border-navy/30 hover:text-navy",
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-gold" : "text-navy/40")} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "glossary" ? (
        <Section>
          <SectionHeading
            eyebrow="Client Education"
            title="Insurance words, without the insurance words"
            intro="If your agent can't explain it this simply, ask a different agent."
          />
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {GLOSSARY.map((g, i) => (
              <div key={g.term} className="card-lift animate-rise rounded-lg border border-border bg-card p-6" style={{ animationDelay: `${i * 50}ms` }}>
                <h3 className="display text-lg text-navy">{g.term}</h3>
                <div className="mt-3 h-px w-8 rule-gold" />
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{g.plain}</p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {tab === "faq" ? (
        <Section>
          <SectionHeading eyebrow="Client FAQ" title="Straight answers to fair questions" />
          <div className="mt-14 divide-y divide-border border-y border-border">
            {FAQS.map((f) => (
              <div key={f.term} className="py-7">
                <h3 className="display text-lg text-navy">{f.term}</h3>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{f.plain}</p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {tab === "content" ? (
        <Section>
          <SectionHeading
            eyebrow="Education Calendar"
            title="What we publish, and why"
            intro="Victora runs a fixed weekly rhythm so our community learns something useful every day of the work week — never a sales pitch."
          />
          <div className="mt-14 space-y-4">
            {CONTENT_CALENDAR.map((d, i) => (
              <div
                key={d.day}
                className="animate-rise grid gap-4 rounded-lg border border-border bg-card p-6 md:grid-cols-[140px_1fr]"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div>
                  <p className="eyebrow text-gold">{d.day}</p>
                  <p className="display mt-2 text-base leading-snug text-navy">{d.theme}</p>
                </div>
                <div>
                  <p className="display text-lg text-navy/90">{d.example}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {tab === "sops" ? (
        <Section>
          <SectionHeading
            eyebrow="Operating Manual"
            title="Every Victora client gets the same process"
            intro="These are the standard operating procedures behind the agency. Consistency is how a small agency delivers big-agency reliability."
          />
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {SOPS.map((group, i) => (
              <div key={group.group} className="animate-rise rounded-lg border border-border bg-card p-7" style={{ animationDelay: `${i * 80}ms` }}>
                <h3 className="display text-xl text-navy">{group.group}</h3>
                <div className="mt-4 h-px w-12 rule-gold" />
                <ul className="mt-5 grid gap-2.5">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-navy/75">
                      <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-gold" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-lg border border-gold/40 bg-gold/10 p-6">
            <p className="leading-relaxed text-navy/80">
              Internal team? The lead pipeline, renewals, and appointment queue live in the{" "}
              <Link to="/portal" className="underline decoration-gold decoration-2 underline-offset-4">
                agent portal
              </Link>
              .
            </p>
          </div>
        </Section>
      ) : null}

      <Section tone="ivory">
        <SectionHeading align="center" eyebrow="Still unsure?" title="Bring us the confusing part" />
        <div className="mt-10 flex justify-center">
          <Button asChild size="lg" className="bg-navy text-ivory hover:bg-navy-soft">
            <Link to="/book">Book a Free Consultation</Link>
          </Button>
        </div>
      </Section>

      <CtaBand />
    </Layout>
  );
}
