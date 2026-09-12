import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-(--color-border) px-6 py-10 text-center text-sm text-(--color-muted)">
      {Icon && <Icon size={24} className="text-(--color-gold-dim)" />}
      {children}
    </div>
  );
}
