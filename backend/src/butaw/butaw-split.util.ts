/** Same split as monthly Butaw ₱150: ₱30 share capital per record amount. */
export const BUTAW_SHARE_CAPITAL_RATIO = 30 / 150;

export function butawAmountToShareCapital(amount: number): number {
  return amount * BUTAW_SHARE_CAPITAL_RATIO;
}
