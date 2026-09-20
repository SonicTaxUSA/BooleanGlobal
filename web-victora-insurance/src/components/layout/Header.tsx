import { Menu, Phone, X } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import Wordmark from "@/components/Wordmark";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const NAV: { to: string; label: string }[] = [
  { to: "/about", label: "About" },
  { to: "/health-insurance", label: "Health Insurance" },
  { to: "/medicare", label: "Medicare" },
  { to: "/business", label: "Business" },
  { to: "/resources", label: "Resources" },
  { to: "/contact", label: "Contact" },
];

const Header = memo(() => {
  const [open, setOpen] = useState<boolean>(false);
  const [scrolled, setScrolled] = useState<boolean>(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <header className="sticky top-0 z-50">
      <div className="hidden bg-navy-deep text-ivory/70 md:block">
        <div className="container flex h-9 items-center justify-between text-[0.7rem] tracking-[0.14em]">
          <span className="uppercase">{BRAND.tagline}</span>
          <span className="flex items-center gap-6">
            <span className="uppercase text-ivory/50">{BRAND.hours}</span>
            <a href={BRAND.phoneHref} className="flex items-center gap-2 text-gold transition-colors hover:text-gold-light">
              <Phone className="h-3.5 w-3.5" />
              {BRAND.phone}
            </a>
          </span>
        </div>
      </div>

      <div
        className={cn(
          "border-b transition-all duration-300",
          scrolled ? "border-border bg-background/90 backdrop-blur-xl" : "border-transparent bg-background",
        )}
      >
        <div className="container flex h-20 items-center justify-between gap-4">
          <Wordmark />

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "relative px-3 py-2 text-sm font-medium text-navy/70 transition-colors hover:text-navy",
                    "after:absolute after:bottom-1 after:left-3 after:right-3 after:h-[2px] after:origin-left after:scale-x-0 after:bg-gold after:transition-transform after:duration-300 hover:after:scale-x-100",
                    isActive && "text-navy after:scale-x-100",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Button asChild variant="ghost" className="text-navy hover:bg-secondary">
              <Link to="/book">Book a Call</Link>
            </Button>
            <Button asChild className="bg-navy text-ivory hover:bg-navy-soft">
              <Link to="/quote">Request a Quote</Link>
            </Button>
          </div>

          <button
            type="button"
            onClick={toggle}
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-10 w-10 items-center justify-center rounded-sm border border-border text-navy lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="animate-fade border-b border-border bg-background lg:hidden">
          <div className="container flex flex-col py-4">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn("border-b border-border/60 py-3 text-sm font-medium", isActive ? "text-gold" : "text-navy/80")
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild className="bg-navy text-ivory hover:bg-navy-soft">
                <Link to="/quote">Request a Quote</Link>
              </Button>
              <Button asChild variant="outline" className="border-navy/20 text-navy">
                <Link to="/book">Book a Free Consultation</Link>
              </Button>
              <a href={BRAND.phoneHref} className="mt-1 flex items-center justify-center gap-2 py-2 text-sm text-navy">
                <Phone className="h-4 w-4 text-gold" />
                {BRAND.phone}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
});

Header.displayName = "Header";

export default Header;
