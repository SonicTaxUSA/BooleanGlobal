// Placeholder mark until the real Boolean Global logo asset is supplied —
// approximates the gold geometric "B" on black described for the brand.
// Swap the <svg> below for an <img> of the real file once it's provided.
export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = { sm: 28, md: 36, lg: 56 }[size];
  const textSize = { sm: "text-sm", md: "text-lg", lg: "text-2xl" }[size];

  return (
    <span className="inline-flex items-center gap-2">
      <svg width={dims} height={dims} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="10" fill="#0a0a0a" />
        <path
          d="M14 10h14a7 7 0 0 1 0 14h-6a8 8 0 0 1 0 16H14a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2Zm4 4v10h9a5 5 0 0 0 0-10h-9Zm0 14v10h6a5 5 0 0 0 0-10h-6Z"
          fill="url(#bg-gold)"
        />
        <defs>
          <linearGradient id="bg-gold" x1="12" y1="10" x2="36" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e0be6e" />
            <stop offset="1" stopColor="#8a6f30" />
          </linearGradient>
        </defs>
      </svg>
      <span className={`${textSize} font-semibold tracking-tight`}>
        Boolean <span className="gold-text">Global</span>
      </span>
    </span>
  );
}
