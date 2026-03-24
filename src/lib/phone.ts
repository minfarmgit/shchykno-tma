export function normalizePhoneNumber(rawValue: string | null | undefined) {
  if (!rawValue) {
    return null;
  }

  const digitsOnly = rawValue.trim().replace(/[^\d]/g, "");
  return digitsOnly || null;
}

export function maskPhoneNumber(phoneNumber: string) {
  if (phoneNumber.length <= 4) {
    return phoneNumber;
  }

  return `${"*".repeat(Math.max(phoneNumber.length - 4, 0))}${phoneNumber.slice(-4)}`;
}
