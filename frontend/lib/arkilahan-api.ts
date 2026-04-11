import { getPublicApiUrl } from "@/lib/api-base"
import { getAuthActorHeaders } from "@/lib/auth-actor"
import type { Arkilahan } from "@/lib/arkilahan-types"

export type ArkilahanCreatePayload = Omit<Arkilahan, "id" | "createdAt" | "updatedAt">

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchArkilahan(): Promise<Arkilahan[]> {
  const res = await fetch(`${getPublicApiUrl()}/arkilahan`, {
    cache: "no-store",
  })
  return parseJson<Arkilahan[]>(res)
}

export async function createArkilahan(
  body: ArkilahanCreatePayload
): Promise<Arkilahan> {
  const res = await fetch(`${getPublicApiUrl()}/arkilahan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<Arkilahan>(res)
}

export async function updateArkilahan(
  id: string,
  body: Partial<ArkilahanCreatePayload>
): Promise<Arkilahan> {
  const res = await fetch(`${getPublicApiUrl()}/arkilahan/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<Arkilahan>(res)
}

export async function deleteArkilahan(id: string): Promise<void> {
  const res = await fetch(`${getPublicApiUrl()}/arkilahan/${id}`, {
    method: "DELETE",
    headers: getAuthActorHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}
