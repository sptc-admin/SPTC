const MAX_LEN = 120

export function normalizeBodyNumber(value: string): string {
  return value.replace(/,/g, '').replace(/\s+/g, ' ').trim()
}

export function getBodyNumberFormatError(raw: string): string | null {
  const n = normalizeBodyNumber(raw)
  if (!n.length) return 'Body / Prangkisa number is required.'
  if (n.length > MAX_LEN) return `Body # must be at most ${MAX_LEN} characters.`
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(n)) {
    return 'Body # cannot contain control characters.'
  }
  return null
}
