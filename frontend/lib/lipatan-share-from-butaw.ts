import { butawSplit } from "@/lib/butaw-split"
import type { ButawRecord } from "@/lib/butaw-types"
import type { LipatanHistoryEntry } from "@/lib/member-types"
import { LIPATAN_SHARE_CAPITAL_DEDUCTION } from "@/lib/lipatan-constants"

export function shareCapitalGrossFromButaw(
  records: ButawRecord[],
  memberId: string
): number {
  return records
    .filter((r) => r.memberId === memberId)
    .reduce((s, r) => s + butawSplit(r.amount).shareCapital, 0)
}

export function priorLipatanShareDeductions(history: LipatanHistoryEntry[]): number {
  return history.reduce(
    (s, h) =>
      s +
      (typeof h.shareCapitalDeducted === "number" &&
      !Number.isNaN(h.shareCapitalDeducted)
        ? h.shareCapitalDeducted
        : LIPATAN_SHARE_CAPITAL_DEDUCTION),
    0
  )
}

export function availableShareCapitalForLipatan(
  records: ButawRecord[],
  memberId: string,
  lipatanHistory: LipatanHistoryEntry[] | undefined
): {
  grossFromButaw: number
  priorDeductions: number
  available: number
} {
  const grossFromButaw = shareCapitalGrossFromButaw(records, memberId)
  const priorDeductions = priorLipatanShareDeductions(lipatanHistory ?? [])
  return {
    grossFromButaw,
    priorDeductions,
    available: grossFromButaw - priorDeductions,
  }
}
