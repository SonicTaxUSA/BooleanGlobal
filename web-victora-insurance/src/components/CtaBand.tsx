import { ArrowRight, CalendarCheck, Phone } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

type CtaBandProps = {
  headline?: string;
  sub?: string;
};

const CtaBand = memo(({ headline = "Let's find the right coverage for your family.", sub = "Free consultation. No pressure, no obligation — just a clear comparison of your real options." }: CtaBandProps) => (
  <section className="navy-canvas relative overflow-hidden">
    <div className="grid-veil absolute inset-0" aria-hidden />
    <div className="container relative py-20 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow text-gold">Free Consultation</p>
        <h2 className="display mt-5 text-3xl leading-[1.15] text-ivory md:text-[2.7rem]">{headline}</h2>
        <p className="mx-auto mt-6 max-w-xl text-[1.02rem] leading-relaxed text-ivory/70">{sub}</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="group bg-gold text-navy-deep hover:bg-gold-light">
            <Link to="/quote">
              Request a Quote
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-ivory/25 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory">
            <Link to="/book">
              <CalendarCheck className="mr-2 h-4 w-4 text-gold" />
              Book a Consultation
            </Link>
          </Button>
          <a
            href={BRAND.phoneHref}
            className="flex items-center gap-2 px-4 py-2 text-sm text-ivory/70 transition-colors hover:text-gold-light"
          >
            <Phone className="h-4 w-4 text-gold" />
            {BRAND.phone}
          </a>
        </div>
      </div>
    </div>
  </section>
));

CtaBand.displayName = "CtaBand";

export default CtaBand;
