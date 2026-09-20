import { memo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: "light" | "ivory" | "navy";
};

export const Section = memo(({ children, className, id, tone = "light" }: SectionProps) => (
  <section
    id={id}
    className={cn(
      "py-20 md:py-28",
      tone === "ivory" && "bg-secondary/60",
      tone === "navy" && "navy-canvas relative overflow-hidden text-ivory",
      className,
    )}
  >
    {tone === "navy" ? <div className="grid-veil absolute inset-0" aria-hidden /> : null}
    <div className="container relative">{children}</div>
  </section>
));

Section.displayName = "Section";

type HeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
  onDark?: boolean;
  className?: string;
};

export const SectionHeading = memo(({ eyebrow, title, intro, align = "left", onDark = false, className }: HeadingProps) => (
  <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
    {eyebrow ? <p className="eyebrow text-gold">{eyebrow}</p> : null}
    <h2
      className={cn(
        "display mt-4 text-3xl leading-[1.15] md:text-[2.6rem]",
        onDark ? "text-ivory" : "text-navy",
      )}
    >
      {title}
    </h2>
    <div className={cn("mt-5 h-px w-24 rule-gold", align === "center" && "mx-auto")} />
    {intro ? (
      <p className={cn("mt-6 text-[1.02rem] leading-relaxed", onDark ? "text-ivory/70" : "text-muted-foreground")}>{intro}</p>
    ) : null}
  </div>
));

SectionHeading.displayName = "SectionHeading";
