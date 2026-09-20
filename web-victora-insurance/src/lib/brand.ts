/** Central Victora Insurance brand + content source of truth. Edit here to update the whole site. */

export const BRAND = {
  name: "Victora Insurance",
  tagline: "Protect What Matters. Secure What's Next.",
  phone: "(305) 425-1251",
  phoneHref: "tel:+13054251251",
  email: "hello@victorainsurance.com",
  hours: "Mon–Fri 9:00am – 6:00pm · Saturday by appointment",
  logo: "/victora-logo.png",
} as const;

export const MISSION =
  "To help individuals, families, and businesses protect what they've worked hard to build through honest advice, affordable coverage, and exceptional service.";

export const VISION =
  "To become one of the most trusted independent insurance agencies in the United States by making insurance simple, transparent, and personal.";

export type CoreValue = { title: string; body: string };

export const CORE_VALUES: CoreValue[] = [
  { title: "Integrity", body: "We recommend what is right for you, even when it earns us less." },
  { title: "Protection", body: "Coverage built around the people and things you cannot replace." },
  { title: "Education", body: "You will understand your plan before you ever sign it." },
  { title: "Transparency", body: "Clear pricing, clear networks, no hidden surprises." },
  { title: "Fast Service", body: "Questions answered the same day, claims never handled alone." },
  { title: "Long-Term Relationships", body: "We stay your agent long after enrollment closes." },
];

export type Campaign = { headline: string[]; sub: string };

export const CAMPAIGNS: Campaign[] = [
  {
    headline: ["Your Health.", "Your Family.", "Your Future.", "Protected."],
    sub: "Health insurance doesn't have to be confusing. We'll help you compare plans, understand your options, and choose coverage that fits your needs and your budget.",
  },
  {
    headline: ["You Deserve Coverage", "You Understand."],
    sub: "No confusing terms. No pressure. No hidden surprises. Just honest advice and personalized health insurance options.",
  },
  {
    headline: ["Unexpected Happens."],
    sub: "Being prepared shouldn't be expensive. Protect yourself before you need it.",
  },
  {
    headline: ["The Best Insurance", "Is The One You Never", "Have To Think About."],
    sub: "Because when life happens… you're already protected.",
  },
];

export type Service = {
  slug: string;
  name: string;
  blurb: string;
  bullets: string[];
};

export const HEALTH_SERVICES: Service[] = [
  {
    slug: "marketplace",
    name: "Marketplace (ACA)",
    blurb: "Subsidy-eligible plans through the federal Marketplace, checked against your income and household.",
    bullets: ["Premium tax credit review", "Bronze / Silver / Gold comparison", "Cost-sharing reduction plans", "Special Enrollment qualification"],
  },
  {
    slug: "individual",
    name: "Individual Plans",
    blurb: "Coverage for one person built around your doctors, prescriptions, and monthly budget.",
    bullets: ["Doctor network check", "Prescription formulary review", "Deductible vs. premium trade-offs", "Preventive care included"],
  },
  {
    slug: "family",
    name: "Family Plans",
    blurb: "One plan that covers children, pregnancy, pediatric dental, and the specialists you already trust.",
    bullets: ["Pediatric & maternity coverage", "Family deductible planning", "Keep your current pediatrician", "Dependent coverage to age 26"],
  },
  {
    slug: "self-employed",
    name: "Self-Employed Coverage",
    blurb: "For contractors, realtors, rideshare drivers, and business owners with variable income.",
    bullets: ["1099 income estimation", "Deductible health premiums", "Year-round income reporting", "Solo & spouse strategies"],
  },
  {
    slug: "medicare-advantage",
    name: "Medicare Advantage",
    blurb: "Part C plans with bundled extras — reviewed side by side, never steered.",
    bullets: ["Dental, vision & hearing extras", "Plan network verification", "Annual Notice of Change review", "Part B giveback options"],
  },
  {
    slug: "medicare-supplement",
    name: "Medicare Supplements",
    blurb: "Medigap plans that fill the gaps Original Medicare leaves behind.",
    bullets: ["Plan G & N comparison", "Any-doctor freedom", "Rate-increase history review", "Underwriting guidance"],
  },
  {
    slug: "prescription",
    name: "Prescription Coverage",
    blurb: "Part D and formulary reviews so your medications stay affordable all year.",
    bullets: ["Drug-by-drug pricing", "Tier & prior-auth checks", "Pharmacy network match", "Coverage gap planning"],
  },
  {
    slug: "dental-vision",
    name: "Dental & Vision",
    blurb: "Standalone dental and vision plans that pair with any medical coverage.",
    bullets: ["Cleanings & major services", "Orthodontic riders", "Frames & lens allowances", "No-waiting-period options"],
  },
];

export const FUTURE_SERVICES: string[] = [
  "Auto Insurance",
  "Homeowners",
  "Renters",
  "Commercial",
  "General Liability",
  "Workers Comp",
  "Life Insurance",
  "Disability",
  "Umbrella Policies",
  "Business Owners Policies (BOP)",
];

export type Audience = { title: string; detail: string; points: string[] };

export const AUDIENCES: Audience[] = [
  { title: "Young Adults 18–26", detail: "First plan of your own.", points: ["Leaving a parent's plan", "Affordable Marketplace options", "Low-premium starter coverage"] },
  { title: "Families", detail: "Everyone under one plan.", points: ["Children & pediatric care", "Pregnancy & maternity", "Keep your doctors", "Prescription coverage"] },
  { title: "Self-Employed", detail: "Income that moves month to month.", points: ["Contractors & trades", "Realtors", "Rideshare drivers", "Small business owners"] },
  { title: "Early Retirees", detail: "The bridge before Medicare.", points: ["Retired before 65", "COBRA alternatives", "Subsidy planning"] },
  { title: "Medicare Turning 65", detail: "Your first Medicare decision.", points: ["Advantage vs. Supplement", "Part D drug review", "Enrollment deadlines"] },
  { title: "Small Businesses", detail: "Benefits that keep good people.", points: ["Group health options", "Employee benefit education", "ICHRA strategies"] },
];

export type ContentDay = { day: string; theme: string; example: string; body: string };

export const CONTENT_CALENDAR: ContentDay[] = [
  {
    day: "Monday",
    theme: "Insurance Myth Monday",
    example: "\"I'm healthy, I don't need insurance.\"",
    body: "Explain why preventive care and unexpected medical events matter — one ER visit costs more than a year of premiums.",
  },
  { day: "Tuesday", theme: "Money Saving Tips", example: "\"Are you leaving a subsidy on the table?\"", body: "Practical ways to lower premiums: income reporting, plan tier math, HSA-eligible plans." },
  { day: "Wednesday", theme: "Client Education", example: "\"What is a deductible?\"", body: "One term per week — deductible, copay, coinsurance, out-of-pocket max — explained in plain English." },
  { day: "Thursday", theme: "Coverage Comparison", example: "\"Bronze vs. Silver\"", body: "Side-by-side breakdowns: HMO vs. PPO, Marketplace vs. private, Advantage vs. Supplement." },
  { day: "Friday", theme: "Success Story", example: "\"We lowered a family's premium and kept their doctors.\"", body: "Real, anonymized wins that show what working with an independent agent actually changes." },
];

export type SopGroup = { group: string; items: string[] };

export const SOPS: SopGroup[] = [
  {
    group: "Operations",
    items: [
      "New Lead Intake",
      "Quote Request Process",
      "Marketplace Enrollment",
      "Open Enrollment Procedures",
      "Special Enrollment Verification",
      "Client Follow-Up",
      "Renewal Process",
      "Policy Changes",
      "Claims Assistance",
      "Cancellation Requests",
      "Compliance & Privacy (HIPAA)",
      "Complaint Resolution",
      "Customer Service Standards",
    ],
  },
  {
    group: "Sales",
    items: [
      "First Call Script",
      "Needs Assessment",
      "Plan Comparison",
      "Objection Handling",
      "Quote Presentation",
      "Follow-Up Schedule",
      "Closing Process",
      "Referral Request Process",
    ],
  },
  {
    group: "Marketing",
    items: [
      "Social Media Posting",
      "Review Requests",
      "Referral Campaigns",
      "Community Events",
      "Email Marketing",
      "Educational Content Standards",
    ],
  },
  {
    group: "Administration",
    items: [
      "Document Collection",
      "Secure File Storage",
      "CRM Management",
      "Appointment Scheduling",
      "Commission Tracking",
      "Carrier Appointment Management",
      "Licensing & Continuing Education Tracking",
    ],
  },
];

export type Glossary = { term: string; plain: string };

export const GLOSSARY: Glossary[] = [
  { term: "Premium", plain: "The set amount you pay every month to keep the plan active — like a subscription." },
  { term: "Deductible", plain: "What you pay yourself before the plan starts sharing most costs. Preventive care is still free before it." },
  { term: "Copay", plain: "A flat fee for a visit — $30 to see your doctor, for example." },
  { term: "Coinsurance", plain: "After the deductible, you and the plan split the bill by percentage, like 20% you / 80% plan." },
  { term: "Out-of-Pocket Max", plain: "The most you can possibly pay in a year. After that, covered care is 100% paid." },
  { term: "Network", plain: "The doctors and hospitals your plan has a discount contract with. In-network costs far less." },
  { term: "HMO vs. PPO", plain: "HMO keeps you in a tighter network with referrals and lower cost. PPO gives more freedom for a higher premium." },
  { term: "Subsidy (Premium Tax Credit)", plain: "Government help that lowers your monthly premium based on your household income." },
  { term: "Special Enrollment Period", plain: "A 60-day window to enroll outside Open Enrollment after a life event like moving, marriage, or losing coverage." },
];

export const FAQS: Glossary[] = [
  { term: "Does it cost anything to work with Victora?", plain: "No. Our services are free to you. We're paid by the carrier you choose, and that never changes your premium." },
  { term: "Can I keep my current doctor?", plain: "Usually yes — we check every plan against your doctor list and prescriptions before we recommend it." },
  { term: "What if I miss Open Enrollment?", plain: "A qualifying life event opens a 60-day Special Enrollment Period. Medicaid and CHIP are also year-round. We'll verify your options." },
  { term: "Are you an independent agency?", plain: "Yes. We're not captive to one carrier, so we compare across many and recommend what fits you." },
  { term: "Is my information private?", plain: "Yes. We follow HIPAA privacy standards and only use your information to prepare your quote and enrollment." },
];
