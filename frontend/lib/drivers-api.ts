import { getPublicApiUrl } from "@/lib/api-base"
import { getAuthActorHeaders } from "@/lib/auth-actor"
import type { Driver } from "@/lib/driver-types"

export type DriverCreatePayload = Omit<Driver, "id" | "createdAt" | "updatedAt">

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchDrivers(): Promise<Driver[]> {
  const res = await fetch(`${getPublicApiUrl()}/drivers`, {
    cache: "no-store",
  })
  return parseJson<Driver[]>(res)
}

export async function createDriver(body: DriverCreatePayload): Promise<Driver> {
  const res = await fetch(`${getPublicApiUrl()}/drivers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<Driver>(res)
}

export async function updateDriver(
  id: string,
  body: Partial<DriverCreatePayload>
): Promise<Driver> {
  const res = await fetch(`${getPublicApiUrl()}/drivers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<Driver>(res)
}

export async function deleteDriver(id: string): Promise<void> {
  const res = await fetch(`${getPublicApiUrl()}/drivers/${id}`, {
    method: "DELETE",
    headers: getAuthActorHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}
