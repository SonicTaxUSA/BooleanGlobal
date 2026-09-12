"use client";

import { signOut } from "@/lib/actions/auth";

export function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-full border border-(--color-border) bg-transparent px-4 py-2 text-sm text-(--color-muted) transition-colors hover:border-(--color-border-strong) hover:text-(--color-ink)"
      >
        Log out
      </button>
    </form>
  );
}
