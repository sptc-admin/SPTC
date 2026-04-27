/** Used by loan import when processing fee cell is left blank. */
export const LOAN_PROCESSING_FEE_AMOUNT_THRESHOLD = 30000

/**
 * Excel (and some bad saves) store 3% as 0.03. Canonical form is whole percent: 3, 6.
 */
export function normalizeStoredProcessingFeeRate(rate: number): number {
  if (!Number.isFinite(rate)) return rate
  if (rate > 0 && rate < 1) return Math.round(rate * 10000) / 100
  return rate
}

