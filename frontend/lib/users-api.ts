import { getPublicApiUrl } from "@/lib/api-base"
import { getAuthActorHeaders } from "@/lib/auth-actor"
import type { StaffRole, StaffUser } from "@/lib/user-types"

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text()
  if (!text) return fallback
  try {
    const j = JSON.parse(text) as { message?: string | string[] }
    if (typeof j.message === "string") return j.message
    if (Array.isArray(j.message)) return j.message.join(", ")
  } catch {
    /* ignore */
  }
  return text || fallback
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(await errorMessage(res, `${res.status} ${res.statusText}`))
  }
  return res.json() as Promise<T>
}

export async function fetchStaffUsers(): Promise<StaffUser[]> {
  const res = await fetch(`${getPublicApiUrl()}/users`, { cache: "no-store" })
  return parseJson<StaffUser[]>(res)
}

export type StaffUserCreatePayload = {
  username: string
  password: string
  firstname: string
  lastname: string
  role: StaffRole
}

export async function createStaffUser(
  body: StaffUserCreatePayload
): Promise<StaffUser> {
  const res = await fetch(`${getPublicApiUrl()}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<StaffUser>(res)
}

export async function updateStaffUser(
  id: number,
  body: Partial<{
    username: string
    firstname: string
    lastname: string
    role: StaffRole
  }>
): Promise<StaffUser> {
  const res = await fetch(`${getPublicApiUrl()}/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<StaffUser>(res)
}

export async function setStaffUserPassword(
  id: number,
  password: string
): Promise<StaffUser> {
  const res = await fetch(`${getPublicApiUrl()}/users/${id}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify({ password }),
  })
  return parseJson<StaffUser>(res)
}

export async function setStaffUserEnabled(
  id: number,
  enabled: boolean
): Promise<StaffUser> {
  const res = await fetch(`${getPublicApiUrl()}/users/${id}/enabled`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify({ enabled }),
  })
  return parseJson<StaffUser>(res)
}

export async function deleteStaffUser(id: number): Promise<void> {
  const res = await fetch(`${getPublicApiUrl()}/users/${id}`, {
    method: "DELETE",
    headers: getAuthActorHeaders(),
  })
  if (!res.ok) {
    throw new Error(
      await errorMessage(res, `${res.status} ${res.statusText}`)
    )
  }
}
