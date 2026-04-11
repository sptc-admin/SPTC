import { getPublicApiUrl } from "@/lib/api-base"
import { getAuthActorHeaders } from "@/lib/auth-actor"
import type { Operation } from "@/lib/operation-types"

export type OperationCreatePayload = {
  bodyNumber: string
  mtopDocumentUrl: string
  ltoDocumentUrl: string
  mtopExpirationDate: string
  ltoExpirationDate: string
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchOperations(): Promise<Operation[]> {
  const res = await fetch(`${getPublicApiUrl()}/operations`, {
    cache: "no-store",
  })
  return parseJson<Operation[]>(res)
}

export async function createOperation(
  body: OperationCreatePayload
): Promise<Operation> {
  const res = await fetch(`${getPublicApiUrl()}/operations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<Operation>(res)
}

export async function updateOperation(
  id: string,
  body: Partial<OperationCreatePayload>
): Promise<Operation> {
  const res = await fetch(`${getPublicApiUrl()}/operations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthActorHeaders() },
    body: JSON.stringify(body),
  })
  return parseJson<Operation>(res)
}

export async function deleteOperation(id: string): Promise<void> {
  const res = await fetch(`${getPublicApiUrl()}/operations/${id}`, {
    method: "DELETE",
    headers: getAuthActorHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}
