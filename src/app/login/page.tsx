import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <Link href="/" className="mb-10 no-underline">
        <Logo size="lg" />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-(--color-border) bg-(--color-surface) p-8">
        <h1 className="mt-0 text-xl font-semibold">Log in</h1>
        <LoginForm redirectTo={redirect ?? "/portal"} />
        <p className="mt-6 text-center text-sm text-(--color-muted)">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-(--color-gold)">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
