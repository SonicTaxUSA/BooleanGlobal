import Link from "next/link";
import { LayoutDashboard, Users, Inbox, FileSignature } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-(--color-border) p-4">
        <Link href="/dashboard" className="mb-6 block no-underline">
          <Logo size="sm" />
        </Link>
        <NavLink href="/dashboard" icon={<LayoutDashboard size={16} />}>
          Dashboard
        </NavLink>
        <NavLink href="/dashboard/leads" icon={<Inbox size={16} />}>
          Leads
        </NavLink>
        <NavLink href="/dashboard/clients" icon={<Users size={16} />}>
          Clients
        </NavLink>
        {user.role === "admin" && (
          <NavLink href="/dashboard/templates" icon={<FileSignature size={16} />}>
            Templates
          </NavLink>
        )}
        <div className="mt-auto flex flex-col gap-3 pt-4">
          <div>
            <p className="m-0 truncate text-sm text-(--color-muted)">{user.full_name ?? user.email}</p>
            <p className="m-0 text-xs uppercase tracking-wide text-(--color-gold-dim)">{user.role}</p>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
