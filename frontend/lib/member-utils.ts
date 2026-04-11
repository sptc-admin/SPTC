export const PH_MOBILE_PREFIX = "+63 "

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

/** Normalize to 10-digit PH mobile (strip leading 63 or 0). */
export function normalizePhMobile10(value: string): string {
  let d = digitsOnly(value)
  if (d.startsWith("63")) d = d.slice(2)
  if (d.startsWith("0")) d = d.slice(1)
  return d.slice(0, 10)
}

export function formatPhLocalSpaced(digits10: string): string {
  const d = normalizePhMobile10(digits10).slice(0, 10)
  const p1 = d.slice(0, 3)
  const p2 = d.slice(3, 6)
  const p3 = d.slice(6, 10)
  return [p1, p2, p3].filter((x) => x.length > 0).join(" ")
}

export function formatPhMobileDisplay(value: string): string {
  return PH_MOBILE_PREFIX + formatPhLocalSpaced(value)
}

export function isValidPhMobile10(digits10: string): boolean {
  return /^9\d{9}$/.test(digits10)
}

export function computeAgeFromBirthDate(isoDate: string): number | null {
  if (!isoDate) return null
  const birth = new Date(isoDate + "T12:00:00")
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age >= 0 ? age : null
}

export function normalizeTinDigits(value: string): string {
  return digitsOnly(value).slice(0, 12)
}

export function formatTinDisplay(digits: string): string {
  const d = normalizeTinDigits(digits)
  const chunks = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 12)]
  return chunks.filter(Boolean).join("-")
}

export function isValidTin12(digits: string): boolean {
  return /^\d{12}$/.test(normalizeTinDigits(digits))
}
