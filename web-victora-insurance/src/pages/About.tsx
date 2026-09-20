import { BookOpen, HandHeart, MessageSquareQuote, ShieldCheck } from "lucide-react";

import CtaBand from "@/components/CtaBand";
import Crest from "@/components/Crest";
import Layout from "@/components/layout/Layout";
import { Section, SectionHeading } from "@/components/Section";
import { BRAND, CORE_VALUES, FUTURE_SERVICES, MISSION, VISION } from "@/lib/brand";

const VOICE: { instead: string; we: string }[] = [
  { instead: "Buy insurance today.", we: "Let's find the right coverage for your family." },
  { instead: "This is our best plan.", we: "Here are three options and what each one costs you in a bad year." },
  { instead: "You need to sign now.", we: "Take the comparison home. Call me with questions." },
];

export default function About() {
  return (
    <Layout>
      <Section tone="navy" className="py-16 md:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="eyebrow text-gold">About Victora</p>
            <h1 className="display mt-5 text-3xl leading-[1.12] text-ivory md:text-[3rem]">
              An independent agency built on education, not pressure.
            </h1>
            <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-ivory/70">
              Victora Insurance exists because too many people buy coverage they don't understand and discover the gaps at the worst possible
              moment. We do the opposite: we teach first, quote second, and stay your agent long after the paperwork is signed.
            </p>
          </div>
          <div className="mx-auto rounded-lg border border-ivory/12 bg-ivory/[0.04] p-8 text-center">
            <Crest onDark className="mx-auto h-20" />
            <p className="display mt-6 text-xl uppercase tracking-[0.14em] text-ivory">Victora</p>
            <p className="eyebrow mt-2 text-gold">Insurance</p>
            <div className="mx-auto mt-5 h-px w-20 rule-gold" />
            <p className="mt-5 text-[0.7rem] uppercase leading-relaxed tracking-[0.16em] text-ivory/50">{BRAND.tagline}</p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 md:grid-cols-2">
          <div className="animate-rise rounded-lg border border-border bg-card p-8">
            <ShieldCheck className="h-6 w-6 text-gold" />
            <h2 className="display mt-5 text-2xl text-navy">Our Mission</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">{MISSION}</p>
          </div>
          <div className="animate-rise rounded-lg border border-border bg-card p-8" style={{ animationDelay: "100ms" }}>
            <BookOpen className="h-6 w-6 text-gold" />
            <h2 className="display mt-5 text-2xl text-navy">Our Vision</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">{VISION}</p>
          </div>
        </div>
      </Section>

      <Section tone="ivory">
        <SectionHeading eyebrow="Core Values" title="What we hold ourselves to" />
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CORE_VALUES.map((v, i) => (
            <div key={v.title} className="card-lift animate-rise rounded-lg border border-border bg-card p-6" style={{ animationDelay: `${i * 70}ms` }}>
              <p className="display text-3xl text-gold/40">0{i + 1}</p>
              <h3 className="display mt-4 text-lg text-navy">{v.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="navy">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHeading
            onDark
            eyebrow="Brand Voice"
            title="Professional. Friendly. Never pushy."
            intro="We educate people instead of selling them. That's not a slogan — it changes the words we use on every single call."
          />
          <div className="space-y-5">
            {VOICE.map((v, i) => (
              <div key={v.we} className="animate-rise rounded-lg border border-ivory/12 bg-ivory/[0.035] p-6" style={{ animationDelay: `${i * 90}ms` }}>
                <p className="text-sm text-ivory/40 line-through decoration-destructive/60">{v.instead}</p>
                <p className="mt-3 flex items-start gap-3 text-[1.02rem] leading-relaxed text-ivory">
                  <MessageSquareQuote className="mt-1 h-4 w-4 shrink-0 text-gold" />
                  {v.we}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="The Road Ahead"
          title="Health insurance today. Full-service tomorrow."
          intro="We started with health coverage because it's where families need the most help and the most honesty. As Victora grows, these lines come next."
        />
        <div className="mt-12 flex flex-wrap gap-3">
          {FUTURE_SERVICES.map((f, i) => (
            <span
              key={f}
              className="animate-rise rounded-full border border-border bg-card px-5 py-2.5 text-sm text-navy/75"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {f}
            </span>
          ))}
        </div>
        <div className="mt-12 flex items-start gap-4 rounded-lg border border-gold/40 bg-gold/10 p-6">
          <HandHeart className="mt-0.5 h-6 w-6 shrink-0 text-gold" />
          <p className="leading-relaxed text-navy/80">
            Eventually Victora becomes a full-service insurance agency — auto, home, life, commercial — with the same standard we hold today:
            you will always understand what you own.
          </p>
        </div>
      </Section>

      <CtaBand />
    </Layout>
  );
}
