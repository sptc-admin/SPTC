import type { LoanScheduleRow, LoanPaymentRecord } from "@/lib/loan-types"

export const DIMINISHING_SCHEDULE_FACTOR = 0.0998

export type AmortRow = {
  dueDate: string
  dueLabel: string
  interest: number
  principal: number
  total: number
  balance: number
  processingFee: number
  payment: number
}

export type EffectiveScheduleRow = LoanScheduleRow & {
  actualPayment: number | null
  extraPrincipal: number
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function toYmd(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function roundUpToNearest5(value: number): number {
  return Math.ceil(value / 5) * 5
}

export function buildDiminishingSchedule(
  loanAmount: number,
  months: number,
  monthlyRate: number,
  totalProcessingFee: number,
  baseDate: Date
): AmortRow[] {
  if (loanAmount <= 0 || months <= 0 || Number.isNaN(baseDate.getTime())) {
    return []
  }

  const fixedTotal = roundUpToNearest5(
    (loanAmount * (1 + DIMINISHING_SCHEDULE_FACTOR)) / months
  )
  const cents = (n: number) => Math.round(n * 100) / 100
  const processingEach = cents(totalProcessingFee / months)

  const rows: AmortRow[] = []
  let balance = cents(loanAmount)

  for (let i = 0; i < months; i++) {
    const due = addMonths(baseDate, i + 1)
    const isLast = i === months - 1
    const interest = cents(balance * monthlyRate)

    let total: number
    let principalPaid: number
    let endingBalance: number

    if (isLast) {
      principalPaid = balance
      total = cents(principalPaid + interest)
      endingBalance = 0
    } else {
      total = fixedTotal
      principalPaid = cents(total - interest)
      endingBalance = cents(balance - principalPaid)
    }

    const processingFee = processingEach
    const payment = cents(total + processingFee)

    rows.push({
      dueDate: toYmd(due),
      dueLabel: formatDateLong(due),
      interest,
      principal: principalPaid,
      total,
      balance: endingBalance,
      processingFee,
      payment,
    })

    balance = endingBalance
  }

  return rows
}

function roundHalf(value: number): number {
  return Math.round(value)
}

export function computeEffectiveSchedule(
  originalSchedule: LoanScheduleRow[],
  payments: LoanPaymentRecord[] | null | undefined,
  _interestRate: number,
  _amountOfLoan: number
): EffectiveScheduleRow[] {
  if (!originalSchedule || originalSchedule.length === 0) return []

  const paymentMap = new Map<string, number>()
  for (const p of payments ?? []) {
    paymentMap.set(p.dueDate, p.amount)
  }

  const effectiveRows: EffectiveScheduleRow[] = []
  let pendingExtra = 0
  let cumulativeExtra = 0

  for (let i = 0; i < originalSchedule.length; i++) {
    const orig = originalSchedule[i]
    const actualPaid = paymentMap.get(orig.dueDate) ?? null

    const extraFromPrevious = pendingExtra
    cumulativeExtra += extraFromPrevious

    let thisMonthExtra = 0
    if (actualPaid !== null) {
      const excessOverPayment = actualPaid - orig.payment
      if (excessOverPayment > 0) {
        thisMonthExtra = Math.round(excessOverPayment * 100) / 100
      }
    }

    const newPrincipal = roundHalf(orig.principal + extraFromPrevious)
    const newBalance = Math.max(0, roundHalf(orig.balance - cumulativeExtra))

    effectiveRows.push({
      dueDate: orig.dueDate,
      interest: roundHalf(orig.interest),
      principal: newPrincipal,
      total: roundHalf(orig.interest + newPrincipal),
      balance: newBalance,
      processingFee: roundHalf(orig.processingFee),
      payment: roundHalf(actualPaid !== null ? actualPaid : orig.payment),
      actualPayment: actualPaid !== null ? roundHalf(actualPaid) : null,
      extraPrincipal: roundHalf(extraFromPrevious),
    })

    pendingExtra = thisMonthExtra
  }

  return effectiveRows
}
