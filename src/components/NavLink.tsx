"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/portal" && href !== "/dashboard" && pathname?.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm no-underline transition-colors ${
        active
          ? "bg-(--color-surface-raised) text-(--color-gold-bright)"
          : "text-(--color-muted) hover:bg-(--color-surface-raised) hover:text-(--color-ink)"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
