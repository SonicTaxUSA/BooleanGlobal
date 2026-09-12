import Link from "next/link";
import { LayoutDashboard, ClipboardList, Signature } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { LogoutButton } from "@/components/LogoutButton";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-(--color-border) p-4">
        <Link href="/portal" className="mb-6 block no-underline">
          <Logo size="sm" />
        </Link>
        <NavLink href="/portal" icon={<LayoutDashboard size={16} />}>
          Dashboard
        </NavLink>
        <NavLink href="/portal/intake" icon={<ClipboardList size={16} />}>
          Intake
        </NavLink>
        <NavLink href="/portal/signatures" icon={<Signature size={16} />}>
          Agreement
        </NavLink>
        <div className="mt-auto flex flex-col gap-3 pt-4">
          <p className="m-0 truncate text-sm text-(--color-muted)">{user.full_name ?? user.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
