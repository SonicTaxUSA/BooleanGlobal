import { ContactForm } from "@/components/ContactForm";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-(--color-gold)">
        Get Started
      </p>
      <h1 className="text-4xl font-semibold">Free Consultation</h1>
      <p className="mt-4 text-(--color-muted)">
        Tell us a bit about your situation and we&apos;ll reach out to schedule a free, no-obligation
        consultation.
      </p>
      <div className="mt-10">
        <ContactForm />
      </div>
    </div>
  );
}
