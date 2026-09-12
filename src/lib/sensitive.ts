export function maskSensitive(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const digits = value.replace(/\D/g, "");
  const last4 = digits.length >= 4 ? digits.slice(-4) : value.slice(-4);
  return `••••${last4}`;
}
