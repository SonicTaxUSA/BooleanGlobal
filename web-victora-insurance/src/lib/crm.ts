/** Victora CRM domain types + local persistence layer for leads, quotes, and appointments. */

export type CoverageType =
  | "marketplace"
  | "individual"
  | "family"
  | "self-employed"
  | "medicare-advantage"
  | "medicare-supplement"
  | "dental-vision";

export type LeadStage = "new" | "contacted" | "quoted" | "enrolled" | "renewal" | "lost";

export type LeadSource = "website-quote" | "appointment" | "referral" | "social" | "phone" | "event";

export type Applicant = {
  firstName: string;
  lastName: string;
  dob: string;
  tobacco: boolean;
};

export type QuoteRequest = {
  coverageType: CoverageType;
  zip: string;
  state: string;
  householdSize: number;
  annualIncome: number;
  applicants: Applicant[];
  currentlyInsured: boolean;
  priorities: string[];
  doctors: string;
  prescriptions: string;
  notes: string;
};

export type Lead = {
  id: string;
  createdAt: string;
  updatedAt: string;
  stage: LeadStage;
  source: LeadSource;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredContact: "phone" | "email" | "text";
  quote: QuoteRequest;
  estimate: QuoteEstimate | null;
  activity: ActivityEntry[];
};

export type ActivityEntry = {
  id: string;
  at: string;
  label: string;
};

export type Appointment = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  topic: string;
  channel: "phone" | "video" | "office";
  notes: string;
};

export type PlanTier = {
  tier: "Bronze" | "Silver" | "Gold";
  netPremium: number;
  deductible: number;
  oopMax: number;
  copay: number;
  bestFor: string;
};

export type QuoteEstimate = {
  fplPercent: number;
  subsidyEligible: boolean;
  estimatedSubsidy: number;
  benchmarkPremium: number;
  tiers: PlanTier[];
};

const LEADS_KEY = "victora.leads.v1";
const APPTS_KEY = "victora.appointments.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadLeads(): Lead[] {
  if (typeof window === "undefined") return [];
  return safeParse<Lead[]>(window.localStorage.getItem(LEADS_KEY), []);
}

export function saveLeads(leads: Lead[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

export function loadAppointments(): Appointment[] {
  if (typeof window === "undefined") return [];
  return safeParse<Appointment[]>(window.localStorage.getItem(APPTS_KEY), []);
}

export function saveAppointments(items: Appointment[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPTS_KEY, JSON.stringify(items));
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** 2025 federal poverty level figures used for illustrative subsidy math only. */
const FPL_BASE = 15650;
const FPL_PER_PERSON = 5500;

function ageFromDob(dob: string): number {
  const then = new Date(dob);
  if (Number.isNaN(then.getTime())) return 35;
  const diff = Date.now() - then.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

/** Age-rating curve roughly following the federal default 3:1 band. */
function ageFactor(age: number): number {
  if (age < 21) return 0.765;
  if (age > 64) return 3.0;
  return 1 + (age - 21) * 0.0465;
}

function expectedContributionRate(fplPercent: number): number {
  if (fplPercent <= 150) return 0;
  if (fplPercent <= 200) return 0.02 + ((fplPercent - 150) / 50) * 0.02;
  if (fplPercent <= 250) return 0.04 + ((fplPercent - 200) / 50) * 0.02;
  if (fplPercent <= 300) return 0.06 + ((fplPercent - 250) / 50) * 0.015;
  if (fplPercent <= 400) return 0.085;
  return 0.085;
}

/**
 * Produces an illustrative, non-binding premium estimate so clients see a number
 * immediately. Final pricing always comes from the carrier / Marketplace.
 */
export function estimateQuote(q: QuoteRequest): QuoteEstimate {
  const household = Math.max(1, q.householdSize);
  const fpl = FPL_BASE + (household - 1) * FPL_PER_PERSON;
  const fplPercent = Math.round((Math.max(0, q.annualIncome) / fpl) * 100);

  const people = q.applicants.length > 0 ? q.applicants : [{ firstName: "", lastName: "", dob: "1985-01-01", tobacco: false }];
  const baseRate = 420;
  const gross = people.reduce((sum, p) => {
    const age = ageFromDob(p.dob);
    const tobaccoLoad = p.tobacco ? 1.2 : 1;
    return sum + baseRate * ageFactor(age) * tobaccoLoad;
  }, 0);

  const medicare = q.coverageType === "medicare-advantage" || q.coverageType === "medicare-supplement";
  const dentalOnly = q.coverageType === "dental-vision";

  if (dentalOnly) {
    return {
      fplPercent,
      subsidyEligible: false,
      estimatedSubsidy: 0,
      benchmarkPremium: 0,
      tiers: [
        { tier: "Bronze", netPremium: 24, deductible: 100, oopMax: 1000, copay: 0, bestFor: "Cleanings and exams only" },
        { tier: "Silver", netPremium: 41, deductible: 75, oopMax: 1500, copay: 15, bestFor: "Fillings, crowns, plus vision" },
        { tier: "Gold", netPremium: 68, deductible: 50, oopMax: 2500, copay: 10, bestFor: "Major work and orthodontics" },
      ],
    };
  }

  if (medicare) {
    const advantage = q.coverageType === "medicare-advantage";
    return {
      fplPercent,
      subsidyEligible: false,
      estimatedSubsidy: 0,
      benchmarkPremium: 0,
      tiers: advantage
        ? [
            { tier: "Bronze", netPremium: 0, deductible: 0, oopMax: 5900, copay: 0, bestFor: "$0 premium HMO with extras" },
            { tier: "Silver", netPremium: 29, deductible: 0, oopMax: 4800, copay: 10, bestFor: "Broader PPO network" },
            { tier: "Gold", netPremium: 74, deductible: 0, oopMax: 3400, copay: 5, bestFor: "Rich dental and hearing extras" },
          ]
        : [
            { tier: "Bronze", netPremium: 118, deductible: 257, oopMax: 257, copay: 0, bestFor: "Plan N — small visit copays" },
            { tier: "Silver", netPremium: 152, deductible: 257, oopMax: 257, copay: 0, bestFor: "Plan G — most popular" },
            { tier: "Gold", netPremium: 198, deductible: 0, oopMax: 0, copay: 0, bestFor: "Plan F — legacy, first-dollar" },
          ],
    };
  }

  const benchmark = gross * 0.94;
  const affordable = (Math.max(0, q.annualIncome) * expectedContributionRate(fplPercent)) / 12;
  const rawSubsidy = fplPercent >= 100 ? Math.max(0, benchmark - affordable) : 0;
  const subsidy = Math.round(rawSubsidy);
  const subsidyEligible = subsidy > 0 && fplPercent >= 100;

  const net = (multiplier: number): number => Math.max(0, Math.round(gross * multiplier - subsidy));

  return {
    fplPercent,
    subsidyEligible,
    estimatedSubsidy: subsidy,
    benchmarkPremium: Math.round(benchmark),
    tiers: [
      { tier: "Bronze", netPremium: net(0.78), deductible: 7500, oopMax: 9200, copay: 0, bestFor: "Lowest premium, protection from worst case" },
      { tier: "Silver", netPremium: net(1.0), deductible: 3200, oopMax: 6800, copay: 35, bestFor: "Balanced — required for extra savings" },
      { tier: "Gold", netPremium: net(1.24), deductible: 1200, oopMax: 4500, copay: 20, bestFor: "Frequent care, specialists, prescriptions" },
    ],
  };
}

export const STAGE_LABEL: Record<LeadStage, string> = {
  new: "New Lead",
  contacted: "Contacted",
  quoted: "Quoted",
  enrolled: "Enrolled",
  renewal: "Renewal",
  lost: "Lost",
};

export const STAGE_ORDER: LeadStage[] = ["new", "contacted", "quoted", "enrolled", "renewal", "lost"];

export const COVERAGE_LABEL: Record<CoverageType, string> = {
  marketplace: "Marketplace (ACA)",
  individual: "Individual Plan",
  family: "Family Plan",
  "self-employed": "Self-Employed",
  "medicare-advantage": "Medicare Advantage",
  "medicare-supplement": "Medicare Supplement",
  "dental-vision": "Dental & Vision",
};

export function currency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
