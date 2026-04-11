const LAST_KEY = "auth_last_activity_at"

export const SESSION_IDLE_MS = 60 * 60 * 1000

export function readLastActivityAt(): number | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(LAST_KEY)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function touchSessionActivity(): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LAST_KEY, String(Date.now()))
}

export function clearSessionActivity(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(LAST_KEY)
}

export function clearStoredAuth(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem("auth_user")
  clearSessionActivity()
}

export function assertSessionFresh(): boolean {
  const last = readLastActivityAt()
  if (last == null) {
    touchSessionActivity()
    return true
  }
  if (Date.now() - last > SESSION_IDLE_MS) {
    clearStoredAuth()
    return false
  }
  return true
}
