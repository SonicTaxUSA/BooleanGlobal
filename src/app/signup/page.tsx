import Link from "next/link";
import { SignupForm } from "@/components/SignupForm";
import { Logo } from "@/components/Logo";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <Link href="/" className="mb-10 no-underline">
        <Logo size="lg" />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-(--color-border) bg-(--color-surface) p-8">
        <h1 className="mt-0 text-xl font-semibold">Create your account</h1>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-(--color-muted)">
          Already have an account?{" "}
          <Link href="/login" className="text-(--color-gold)">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
