"use client"

import { assertSessionFresh, touchSessionActivity } from "@/lib/session-activity"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

function hasAuthUser(): boolean {
  try {
    return Boolean(localStorage.getItem("auth_user"))
  } catch {
    return false
  }
}

export function SessionIdleGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const bumpIfFresh = () => {
      if (!hasAuthUser()) return
      if (!assertSessionFresh()) {
        router.replace("/login")
        router.refresh()
        return
      }
      touchSessionActivity()
    }

    const checkOnly = () => {
      if (!hasAuthUser()) return
      if (!assertSessionFresh()) {
        router.replace("/login")
        router.refresh()
      }
    }

    checkOnly()

    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      bumpIfFresh()
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)

    const heartbeatMs = 45_000
    const interval = window.setInterval(() => {
      if (!hasAuthUser()) return
      bumpIfFresh()
    }, heartbeatMs)

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      window.clearInterval(interval)
    }
  }, [router])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "auth_user" && e.key !== "auth_last_activity_at") return
      if (!hasAuthUser()) {
        router.replace("/login")
        router.refresh()
        return
      }
      if (!assertSessionFresh()) {
        router.replace("/login")
        router.refresh()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [router])

  return <>{children}</>
}
