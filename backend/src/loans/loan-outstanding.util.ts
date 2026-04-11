import type { Loan } from './loan.entity';

const MONTHLY_RATE = 0.015;

function currentMonthBucket(dateReleasedYmd: string, asOf: Date = new Date()): number {
  const [y, m, d] = dateReleasedYmd.split('-').map(Number);
  if (!y || !m || !d) return 1;
  const start = new Date(y, m - 1, d);
  if (Number.isNaN(start.getTime())) return 1;
  const nowMs = asOf.getTime();
  if (nowMs < start.getTime()) return 1;
  let n = 1;
  while (n < 240) {
    const endExclusive = new Date(y, m - 1 + n, d);
    if (nowMs < endExclusive.getTime()) return n;
    n += 1;
  }
  return n;
}

function emergencyInterest(principal: number, monthBucket: number): number {
  if (principal <= 0 || monthBucket <= 0) return 0;
  return principal * MONTHLY_RATE * monthBucket;
}

function emergencyTotalPayment(principal: number, monthBucket: number): number {
  return emergencyInterest(principal, monthBucket) + principal;
}

function emergencyOutstandingBalance(loan: Pick<
  Loan,
  | 'amountOfLoan'
  | 'dateReleased'
  | 'emergencySettled'
  | 'emergencyPaidOn'
  | 'emergencyAmountPaid'
>): number {
  const P = loan.amountOfLoan;
  const n_now = currentMonthBucket(loan.dateReleased);
  if (!loan.emergencySettled) {
    return emergencyTotalPayment(P, n_now);
  }
  const paidYmd = loan.emergencyPaidOn?.trim();
  let credit: number;
  if (
    loan.emergencyAmountPaid != null &&
    Number.isFinite(loan.emergencyAmountPaid)
  ) {
    credit = loan.emergencyAmountPaid;
  } else if (paidYmd && /^\d{4}-\d{2}-\d{2}$/.test(paidYmd)) {
    const n_pay = currentMonthBucket(
      loan.dateReleased,
      new Date(`${paidYmd}T12:00:00`),
    );
    credit = emergencyTotalPayment(P, n_pay);
  } else {
    credit = 0;
  }
  return Math.max(0, emergencyTotalPayment(P, n_now) - credit);
}

export function loanOutstandingBalance(loan: Loan): number {
  if (loan.loanType === 'emergency') {
    return emergencyOutstandingBalance(loan);
  }
  const schedule = loan.schedule ?? [];
  if (schedule.length === 0) {
    return loan.amountOfLoan;
  }
  const paid = new Set(loan.paidDueDates ?? []);
  const ordered = [...schedule].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  let i = 0;
  while (i < ordered.length && paid.has(ordered[i].dueDate)) {
    i += 1;
  }
  if (i >= ordered.length) {
    return 0;
  }
  if (i === 0) {
    return loan.amountOfLoan;
  }
  return ordered[i - 1].balance;
}

/** True if regular or emergency loans still show any amount due (same rules as the app UI). */
export function memberHasOutstandingLoan(loans: Loan[], memberId: string): boolean {
  return loans
    .filter((l) => l.memberId === memberId)
    .some((l) => loanOutstandingBalance(l) > 0.009);
}
