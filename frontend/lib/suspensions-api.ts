import { getPublicApiUrl } from "@/lib/api-base"
import { getAuthActorHeaders } from "@/lib/auth-actor"
import type { Suspension } from "@/lib/suspension-types"

export type SuspensionCreatePayload = Omit<
  Suspension,
  "id" | "createdAt" | "updatedAt"
>

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchSuspensions(): Promise<Suspension[]> {
  const res = await fetch(`${getPublicApiUrl()}/suspensions`, {
    cache: "no-store",
  })
  return parseJson<Suspension[]>(res)
}

export async function createSuspension(
  body: SuspensionCreatePayload
): Promise<Suspension> {
  const res = await fetch(`${getPublicApiUrl()}/suspensions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<Suspension>(res)
}

export async function updateSuspension(
  id: string,
  body: Partial<SuspensionCreatePayload>
): Promise<Suspension> {
  const res = await fetch(`${getPublicApiUrl()}/suspensions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<Suspension>(res)
}

export async function deleteSuspension(id: string): Promise<void> {
  const res = await fetch(`${getPublicApiUrl()}/suspensions/${id}`, {
    method: "DELETE",
    headers: getAuthActorHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}
