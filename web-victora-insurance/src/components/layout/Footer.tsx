import { Mail, Phone, ShieldCheck } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import Wordmark from "@/components/Wordmark";
import { BRAND, HEALTH_SERVICES } from "@/lib/brand";

const COMPANY: { to: string; label: string }[] = [
  { to: "/about", label: "About Victora" },
  { to: "/resources", label: "Resources & Glossary" },
  { to: "/business", label: "Business Insurance" },
  { to: "/contact", label: "Contact" },
  { to: "/client", label: "My Victora" },
  { to: "/admin", label: "Staff Console" },
];

const Footer = memo(() => (
  <footer className="navy-canvas relative overflow-hidden text-ivory">
    <div className="grid-veil absolute inset-0" aria-hidden />
    <div className="container relative py-16">
      <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr_1fr_1.1fr]">
        <div>
          <Wordmark onDark showTagline />
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-ivory/65">
            An independent agency. We compare across carriers and recommend what actually fits your family — never what pays us most.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-gold">
            <ShieldCheck className="h-4 w-4" />
            HIPAA-compliant intake
          </div>
        </div>

        <div>
          <h3 className="eyebrow text-gold">Health Plans</h3>
          <ul className="mt-5 space-y-3 text-sm text-ivory/70">
            {HEALTH_SERVICES.slice(0, 6).map((s) => (
              <li key={s.slug}>
                <Link to="/health-insurance" className="transition-colors hover:text-gold-light">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="eyebrow text-gold">Company</h3>
          <ul className="mt-5 space-y-3 text-sm text-ivory/70">
            {COMPANY.map((c) => (
              <li key={c.to}>
                <Link to={c.to} className="transition-colors hover:text-gold-light">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="eyebrow text-gold">Talk To Us</h3>
          <a href={BRAND.phoneHref} className="mt-5 flex items-center gap-3 text-lg text-ivory transition-colors hover:text-gold-light">
            <Phone className="h-4 w-4 text-gold" />
            {BRAND.phone}
          </a>
          <a href={`mailto:${BRAND.email}`} className="mt-3 flex items-center gap-3 text-sm text-ivory/70 transition-colors hover:text-gold-light">
            <Mail className="h-4 w-4 text-gold" />
            {BRAND.email}
          </a>
          <p className="mt-5 text-xs leading-relaxed text-ivory/50">{BRAND.hours}</p>
          <Link
            to="/quote"
            className="mt-6 inline-flex items-center justify-center border border-gold/60 px-5 py-3 text-xs uppercase tracking-[0.18em] text-gold transition-colors hover:bg-gold hover:text-navy-deep"
          >
            Request a Quote
          </Link>
        </div>
      </div>

      <div className="mt-14 h-px w-full rule-gold opacity-40" />

      <div className="mt-6 flex flex-col gap-4 text-[0.7rem] leading-relaxed text-ivory/45 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Victora Insurance. All rights reserved.</p>
        <p className="max-w-2xl md:text-right">
          Victora Insurance is an independent insurance agency. Quote estimates shown on this site are illustrative and not a binding offer of
          coverage. Final premiums, benefits, and eligibility are determined by the carrier and the Health Insurance Marketplace.
        </p>
      </div>
    </div>
  </footer>
));

Footer.displayName = "Footer";

export default Footer;
