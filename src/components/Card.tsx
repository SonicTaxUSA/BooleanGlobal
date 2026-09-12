export function Card({
  title,
  icon,
  children,
  className = "",
}: {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 transition-colors hover:border-(--color-border-strong) ${className}`}
    >
      {title && (
        <h2 className="mt-0 mb-4 flex items-center gap-2 text-base font-semibold">
          {icon && (
            <span className="inline-flex items-center justify-center rounded-full bg-(--color-surface-raised) p-2 text-(--color-gold)">
              {icon}
            </span>
          )}
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
