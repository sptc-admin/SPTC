"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { fetchAuditLogs, type AuditLogItem } from "@/lib/audit-logs-api"

const MODULE_OPTIONS = [
  "all",
  "members",
  "drivers",
  "financial-records",
  "arkilahan",
  "lipatan",
  "suspensions",
  "operations",
  "dashboard",
  "staff",
] as const

function normalizeModuleFilter(v: string): string {
  if (v === "financial-records") return "loans+savings+butaw"
  if (v === "staff") return "users"
  return v
}

export function AuditTrailPage() {
  const [logs, setLogs] = React.useState<AuditLogItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [moduleFilter, setModuleFilter] = React.useState("all")

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const normalized = normalizeModuleFilter(moduleFilter)
    if (normalized === "loans+savings+butaw") {
      Promise.all([
        fetchAuditLogs("loans"),
        fetchAuditLogs("savings"),
        fetchAuditLogs("butaw"),
      ])
        .then(([loans, savings, butaw]) => {
          if (cancelled) return
          setLogs(
            [...loans, ...savings, ...butaw].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt)
            )
          )
        })
        .catch((e: unknown) => {
          if (cancelled) return
          setError(e instanceof Error ? e.message : "Could not load audit trail.")
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return
    }

    fetchAuditLogs(normalized)
      .then((rows) => {
        if (cancelled) return
        setLogs(rows)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Could not load audit trail.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [moduleFilter])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Audit Trail</CardTitle>
          <SearchableSelect
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            {MODULE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === "all"
                  ? "All modules"
                  : m === "financial-records"
                    ? "Financial records"
                    : m === "staff"
                      ? "Staff"
                      : m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </SearchableSelect>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading audit trail...
            </p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No audit records yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {logs.map((row) => (
                <li
                  key={row.id}
                  className="rounded-md border bg-muted/30 px-3 py-2.5 text-sm"
                >
                  <p className="font-medium">{row.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    • {row.module}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
