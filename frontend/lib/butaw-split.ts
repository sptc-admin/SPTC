/** Fixed monthly butaw ₱150: Share capital ₱30, monthly dues ₱90, member benefits ₱30. Advance uses the same ratios. */
export const BUTAW_SHARE_CAPITAL_RATIO = 30 / 150
export const BUTAW_MONTHLY_DUES_RATIO = 90 / 150
export const BUTAW_MEMBER_BENEFITS_RATIO = 30 / 150

export function butawSplit(amount: number) {
  return {
    shareCapital: amount * BUTAW_SHARE_CAPITAL_RATIO,
    monthlyDues: amount * BUTAW_MONTHLY_DUES_RATIO,
    memberBenefits: amount * BUTAW_MEMBER_BENEFITS_RATIO,
  }
}
