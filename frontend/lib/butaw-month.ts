import type { ButawRecord } from "@/lib/butaw-types"

export const BUTAW_MONTHLY_AMOUNT = 150

export function currentYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function addMonthsYm(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(y, (m ?? 1) - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function recordEndYm(
  r: Pick<ButawRecord, "month" | "monthEnd">
): string {
  return r.monthEnd ?? r.month
}

export function maxCoveredEndForMember(
  records: ButawRecord[],
  memberId: string
): string | null {
  let max: string | null = null
  for (const r of records) {
    if (r.memberId !== memberId) continue
    const end = recordEndYm(r)
    if (!max || end.localeCompare(max) > 0) max = end
  }
  return max
}

export function nextBlockStartYm(lastEnd: string | null): string {
  if (!lastEnd) return currentYm()
  return addMonthsYm(lastEnd, 1)
}

export function defaultStartMonthForMember(
  records: ButawRecord[],
  memberId: string
): string {
  if (!memberId) return currentYm()
  return nextBlockStartYm(maxCoveredEndForMember(records, memberId))
}

function formatMonthYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  if (!y || !m) return ym
  const d = new Date(y, m - 1, 1)
  if (Number.isNaN(d.getTime())) return ym
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export function formatButawMonthRange(startYm: string, endYm: string): string {
  if (startYm === endYm) return formatMonthYm(startYm)
  return `${formatMonthYm(startYm)} – ${formatMonthYm(endYm)}`
}

export function previewCoverage(
  memberId: string,
  amountPesos: number,
  records: ButawRecord[]
): { start: string; end: string; months: number } | null {
  if (!memberId) return null
  const cents = Math.round(amountPesos * 100)
  if (cents <= 0 || cents % (BUTAW_MONTHLY_AMOUNT * 100) !== 0) return null
  const months = cents / (BUTAW_MONTHLY_AMOUNT * 100)
  const last = maxCoveredEndForMember(records, memberId)
  const start = nextBlockStartYm(last)
  const end = addMonthsYm(start, months - 1)
  return { start, end, months }
}

export function isValidButawAmountPesos(value: number): boolean {
  const cents = Math.round(value * 100)
  return cents > 0 && cents % (BUTAW_MONTHLY_AMOUNT * 100) === 0
}
