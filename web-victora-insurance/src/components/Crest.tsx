import { memo } from "react";

import { cn } from "@/lib/utils";

type CrestProps = {
  className?: string;
  /** Renders the gold/navy crest suited for dark backgrounds. */
  onDark?: boolean;
};

/** Victora shield + column crest, drawn as vector so it stays crisp at any size. */
const Crest = memo(({ className, onDark = false }: CrestProps) => {
  const column = onDark ? "hsl(44 41% 95%)" : "hsl(220 57% 13%)";

  return (
    <svg viewBox="0 0 64 76" className={cn("h-9 w-auto", className)} role="img" aria-label="Victora Insurance crest">
      <defs>
        <linearGradient id="crest-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(43 74% 76%)" />
          <stop offset="45%" stopColor="hsl(41 54% 52%)" />
          <stop offset="100%" stopColor="hsl(43 70% 70%)" />
        </linearGradient>
      </defs>
      <path
        d="M32 2.5 6.5 11v27.5C6.5 55.5 18 67 32 73.5 46 67 57.5 55.5 57.5 38.5V11L32 2.5Z"
        fill="none"
        stroke="url(#crest-gold)"
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      <path d="M20 22h24v3.2H20z" fill={column} />
      <path d="M23.4 25.2h3.1v22h-3.1zM30.4 25.2h3.2v22h-3.2zM37.4 25.2h3.2v22h-3.2z" fill={column} />
      <path d="M18 47.2h28v3.4H18z" fill={column} />
      <path d="M15.6 50.6h32.8v3.8H15.6z" fill={column} />
    </svg>
  );
});

Crest.displayName = "Crest";

export default Crest;
