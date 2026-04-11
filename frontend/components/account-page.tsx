"use client"

import { UserRound } from "lucide-react"
import { useEffect, useState } from "react"

import { SkeletonPage } from "@/components/skeleton-page"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type AuthUser = {
  firstname?: string
  lastname?: string
  username?: string
  role?: string
}

function readAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("auth_user")
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

function formatRole(role: string | undefined): string {
  const r = (role ?? "").trim().toLowerCase()
  if (r === "admin") return "Admin"
  if (r === "staff") return "Staff"
  if (!r) return "—"
  return r.charAt(0).toUpperCase() + r.slice(1)
}

function initialsFor(user: AuthUser | null, fullName: string): string {
  if (user?.firstname || user?.lastname) {
    const a = (user.firstname ?? "").trim().charAt(0)
    const b = (user.lastname ?? "").trim().charAt(0)
    const pair = `${a}${b}`.toUpperCase()
    if (pair) return pair
  }
  const u = (user?.username ?? "").trim()
  if (u.length >= 2) return u.slice(0, 2).toUpperCase()
  if (fullName !== "—" && fullName.length >= 2) {
    const parts = fullName.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
    }
    return fullName.slice(0, 2).toUpperCase()
  }
  return "?"
}

export function AccountPage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setUser(readAuthUser())
    setReady(true)
  }, [])

  const fullName =
    `${user?.firstname ?? ""} ${user?.lastname ?? ""}`.trim() ||
    user?.username?.trim() ||
    "—"

  const roleLabel = formatRole(user?.role)
  const isAdmin = (user?.role ?? "").trim().toLowerCase() === "admin"
  const initials = user ? initialsFor(user, fullName) : ""

  const cardShell =
    "relative w-full max-w-md overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/25 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.12),0_12px_24px_-8px_rgba(15,23,42,0.06)] after:pointer-events-none after:absolute after:inset-0 after:rounded-2xl after:ring-1 after:ring-inset after:ring-white/60 dark:border-border/30 dark:from-card dark:via-card dark:to-muted/15 dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.35)] dark:after:ring-white/[0.04]"

  return (
    <SkeletonPage>
      <div className="flex flex-1 flex-col items-center p-4 sm:p-6 lg:p-8">
        {!ready ? (
          <Card className={cn("border-0 bg-transparent p-0 shadow-none", cardShell)}>
            <CardContent className="flex flex-col items-center gap-6 px-6 pb-10 pt-10 sm:px-8 sm:pt-12">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex w-full flex-col items-center gap-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className={cn("border-0 bg-transparent p-0 shadow-none", cardShell)}>
            <CardContent className="relative z-10 flex flex-col items-center gap-6 px-6 pb-10 pt-10 sm:px-8 sm:pt-12">
              <Avatar className="h-24 w-24 border-2 border-background/80 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.15)] ring-1 ring-border/20">
                <AvatarFallback
                  className={cn(
                    "text-2xl font-semibold tracking-tight text-white shadow-inner",
                    isAdmin
                      ? "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900"
                      : "bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700"
                  )}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="text-center">
                <p className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" aria-hidden />
                  Signed in as
                </p>
                <h2 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]">
                  {fullName}
                </h2>
                {user?.username &&
                fullName !== user.username.trim() ? (
                  <p className="mt-1.5 font-mono text-xs text-muted-foreground">
                    @{user.username}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">Role</span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold",
                    isAdmin
                      ? "border-slate-700/15 bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-sm"
                      : "border-border/50 bg-muted/80 text-foreground shadow-sm"
                  )}
                >
                  {roleLabel}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SkeletonPage>
  )
}
