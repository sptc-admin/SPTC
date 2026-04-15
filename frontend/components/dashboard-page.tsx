"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, Loader2 } from "lucide-react"

import { DashboardSkeleton } from "@/components/dashboard-skeleton"
import { PageDataExportButton } from "@/components/page-data-export"
import { SiteHeader } from "@/components/site-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { fetchArkilahan } from "@/lib/arkilahan-api"
import type { Arkilahan } from "@/lib/arkilahan-types"
import { fetchDrivers } from "@/lib/drivers-api"
import { fetchLoans } from "@/lib/loans-api"
import type { Member } from "@/lib/member-types"
import { fetchMembers } from "@/lib/members-api"
import { fetchOperations } from "@/lib/operations-api"
import type { Operation } from "@/lib/operation-types"
import { formatExportDateTime, type CsvExportSection } from "@/lib/csv-export"
import { fetchSuspensions } from "@/lib/suspensions-api"
import type { Suspension } from "@/lib/suspension-types"

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function ymdFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function currentMonthYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function ymdRangeForMonthYm(ym: string): { from: string; to: string } | null {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null
  const [y, m] = ym.split("-").map(Number)
  return {
    from: ymdFromDate(new Date(y, m - 1, 1)),
    to: ymdFromDate(new Date(y, m, 0)),
  }
}

function recordYmd(iso: string | undefined | null): string | null {
  if (!iso) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  return m ? m[1] : null
}

function inYmdRange(ymd: string | null, from: string, to: string): boolean {
  if (!ymd) return false
  return ymd >= from && ymd <= to
}

function formatYmdShort(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function countLipatanInRange(members: Member[], from: string, to: string): number {
  let n = 0
  for (const m of members) {
    for (const e of m.lipatanHistory ?? []) {
      const ymd = recordYmd(e.transferredAt)
      if (inYmdRange(ymd, from, to)) n += 1
    }
  }
  return n
}

function topUpcomingByDate<T>(
  rows: T[],
  getDate: (row: T) => string,
  maxItems = 3
): T[] {
  const t = todayYmd()
  return rows
    .filter((r) => getDate(r) >= t)
    .sort((a, b) => getDate(a).localeCompare(getDate(b)))
    .slice(0, maxItems)
}

function topArkilahanDue(rows: Arkilahan[]): Arkilahan[] {
  return topUpcomingByDate(rows, (r) => r.dueDate)
}

function topSuspensionEnd(rows: Suspension[]): Suspension[] {
  return topUpcomingByDate(
    rows.filter((s) => s.status === "active"),
    (r) => r.endDate
  )
}

function topMtopExpiry(rows: Operation[]): Operation[] {
  return topUpcomingByDate(rows, (r) => r.mtopExpirationDate)
}

type ModuleCount = { key: string; label: string; count: number }

function DashboardLayout({
  headerTrailing,
  children,
}: {
  headerTrailing?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <SiteHeader trailing={headerTrailing} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">{children}</div>
      </div>
    </>
  )
}

export function DashboardPage() {
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [dateFilterMode, setDateFilterMode] = React.useState<"range" | "all">(
    "range"
  )
  const [filterMonth, setFilterMonth] = React.useState(currentMonthYm)

  const [arkilahan, setArkilahan] = React.useState<Arkilahan[]>([])
  const [suspensions, setSuspensions] = React.useState<Suspension[]>([])
  const [operations, setOperations] = React.useState<Operation[]>([])
  const [moduleRows, setModuleRows] = React.useState<ModuleCount[]>([])

  const load = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const settled = await Promise.allSettled([
      fetchMembers(),
      fetchDrivers(),
      fetchLoans(),
      fetchArkilahan(),
      fetchSuspensions(),
      fetchOperations(),
    ])

    const [membersR, driversR, loansR, arkR, suspR, opsR] = settled

    if (membersR.status === "rejected") {
      setLoadError(
        membersR.reason instanceof Error
          ? membersR.reason.message
          : "Could not load dashboard data."
      )
      setLoading(false)
      return
    }

    const members = membersR.value
    const drivers = driversR.status === "fulfilled" ? driversR.value : []
    const loans = loansR.status === "fulfilled" ? loansR.value : []
    const ark = arkR.status === "fulfilled" ? arkR.value : []
    const susp = suspR.status === "fulfilled" ? suspR.value : []
    const ops = opsR.status === "fulfilled" ? opsR.value : []

    if (
      driversR.status === "rejected" ||
      loansR.status === "rejected" ||
      arkR.status === "rejected" ||
      suspR.status === "rejected" ||
      opsR.status === "rejected"
    ) {
      setLoadError("Some modules failed to load. Counts may be incomplete.")
    }

    const range =
      dateFilterMode === "all" ? null : ymdRangeForMonthYm(filterMonth)
    const from = range?.from ?? ""
    const to = range?.to ?? ""
    const includeByDate = (ymd: string | null) => {
      if (dateFilterMode === "all") return true
      if (!range) return false
      return inYmdRange(ymd, from, to)
    }

    const membersCount = members.filter((m) =>
      includeByDate(recordYmd(m.createdAt))
    ).length
    const driversCount = drivers.filter((d) =>
      includeByDate(recordYmd(d.createdAt))
    ).length
    const loansCount = loans.filter((l) =>
      includeByDate(recordYmd(l.createdAt))
    ).length
    const arkCount = ark.filter((a) =>
      includeByDate(recordYmd(a.createdAt))
    ).length
    const lipatanCount =
      dateFilterMode === "all"
        ? members.reduce((n, m) => n + (m.lipatanHistory?.length ?? 0), 0)
        : countLipatanInRange(members, from, to)
    const suspCount = susp.filter((s) =>
      includeByDate(recordYmd(s.createdAt))
    ).length

    const rows: ModuleCount[] = [
      { key: "members", label: "Members", count: membersCount },
      { key: "drivers", label: "Drivers", count: driversCount },
      { key: "loans", label: "Loans", count: loansCount },
      { key: "arkilahan", label: "Arkilahan", count: arkCount },
      { key: "suspensions", label: "Suspensions", count: suspCount },
      { key: "lipatan", label: "Lipatan", count: lipatanCount },
    ]

    setModuleRows(rows)
    setArkilahan(ark)
    setSuspensions(susp)
    setOperations(ops)

    setLoading(false)
  }, [filterMonth, dateFilterMode])

  React.useEffect(() => {
    load()
  }, [load])

  const nearArk = topArkilahanDue(arkilahan)
  const nearSusp = topSuspensionEnd(suspensions)
  const nearMtop = topMtopExpiry(operations)

  const getDashboardExportSections = React.useCallback((): CsvExportSection[] => {
    return [
      {
        title: "Dashboard — summary",
        kind: "keyValues",
        pairs: [
          ["Exported at", formatExportDateTime()],
          ["Filter mode", dateFilterMode === "all" ? "All time" : "Month"],
          ...(dateFilterMode === "range"
            ? (() => {
                const r = ymdRangeForMonthYm(filterMonth)
                return r
                  ? ([
                      ["Month", filterMonth],
                      ["From", r.from],
                      ["To", r.to],
                    ] as [string, string][])
                  : ([["Month", filterMonth]] as [string, string][])
              })()
            : []),
        ],
      },
      {
        title: "Module counts",
        kind: "table",
        headers: ["Module", "Count"],
        rows: moduleRows.map((r) => [r.label, String(r.count)]),
      },
      {
        title: "Upcoming — Arkilahan due",
        kind: "table",
        headers: ["Name", "Body number", "Due date"],
        rows: nearArk.map((r) => [r.name, r.bodyNumber, r.dueDate]),
      },
      {
        title: "Upcoming — Suspension end",
        kind: "table",
        headers: ["Driver", "End date"],
        rows: nearSusp.map((r) => [r.driverName, r.endDate]),
      },
      {
        title: "Upcoming — MTOP registration",
        kind: "table",
        headers: ["Body number", "MTOP expiration"],
        rows: nearMtop.map((r) => [r.bodyNumber, r.mtopExpirationDate]),
      },
    ]
  }, [dateFilterMode, filterMonth, moduleRows, nearArk, nearSusp, nearMtop])

  const dashboardExportButton = (
    <PageDataExportButton
      fileBaseName="dashboard"
      moduleName="dashboard"
      disabled={loading && moduleRows.length === 0}
      getSections={getDashboardExportSections}
    />
  )

  if (loading && moduleRows.length === 0 && !loadError) {
    return (
      <DashboardLayout headerTrailing={dashboardExportButton}>
        <DashboardSkeleton />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout headerTrailing={dashboardExportButton}>
      <div className="flex flex-1 flex-col gap-6 p-4 lg:gap-8 lg:p-6">
      {loadError ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {loadError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Summary of activity across key areas and what&apos;s coming due.
            Pick a month for period totals, or view all-time totals.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="dash-date-mode">Range</Label>
            <SearchableSelect
              id="dash-date-mode"
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={dateFilterMode}
              onChange={(e) =>
                setDateFilterMode(e.target.value as "range" | "all")
              }
              searchable={false}
            >
              <option value="range">Date range</option>
              <option value="all">All time</option>
            </SearchableSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dash-month">Month</Label>
            <Input
              id="dash-month"
              type="month"
              min="1990-01"
              value={filterMonth}
              onChange={(e) => {
                setDateFilterMode("range")
                const v = e.target.value
                if (v && /^\d{4}-\d{2}$/.test(v)) setFilterMonth(v)
              }}
              disabled={dateFilterMode === "all"}
              className="w-auto min-w-[10rem]"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-end gap-2">
          {loading && moduleRows.length > 0 ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Updating…
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {moduleRows.map((row) => (
            <Card key={row.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{row.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{row.count}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold">Upcoming</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DueSummaryCard
            title="Nearest Arkilahan due"
            href="/arkilahan"
            subtitle="Next dues by date"
            rows={nearArk.map((r) => ({
              dateYmd: r.dueDate,
              primary: r.name,
              secondary: `# ${r.bodyNumber}`,
            }))}
            empty="No upcoming arkilahan dues."
          />

          <DueSummaryCard
            title="Nearest suspension end"
            href="/suspension"
            subtitle="Active suspensions only"
            rows={nearSusp.map((r) => ({
              dateYmd: r.endDate,
              primary: r.driverName,
              secondary: null,
            }))}
            empty="No upcoming suspension end dates."
          />

          <DueSummaryCard
            title="Nearest MTOP registration"
            href="/operations"
            subtitle="Next expirations by date"
            rows={nearMtop.map((r) => ({
              dateYmd: r.mtopExpirationDate,
              primary: `Body #${r.bodyNumber}`,
              secondary: null,
            }))}
            empty="No upcoming MTOP expirations."
          />
        </div>
      </div>
      </div>
    </DashboardLayout>
  )
}

function DueSummaryCard({
  title,
  href,
  subtitle,
  rows,
  empty,
}: {
  title: string
  href: string
  subtitle: string
  rows: Array<{
    dateYmd: string
    primary: string
    secondary?: string | null
  }>
  empty: string
}) {
  const has = rows.length > 0
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </div>
          <Link
            href={href}
            className="inline-flex items-center gap-0.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Open module
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {!has ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r, idx) => (
              <div
                key={`${r.dateYmd}-${r.primary}-${idx}`}
                className="rounded-md border bg-muted/30 p-2.5"
              >
                <p className="text-sm font-medium leading-snug">{r.primary}</p>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  {formatYmdShort(r.dateYmd)}
                </p>
                {r.secondary ? (
                  <p className="text-xs text-muted-foreground">{r.secondary}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
