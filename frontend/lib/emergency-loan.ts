export const EMERGENCY_REFERENCE_MONTHS = 3

const MONTHLY_RATE = 0.015

export function addMonthsToYmd(ymd: string, monthsToAdd: number): string {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  const dt = new Date(y, m - 1 + monthsToAdd, d)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

/** 1-based month bucket from date released: first calendar month after release = 1, next = 2, … */
export function currentMonthBucket(dateReleasedYmd: string, asOf: Date = new Date()): number {
  const [y, m, d] = dateReleasedYmd.split("-").map(Number)
  if (!y || !m || !d) return 1
  const start = new Date(y, m - 1, d)
  if (Number.isNaN(start.getTime())) return 1
  const nowMs = asOf.getTime()
  if (nowMs < start.getTime()) return 1
  let n = 1
  while (n < 240) {
    const endExclusive = new Date(y, m - 1 + n, d)
    if (nowMs < endExclusive.getTime()) return n
    n += 1
  }
  return n
}

export function emergencyInterest(principal: number, monthBucket: number): number {
  if (principal <= 0 || monthBucket <= 0) return 0
  return principal * MONTHLY_RATE * monthBucket
}

export function emergencyTotalPayment(principal: number, monthBucket: number): number {
  return emergencyInterest(principal, monthBucket) + principal
}

/**
 * Current amount still owed: full payment due for this calendar month (n now) minus
 * amount recorded when marked paid. If the calendar month advances or payment was less
 * than the full amount for the current period, balance stays positive.
 */
export function emergencyOutstandingBalance(loan: {
  amountOfLoan: number
  dateReleased: string
  emergencySettled?: boolean
  emergencyPaidOn?: string | null
  emergencyAmountPaid?: number | null
}): number {
  const P = loan.amountOfLoan
  const n_now = currentMonthBucket(loan.dateReleased)
  if (!loan.emergencySettled) {
    return emergencyTotalPayment(P, n_now)
  }
  const paidYmd = loan.emergencyPaidOn?.trim()
  let credit: number
  if (
    loan.emergencyAmountPaid != null &&
    Number.isFinite(loan.emergencyAmountPaid)
  ) {
    credit = loan.emergencyAmountPaid
  } else if (paidYmd && /^\d{4}-\d{2}-\d{2}$/.test(paidYmd)) {
    const n_pay = currentMonthBucket(
      loan.dateReleased,
      new Date(`${paidYmd}T12:00:00`)
    )
    credit = emergencyTotalPayment(P, n_pay)
  } else {
    credit = 0
  }
  return Math.max(0, emergencyTotalPayment(P, n_now) - credit)
}

export function emergencyDueDateYmd(
  dateReleasedYmd: string,
  monthBucket: number
): string {
  return addMonthsToYmd(dateReleasedYmd, monthBucket)
}
