"use client"

import { PageLoader } from "@/components/page-loader"
import { useRouter } from "next/navigation"
import { ReactNode, useEffect, useState } from "react"

type AuthUser = {
  username?: string
  firstname?: string
  lastname?: string
  name?: string
  role?: string
}

function getAuthUser(): AuthUser | null {
  try {
    const rawUser = localStorage.getItem("auth_user")
    if (!rawUser) return null
    const parsed = JSON.parse(rawUser) as AuthUser | null
    if (!parsed) return null

    const hasIdentity =
      Boolean(parsed.username) ||
      Boolean(parsed.name) ||
      Boolean(parsed.firstname) ||
      Boolean(parsed.lastname)
    if (!hasIdentity) return null

    return parsed
  } catch {
    localStorage.removeItem("auth_user")
    return null
  }
}

export function ProtectedRoute({
  children,
  requiredRole,
  unauthorizedRedirectTo = "/dashboard",
}: {
  children: ReactNode
  requiredRole?: string
  unauthorizedRedirectTo?: string
}) {
  const router = useRouter()
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser) {
      router.replace("/login")
      return
    }

    if (
      requiredRole &&
      (authUser.role ?? "").toLowerCase() !== requiredRole.toLowerCase()
    ) {
      router.replace(unauthorizedRedirectTo)
      return
    }

    setIsAllowed(true)
  }, [requiredRole, router, unauthorizedRedirectTo])

  if (isAllowed !== true) return <PageLoader message="Checking session…" />
  return <>{children}</>
}

export function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [canViewGuestPage, setCanViewGuestPage] = useState<boolean | null>(null)

  useEffect(() => {
    if (getAuthUser()) {
      router.replace("/dashboard")
      return
    }
    setCanViewGuestPage(true)
  }, [router])

  if (canViewGuestPage !== true) return <PageLoader message="Loading…" />
  return <>{children}</>
}
