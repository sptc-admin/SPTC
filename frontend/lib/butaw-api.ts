import { getPublicApiUrl } from "@/lib/api-base"
import { getAuthActorHeaders } from "@/lib/auth-actor"
import type { ButawRecord } from "@/lib/butaw-types"

export type ButawRecordCreatePayload = Pick<
  ButawRecord,
  "memberId" | "bodyNumber" | "memberName" | "amount"
> & { isAdvance?: boolean; month?: string }

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchButawRecords(): Promise<ButawRecord[]> {
  const res = await fetch(`${getPublicApiUrl()}/butaw`, {
    cache: "no-store",
  })
  return parseJson<ButawRecord[]>(res)
}

export async function createButawRecord(
  body: ButawRecordCreatePayload
): Promise<ButawRecord> {
  const res = await fetch(`${getPublicApiUrl()}/butaw`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<ButawRecord>(res)
}
