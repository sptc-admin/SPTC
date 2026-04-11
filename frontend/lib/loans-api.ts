import { getPublicApiUrl } from "@/lib/api-base"
import { getAuthActorHeaders } from "@/lib/auth-actor"
import type { Loan } from "@/lib/loan-types"

export type LoanCreatePayload = Omit<Loan, "id" | "createdAt" | "updatedAt">

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchLoans(): Promise<Loan[]> {
  const res = await fetch(`${getPublicApiUrl()}/loans`, {
    cache: "no-store",
  })
  return parseJson<Loan[]>(res)
}

export async function createLoan(body: LoanCreatePayload): Promise<Loan> {
  const res = await fetch(`${getPublicApiUrl()}/loans`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<Loan>(res)
}

export async function updateLoan(
  id: string,
  body: Partial<LoanCreatePayload>
): Promise<Loan> {
  const res = await fetch(`${getPublicApiUrl()}/loans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<Loan>(res)
}

export async function deleteLoan(id: string): Promise<void> {
  const res = await fetch(`${getPublicApiUrl()}/loans/${id}`, {
    method: "DELETE",
    headers: getAuthActorHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}
