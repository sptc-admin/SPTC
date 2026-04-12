/** Same threshold as auto fee in add-regular-loan / loan-import. */
export const LOAN_PROCESSING_FEE_AMOUNT_THRESHOLD = 30000

/**
 * Excel (and some bad saves) store 3% as 0.03. Canonical form is whole percent: 3, 6.
 */
export function normalizeStoredProcessingFeeRate(rate: number): number {
  if (!Number.isFinite(rate)) return rate
  if (rate > 0 && rate < 1) return Math.round(rate * 10000) / 100
  return rate
}

/**
 * For loan amount ≤ ₱30,000 only 3% is allowed; above that only 6%.
 * Pass rate already in “whole percent” form (use normalizeStoredProcessingFeeRate first if needed).
 */
export function processingFeeVsAmountError(
  amountOfLoan: number,
  ratePercent: number,
): string | null {
  const r = normalizeStoredProcessingFeeRate(ratePercent)
  if (amountOfLoan <= LOAN_PROCESSING_FEE_AMOUNT_THRESHOLD && Math.abs(r - 6) < 0.0001) {
    return "For loan amount ₱30,000 and below, use 3% processing fee (6% is not allowed)."
  }
  if (amountOfLoan > LOAN_PROCESSING_FEE_AMOUNT_THRESHOLD && Math.abs(r - 3) < 0.0001) {
    return "For loan amount above ₱30,000, use 6% processing fee (3% is not allowed)."
  }
  return null
}
