import Link from "next/link";
import type { ComponentProps } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";
const variants = {
  primary: "bg-(--color-gold) text-black hover:bg-(--color-gold-bright)",
  outline:
    "border border-(--color-border-gold) text-(--color-ink) hover:border-(--color-gold) hover:text-(--color-gold-bright)",
  ghost: "text-(--color-muted) hover:text-(--color-ink)",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof variants }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  href,
  children,
}: {
  variant?: keyof typeof variants;
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className} no-underline`}>
      {children}
    </Link>
  );
}
