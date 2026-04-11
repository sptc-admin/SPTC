import { getPublicApiUrl } from "@/lib/api-base"

export type AuditLogItem = {
  id: string
  module: string
  action: "create" | "update" | "delete" | "export" | "import"
  message: string
  actorName: string
  actorRole: string
  method: string
  path: string
  createdAt: string
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchAuditLogs(module = "all"): Promise<AuditLogItem[]> {
  const params = new URLSearchParams()
  if (module && module !== "all") params.set("module", module)
  const suffix = params.toString() ? `?${params.toString()}` : ""
  const res = await fetch(`${getPublicApiUrl()}/audit-logs${suffix}`, {
    cache: "no-store",
  })
  return parseJson<AuditLogItem[]>(res)
}

export async function createAuditLogEvent(input: {
  module: string
  action: "export" | "import"
  message: string
  method?: string
  path?: string
}): Promise<AuditLogItem> {
  const { getAuthActorHeaders } = await import("@/lib/auth-actor")
  const res = await fetch(`${getPublicApiUrl()}/audit-logs/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthActorHeaders(),
    },
    body: JSON.stringify(input),
  })
  return parseJson<AuditLogItem>(res)
}
