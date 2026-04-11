import type { ButawRecord } from "@/lib/butaw-types"
import { emergencyOutstandingBalance } from "@/lib/emergency-loan"
import type { Loan } from "@/lib/loan-types"
import type { SavingsRecord } from "@/lib/savings-types"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value)
}

export function loanOutstandingBalance(loan: Loan): number {
  if (loan.loanType === "emergency") {
    return emergencyOutstandingBalance(loan)
  }
  const schedule = loan.schedule ?? []
  if (schedule.length === 0) {
    return loan.amountOfLoan
  }
  const paid = new Set(loan.paidDueDates ?? [])
  const ordered = [...schedule].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate)
  )
  let i = 0
  while (i < ordered.length && paid.has(ordered[i].dueDate)) {
    i += 1
  }
  if (i >= ordered.length) {
    return 0
  }
  if (i === 0) {
    return loan.amountOfLoan
  }
  return ordered[i - 1].balance
}

export type MemberFinancialSnapshot = {
  regularLoan: string
  emergencyLoan: string
  savings: string
  butaw: string
  regularLoanId: string | null
  emergencyLoanId: string | null
  hasSavingsRecord: boolean
  hasButawRecord: boolean
  hasAnyFinancialRecord: boolean
}

/** Latest lipatan time; financial rows created at or before this belong to the prior operator. */
export function maxLipatanTransferredAt(
  history: { transferredAt: string }[] | undefined | null
): string | null {
  if (!history?.length) return null
  let max = ""
  for (const h of history) {
    const t = (h.transferredAt ?? "").trim()
    if (t > max) max = t
  }
  return max || null
}

function recordBelongsToCurrentOperator(
  createdAt: string | undefined,
  afterIso: string | null
): boolean {
  if (!afterIso) return true
  const c = createdAt?.trim()
  if (!c) return false
  return c > afterIso
}

export function getMemberFinancialSnapshot(
  memberId: string,
  loans: Loan[],
  savings: SavingsRecord[],
  butaw: ButawRecord[],
  options?: {
    carriedShareCapital?: number
    /** Only count rows created after this ISO time (use last lipatan). */
    financialRecordsAfterIso?: string | null
  }
): MemberFinancialSnapshot {
  const afterIso = options?.financialRecordsAfterIso ?? null
  const myLoans = loans.filter(
    (l) =>
      l.memberId === memberId &&
      recordBelongsToCurrentOperator(l.createdAt, afterIso)
  )
  const regularLoans = myLoans.filter((l) => l.loanType !== "emergency")
  const emergencyLoans = myLoans.filter((l) => l.loanType === "emergency")
  const mySavings = savings.filter(
    (s) =>
      s.memberId === memberId &&
      recordBelongsToCurrentOperator(s.createdAt, afterIso)
  )
  const myButaw = butaw.filter(
    (b) =>
      b.memberId === memberId &&
      recordBelongsToCurrentOperator(b.createdAt, afterIso)
  )

  const regularSum = regularLoans.reduce(
    (s, l) => s + loanOutstandingBalance(l),
    0
  )
  const regularLoan =
    regularLoans.length === 0 ? "—" : formatCurrency(regularSum)
  const regularLoanId =
    regularLoans.length === 0
      ? null
      : [...regularLoans].sort((a, b) => b.dateReleased.localeCompare(a.dateReleased))[0]
          .id

  const emergencySum = emergencyLoans.reduce(
    (s, l) => s + loanOutstandingBalance(l),
    0
  )
  let emergencyLoan: string
  if (emergencyLoans.length === 0) {
    emergencyLoan = "—"
  } else if (
    emergencySum <= 0 &&
    emergencyLoans.every((l) => l.emergencySettled)
  ) {
    emergencyLoan = "Settled"
  } else {
    emergencyLoan = formatCurrency(emergencySum)
  }
  const emergencyLoanId =
    emergencyLoans.length === 0
      ? null
      : [...emergencyLoans]
          .sort((a, b) => b.dateReleased.localeCompare(a.dateReleased))[0]
          .id

  const savingsTotal = mySavings.reduce((s, r) => s + r.amount, 0)
  const savingsStr =
    mySavings.length === 0 ? "—" : formatCurrency(savingsTotal)

  const butawTotal = myButaw.reduce((s, r) => s + r.amount, 0)
  const carried =
    typeof options?.carriedShareCapital === "number" &&
    !Number.isNaN(options.carriedShareCapital)
      ? options.carriedShareCapital
      : 0
  const butawStr =
    myButaw.length > 0
      ? formatCurrency(butawTotal)
      : carried > 0.009
        ? formatCurrency(carried)
        : "—"

  const hasButawRecord = myButaw.length > 0 || carried > 0.009
  const hasAnyFinancialRecord =
    myLoans.length > 0 || mySavings.length > 0 || hasButawRecord

  return {
    regularLoan,
    emergencyLoan,
    savings: savingsStr,
    butaw: butawStr,
    regularLoanId,
    emergencyLoanId,
    hasSavingsRecord: mySavings.length > 0,
    hasButawRecord,
    hasAnyFinancialRecord,
  }
}
