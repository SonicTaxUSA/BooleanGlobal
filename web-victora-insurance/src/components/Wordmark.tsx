import { memo } from "react";
import { Link } from "react-router-dom";

import Crest from "@/components/Crest";
import { cn } from "@/lib/utils";

type WordmarkProps = {
  onDark?: boolean;
  className?: string;
  showTagline?: boolean;
};

/** Lockup of crest + Victora Insurance wordmark, used in the header and footer. */
const Wordmark = memo(({ onDark = false, className, showTagline = false }: WordmarkProps) => (
  <Link to="/" className={cn("group flex items-center gap-3", className)} aria-label="Victora Insurance home">
    <Crest onDark={onDark} className="h-10 transition-transform duration-500 group-hover:scale-[1.06]" />
    <span className="flex flex-col leading-none">
      <span
        className={cn(
          "display text-[1.32rem] uppercase tracking-[0.14em]",
          onDark ? "text-ivory" : "text-navy",
        )}
      >
        Victora
      </span>
      <span className="eyebrow mt-1 text-gold">Insurance</span>
      {showTagline ? (
        <span className={cn("mt-2 text-[0.65rem] uppercase tracking-[0.18em]", onDark ? "text-ivory/60" : "text-muted-foreground")}>
          Protect what matters
        </span>
      ) : null}
    </span>
  </Link>
));

Wordmark.displayName = "Wordmark";

export default Wordmark;
