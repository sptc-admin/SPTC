export const PH_MOBILE_PREFIX = "+63 "

const BODY_NUMBER_MAX_LEN = 120

export function normalizeBodyNumber(value: string): string {
  return value.replace(/,/g, "").replace(/\s+/g, " ").trim()
}

export function getBodyNumberFormatError(raw: string): string | null {
  const n = normalizeBodyNumber(raw)
  if (!n.length) return "Body / Prangkisa number is required."
  if (n.length > BODY_NUMBER_MAX_LEN) {
    return `Body # must be at most ${BODY_NUMBER_MAX_LEN} characters.`
  }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(n)) {
    return "Body # cannot contain control characters."
  }
  return null
}

const NAME_PART_MAX_LEN = 80

export function normalizeNamePart(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export function getMemberFullNameFormatError(fullName: {
  first: string
  middle: string
  last: string
  suffix: string
}): string | null {
  const first = normalizeNamePart(fullName.first ?? "")
  const middle = normalizeNamePart(fullName.middle ?? "")
  const last = normalizeNamePart(fullName.last ?? "")
  const suffix = normalizeNamePart(fullName.suffix ?? "")
  if (!first) return "First name is required."
  if (!last) return "Last name is required."
  const parts: [string, string][] = [
    ["First name", first],
    ["Middle name", middle],
    ["Last name", last],
    ["Suffix", suffix],
  ]
  for (const [label, v] of parts) {
    if (!v) continue
    if (v.length > NAME_PART_MAX_LEN) {
      return `${label} must be at most ${NAME_PART_MAX_LEN} characters.`
    }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v)) {
      return `${label} cannot contain control characters.`
    }
  }
  return null
}

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
