import { getPublicApiUrl } from "@/lib/api-base"
import { getAuthActorHeaders } from "@/lib/auth-actor"
import type { SavingsRecord } from "@/lib/savings-types"

export type SavingsRecordCreatePayload = Omit<
  SavingsRecord,
  "id" | "createdAt" | "updatedAt"
>

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchSavingsRecords(): Promise<SavingsRecord[]> {
  const res = await fetch(`${getPublicApiUrl()}/savings`, {
    cache: "no-store",
  })
  return parseJson<SavingsRecord[]>(res)
}

export async function createSavingsRecord(
  body: SavingsRecordCreatePayload
): Promise<SavingsRecord> {
  const res = await fetch(`${getPublicApiUrl()}/savings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<SavingsRecord>(res)
}
