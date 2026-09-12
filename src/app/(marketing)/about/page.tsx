import { LinkButton } from "@/components/Button";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-(--color-gold)">
        About Us
      </p>
      <h1 className="text-4xl font-semibold">Build. Grow. Achieve.</h1>
      <div className="mt-8 flex flex-col gap-5 text-(--color-muted)">
        <p>
          Boolean Global was built around a simple idea: credit repair and credit building should be
          transparent, disciplined, and honest about what&apos;s actually possible. No inflated promises,
          no fees before work is done — just a clear process and a team that treats your file like it
          matters, because it does.
        </p>
        <p>
          We operate in compliance with the federal Credit Repair Organizations Act and Florida&apos;s
          credit service organization requirements. That means a written agreement before any repair work
          begins, your right to cancel within three business days of signing, and no fee for repair
          services until that work is actually performed.
        </p>
        <p>
          Whether you&apos;re cleaning up your credit report, building a profile from scratch, or getting
          ready for a major purchase, our goal is the same: give you a real plan and keep you informed
          every step of the way.
        </p>
      </div>
      <div className="mt-10">
        <LinkButton href="/contact">Talk to Us</LinkButton>
      </div>
    </div>
  );
}
