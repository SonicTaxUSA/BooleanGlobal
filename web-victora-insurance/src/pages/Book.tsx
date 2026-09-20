import { BadgeCheck, CalendarCheck, Clock, Loader2, MapPin, Phone, Video } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import Layout from "@/components/layout/Layout";
import { Section, SectionHeading } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BRAND } from "@/lib/brand";
import { api } from "@/lib/api";
import { loadAppointments, newId, saveAppointments, type Appointment } from "@/lib/crm";
import { cn } from "@/lib/utils";

const TOPICS: string[] = [
  "Coverage consultation",
  "Dental & Vision consultation",
  "Enrollment assistance",
  "Policy / coverage review",
  "Renewal review",
  "Other",
];

const TIMES: string[] = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];

const CHANNELS: { value: Appointment["channel"]; label: string; icon: typeof Phone }[] = [
  { value: "phone", label: "Phone call", icon: Phone },
  { value: "video", label: "Video meeting", icon: Video },
  { value: "office", label: "In our office", icon: MapPin },
];

/** Next 14 weekdays offered as bookable consultation days. */
function upcomingWeekdays(count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);
  while (days.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export default function Book() {
  const days = useMemo<Date[]>(() => upcomingWeekdays(12), []);
  const [date, setDate] = useState<string>(days[0]?.toISOString().slice(0, 10) ?? "");
  const [time, setTime] = useState<string>("10:00 AM");
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [channel, setChannel] = useState<Appointment["channel"]>("phone");
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [heard, setHeard] = useState<string>("Website");
  const [consent, setConsent] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [booked, setBooked] = useState<Appointment | null>(null);

  const valid = useMemo<boolean>(
    () => name.trim().length > 1 && /.+@.+\..+/.test(email) && phone.replace(/\D/g, "").length >= 10 && date.length > 0 && consent,
    [name, email, phone, date, consent],
  );

  const submit = useCallback(async () => {
    if (!valid) {
      toast.error("Please add your name, email, phone, and a day that works.");
      return;
    }
    setSubmitting(true);
    try {
      const appt: Appointment = {
        id: newId(),
        createdAt: new Date().toISOString(),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        date,
        time,
        topic,
        channel,
        notes: notes.trim(),
      };
      saveAppointments([appt, ...loadAppointments()]);
      try {
        await api.bookAppointment({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          date,
          time,
          topic,
          channel,
          notes: notes.trim(),
          source: heard,
        });
      } catch (apiError) {
        console.warn("Server appointment sync failed; kept local copy", apiError);
      }
      setBooked(appt);
      toast.success("Consultation requested — we'll confirm by email shortly.");
    } catch (error) {
      console.error("Appointment booking failed", error);
      toast.error("We couldn't save that request. Please call us and we'll book you directly.");
    } finally {
      setSubmitting(false);
    }
  }, [valid, name, email, phone, date, time, topic, channel, notes, heard, consent]);

  if (booked) {
    const pretty = new Date(`${booked.date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    return (
      <Layout>
        <Section tone="navy">
          <div className="mx-auto max-w-2xl text-center">
            <BadgeCheck className="mx-auto h-10 w-10 text-gold" />
            <h1 className="display mt-6 text-3xl leading-tight text-ivory md:text-[2.5rem]">You're on the calendar.</h1>
            <p className="mt-5 text-[1.02rem] leading-relaxed text-ivory/70">
              {booked.name}, we've reserved <strong className="text-gold-light">{pretty} at {booked.time}</strong> for your{" "}
              {booked.channel === "office" ? "in-office visit" : booked.channel === "video" ? "video meeting" : "phone consultation"}. A
              confirmation is on the way to {booked.email}.
            </p>
            <div className="mt-9 rounded-md border border-ivory/15 bg-ivory/5 p-6 text-left">
              <p className="eyebrow text-gold">Come prepared (optional)</p>
              <ul className="mt-4 space-y-2 text-sm text-ivory/70">
                <li>· A rough estimate of household income for the year</li>
                <li>· The doctors you'd like to keep</li>
                <li>· Any prescriptions you take regularly</li>
                <li>· Your current plan card, if you have one</li>
              </ul>
            </div>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="bg-gold text-navy-deep hover:bg-gold-light">
                <Link to="/quote">Fill out your quote first</Link>
              </Button>
              <Button asChild variant="outline" className="border-ivory/25 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory">
                <a href={BRAND.phoneHref}>Call {BRAND.phone}</a>
              </Button>
            </div>
          </div>
        </Section>
      </Layout>
    );
  }

  return (
    <Layout>
      <Section tone="navy" className="py-14 md:py-20">
        <p className="eyebrow text-gold">Free Consultation</p>
        <h1 className="display mt-4 max-w-2xl text-3xl leading-[1.15] text-ivory md:text-[2.7rem]">
          Book time with a licensed agent.
        </h1>
        <p className="mt-5 max-w-xl text-[1.02rem] leading-relaxed text-ivory/70">
          Twenty to thirty minutes, zero pressure. We answer your questions, explain your options, and only recommend a plan if it genuinely
          fits.
        </p>
      </Section>

      <div className="container py-12 md:py-16">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.35fr_1fr]">
          <div className="rounded-lg border border-border bg-card p-6 shadow-crest md:p-9">
            <h2 className="display text-2xl text-navy">Pick a day</h2>
            <div className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {days.map((d) => {
                const iso = d.toISOString().slice(0, 10);
                const active = date === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setDate(iso)}
                    className={cn(
                      "rounded-md border px-2 py-3 text-center transition-all duration-200 active:scale-[0.97]",
                      active ? "border-gold bg-gold/15" : "border-border bg-background hover:border-navy/30",
                    )}
                  >
                    <span className="block text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span className={cn("display mt-1 block text-lg", active ? "text-navy" : "text-navy/80")}>{d.getDate()}</span>
                    <span className="block text-[0.65rem] text-muted-foreground">
                      {d.toLocaleDateString("en-US", { month: "short" })}
                    </span>
                  </button>
                );
              })}
            </div>

            <h2 className="display mt-9 text-2xl text-navy">Pick a time</h2>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition-all active:scale-[0.97]",
                    time === t ? "border-gold bg-gold/15 text-navy" : "border-border text-muted-foreground hover:border-navy/30 hover:text-navy",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <h2 className="display mt-9 text-2xl text-navy">How should we meet?</h2>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              {CHANNELS.map((c) => {
                const Icon = c.icon;
                const active = channel === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setChannel(c.value)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md border px-4 py-3 text-sm transition-all active:scale-[0.98]",
                      active ? "border-gold bg-gold/10 text-navy" : "border-border text-muted-foreground hover:border-navy/30 hover:text-navy",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active ? "text-gold" : "text-navy/40")} />
                    {c.label}
                  </button>
                );
              })}
            </div>

            <h2 className="display mt-9 text-2xl text-navy">What's this about?</h2>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition-all active:scale-[0.97]",
                    topic === t ? "border-gold bg-gold/15 text-navy" : "border-border text-muted-foreground hover:border-navy/30 hover:text-navy",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/50 p-6 md:p-8">
            <h2 className="display text-2xl text-navy">Your details</h2>
            <div className="mt-6 space-y-5">
              <div>
                <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Full name</Label>
                <Input className="mt-2 bg-background" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Email</Label>
                <Input className="mt-2 bg-background" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Phone</Label>
                <Input className="mt-2 bg-background" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Anything to add?</Label>
                <Textarea className="mt-2 bg-background" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">How did you hear about us?</Label>
                <select
                  className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-navy"
                  value={heard}
                  onChange={(e) => setHeard(e.target.value)}
                >
                  {["Instagram", "Facebook", "Google", "Website", "Referral", "Sonic Tax USA", "Partner", "Walk-in", "Agent", "Other"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                <Checkbox className="mt-0.5" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
                <span>I agree to be contacted by Victora Insurance to confirm and prepare for this consultation.</span>
              </label>
            </div>

            <Button onClick={submit} disabled={submitting} className="mt-7 w-full bg-navy text-ivory hover:bg-navy-soft">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-2 h-4 w-4 text-gold" />}
              Request this time
            </Button>

            <div className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
              <span>Requests are confirmed by a real person, not an automated calendar. {BRAND.hours}</span>
            </div>
          </div>
        </div>
      </div>

      <Section tone="ivory">
        <SectionHeading
          align="center"
          eyebrow="No pressure, ever"
          title="What a Victora consultation actually looks like"
          intro="We educate people instead of selling them. Here's the honest agenda."
        />
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {[
            { t: "Questions first", d: "We ask about your doctors, prescriptions, and budget before we ever mention a plan name." },
            { t: "Options side by side", d: "You see the real trade-offs between premium, deductible, and network — in plain English." },
            { t: "Your decision", d: "You choose. If nothing fits today, that's a completely acceptable outcome." },
          ].map((s, i) => (
            <div key={s.t} className="animate-rise" style={{ animationDelay: `${i * 90}ms` }}>
              <p className="display text-2xl text-gold">0{i + 1}</p>
              <h3 className="display mt-3 text-xl text-navy">{s.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </Section>
    </Layout>
  );
}
