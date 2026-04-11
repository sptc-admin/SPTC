import { getPublicApiUrl } from "@/lib/api-base"
import { getAuthActorHeaders } from "@/lib/auth-actor"
import type { Member, MemberFullName, MemberAddress } from "@/lib/member-types"

export type LipatanPayload = {
  fullName: MemberFullName
  birthday: string
  address: MemberAddress
  contactMobile10: string
  tinDigits: string
  profileImageSrc: string
  precinctNumber: string
  documentUrl?: string
}

export type MemberCreatePayload = Omit<Member, "id">

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchMembers(): Promise<Member[]> {
  const res = await fetch(`${getPublicApiUrl()}/members`, {
    cache: "no-store",
  })
  return parseJson<Member[]>(res)
}

export async function createMember(body: MemberCreatePayload): Promise<Member> {
  const res = await fetch(`${getPublicApiUrl()}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<Member>(res)
}

export async function updateMember(
  id: string,
  body: Partial<MemberCreatePayload>
): Promise<Member> {
  const res = await fetch(`${getPublicApiUrl()}/members/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<Member>(res)
}

export async function deleteMember(id: string): Promise<void> {
  const res = await fetch(`${getPublicApiUrl()}/members/${id}`, {
    method: "DELETE",
    headers: getAuthActorHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}

export async function lipatanMember(
  franchiseMemberId: string,
  body: LipatanPayload
): Promise<Member> {
  const res = await fetch(
    `${getPublicApiUrl()}/members/${franchiseMemberId}/lipatan`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
      body: JSON.stringify(body),
    }
  )
  return parseJson<Member>(res)
}
