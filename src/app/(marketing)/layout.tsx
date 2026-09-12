import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LinkButton } from "@/components/Button";

const NAV = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-(--color-border)">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="no-underline">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-(--color-muted) no-underline transition-colors hover:text-(--color-ink)"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-(--color-muted) no-underline transition-colors hover:text-(--color-ink)"
            >
              Log in
            </Link>
            <LinkButton href="/contact" className="!px-5 !py-2 text-sm">
              Free Consultation
            </LinkButton>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-(--color-border)">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-(--color-muted) md:flex-row md:items-center md:justify-between">
          <Logo size="sm" />
          <nav className="flex gap-6">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="no-underline hover:text-(--color-ink)">
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="m-0">© {new Date().getFullYear()} Boolean Global. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
