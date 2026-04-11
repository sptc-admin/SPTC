export function getAuthActorHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem("auth_user")
    if (!raw) return {}
    const parsed = JSON.parse(raw) as
      | {
          firstname?: string
          lastname?: string
          name?: string
          username?: string
          role?: string
        }
      | null
    if (!parsed) return {}
    const full = `${parsed.firstname ?? ""} ${parsed.lastname ?? ""}`.trim()
    const actorName = full || parsed.name?.trim() || parsed.username?.trim() || ""
    const actorRole = (parsed.role ?? "").trim().toLowerCase()
    if (!actorName || !actorRole) return {}
    return {
      "x-actor-name": actorName,
      "x-actor-role": actorRole,
    }
  } catch {
    return {}
  }
}

export function formatAuthActorLabel(): string {
  const h = getAuthActorHeaders()
  const name = (h["x-actor-name"] ?? "").trim()
  const roleRaw = (h["x-actor-role"] ?? "").trim().toLowerCase()
  if (!name) return "Unknown user"
  const role =
    roleRaw === "admin"
      ? "Admin"
      : roleRaw === "staff"
        ? "Staff"
        : roleRaw
          ? roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1)
          : "Staff"
  return `${name} (${role})`
}
