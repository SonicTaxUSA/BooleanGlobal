export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// CROA gives the client until midnight of the THIRD BUSINESS DAY after
// signing to cancel without penalty. Business day = Mon-Fri here; this does
// not account for federal holidays, so treat it as a conservative estimate
// and confirm the exact date with counsel for any real client-facing use.
export function cancellationDeadline(signedAt: string | Date): Date {
  const date = typeof signedAt === "string" ? new Date(signedAt) : new Date(signedAt.getTime());
  let businessDaysAdded = 0;
  while (businessDaysAdded < 3) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      businessDaysAdded += 1;
    }
  }
  date.setHours(23, 59, 59, 999);
  return date;
}
