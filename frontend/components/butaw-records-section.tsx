"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Eye, Plus, Wallet } from "lucide-react"

import { AddButawRecord } from "@/components/add-butaw-record"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { fetchButawRecords } from "@/lib/butaw-api"
import { fetchMembers } from "@/lib/members-api"
import { matchesMemberFilter } from "@/lib/member-filter"
import type { Member } from "@/lib/member-types"
import {
  formatButawMonthRange,
  recordEndYm,
} from "@/lib/butaw-month"
import type { ButawRecord } from "@/lib/butaw-types"
import { butawSplit } from "@/lib/butaw-split"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value)
}

function totalsByMember(records: ButawRecord[]) {
  const map = new Map<
    string,
    {
      bodyNumber: string
      memberName: string
      totalPaid: number
      lastRangeStart: string | null
      lastRangeEnd: string | null
      lastCreatedAt: string
    }
  >()
  for (const r of records) {
    const prev = map.get(r.memberId) ?? {
      bodyNumber: r.bodyNumber,
      memberName: r.memberName,
      totalPaid: 0,
      lastRangeStart: null as string | null,
      lastRangeEnd: null as string | null,
      lastCreatedAt: "",
    }
    prev.totalPaid += r.amount
    const end = recordEndYm(r)
    if (
      prev.lastRangeEnd === null ||
      end.localeCompare(prev.lastRangeEnd) > 0 ||
      (end === prev.lastRangeEnd && r.createdAt > prev.lastCreatedAt)
    ) {
      prev.lastRangeStart = r.month
      prev.lastRangeEnd = r.monthEnd ?? r.month
      prev.lastCreatedAt = r.createdAt
    }
    map.set(r.memberId, prev)
  }
  return [...map.entries()]
    .map(([memberId, v]) => ({
      memberId,
      bodyNumber: v.bodyNumber,
      memberName: v.memberName,
      totalPaid: v.totalPaid,
      lastPaymentLabel:
        v.lastRangeStart && v.lastRangeEnd
          ? formatButawMonthRange(v.lastRangeStart, v.lastRangeEnd)
          : null,
    }))
    .sort((a, b) => a.bodyNumber.localeCompare(b.bodyNumber))
}

function cleanBodyNumber(bodyNumber: string): string {
  return bodyNumber.replace(/,/g, "").trim()
}

function memberDisplayName(m: Member): string {
  const parts = [
    m.fullName.first,
    m.fullName.middle,
    m.fullName.last,
    m.fullName.suffix,
  ]
    .map((s) => s.replace(/,/g, "").trim())
    .filter(Boolean)
  return parts.join(" ") || "—"
}

type ButawMemberRow = {
  memberId: string
  bodyNumber: string
  memberName: string
  totalPaid: number
  lastPaymentLabel: string | null
  carriedShareCapital: number
}

function mergeButawRowsWithMembers(
  records: ButawRecord[],
  members: Member[]
): ButawMemberRow[] {
  const fromRec = totalsByMember(records)
  const memberById = new Map(members.map((m) => [m.id, m]))
  const byId = new Map<string, ButawMemberRow>()

  for (const row of fromRec) {
    const m = memberById.get(row.memberId)
    const carried =
      typeof m?.financials?.shareCapital === "number" &&
      !Number.isNaN(m.financials.shareCapital)
        ? m.financials.shareCapital
        : 0
    byId.set(row.memberId, {
      memberId: row.memberId,
      bodyNumber: m ? cleanBodyNumber(m.bodyNumber) : row.bodyNumber,
      memberName: m ? memberDisplayName(m) : row.memberName,
      totalPaid: row.totalPaid,
      lastPaymentLabel: row.lastPaymentLabel,
      carriedShareCapital: carried,
    })
  }

  for (const m of members) {
    if (byId.has(m.id)) continue
    const carried = m.financials?.shareCapital ?? 0
    if (carried === 0) continue
    byId.set(m.id, {
      memberId: m.id,
      bodyNumber: cleanBodyNumber(m.bodyNumber),
      memberName: memberDisplayName(m),
      totalPaid: 0,
      lastPaymentLabel: null,
      carriedShareCapital: carried,
    })
  }

  return [...byId.values()].sort((a, b) =>
    a.bodyNumber.localeCompare(b.bodyNumber)
  )
}

function memberEntries(records: ButawRecord[], memberId: string) {
  return records
    .filter((r) => r.memberId === memberId)
    .sort((a, b) => {
      const endA = recordEndYm(a)
      const endB = recordEndYm(b)
      const byEnd = endB.localeCompare(endA)
      if (byEnd !== 0) return byEnd
      return b.createdAt.localeCompare(a.createdAt)
    })
}

type ViewMember = {
  memberId: string
  bodyNumber: string
  memberName: string
}

export function ButawRecordsSection() {
  const [records, setRecords] = React.useState<ButawRecord[]>([])
  const [members, setMembers] = React.useState<Member[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [addKey, setAddKey] = React.useState(0)
  const [addPrefillMember, setAddPrefillMember] =
    React.useState<ViewMember | null>(null)
  const [viewMember, setViewMember] = React.useState<ViewMember | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10
  const [filterBody, setFilterBody] = React.useState("")
  const [filterName, setFilterName] = React.useState("")

  const loadRecords = React.useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([fetchButawRecords(), fetchMembers()])
      .then(([recs, mems]) => {
        setRecords(recs)
        setMembers(mems)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Could not load butaw.")
      })
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    loadRecords()
  }, [loadRecords])

  function openAdd(forMember: ViewMember | null) {
    setAddPrefillMember(forMember)
    setAddKey((k) => k + 1)
    setAddOpen(true)
  }

  function onButawSaved() {
    setAddOpen(false)
    setAddPrefillMember(null)
    loadRecords()
  }

  const memberTotals = React.useMemo(
    () => mergeButawRowsWithMembers(records, members),
    [records, members]
  )
  const filteredMemberTotals = React.useMemo(
    () =>
      memberTotals.filter((row) =>
        matchesMemberFilter(row.bodyNumber, row.memberName, filterBody, filterName)
      ),
    [memberTotals, filterBody, filterName]
  )
  const paginatedTotals = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredMemberTotals.slice(start, start + itemsPerPage)
  }, [filteredMemberTotals, currentPage])
  const totalPages = Math.max(
    1,
    Math.ceil(filteredMemberTotals.length / itemsPerPage)
  )

  React.useEffect(() => {
    setCurrentPage(1)
  }, [filterBody, filterName])

  React.useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  const viewEntries = React.useMemo(() => {
    if (!viewMember) return []
    return memberEntries(records, viewMember.memberId)
  }, [records, viewMember])

  const viewTotalPaid = React.useMemo(
    () => viewEntries.reduce((s, r) => s + r.amount, 0),
    [viewEntries]
  )

  const viewTotalsSplit = React.useMemo(
    () => butawSplit(viewTotalPaid),
    [viewTotalPaid]
  )

  const viewCarriedShareCapital = React.useMemo(() => {
    if (!viewMember) return 0
    const m = members.find((x) => x.id === viewMember.memberId)
    const sc = m?.financials?.shareCapital
    return typeof sc === "number" && !Number.isNaN(sc) ? sc : 0
  }, [viewMember, members])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Record butaw by member and covered months. Totals below combine
          payments with any carried share capital; use View for the entry log.
        </p>
        <Button
          type="button"
          onClick={() => openAdd(null)}
          className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
        >
          <Plus className="size-4" />
          Add butaw
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Butaw by member</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : memberTotals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No butaw activity yet. Use Add butaw above to record a payment.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="grid w-full gap-1.5 sm:max-w-[140px]">
                <Label htmlFor="butaw-filter-body">Body #</Label>
                <Input
                  id="butaw-filter-body"
                  value={filterBody}
                  onChange={(e) => setFilterBody(e.target.value)}
                  placeholder="Filter…"
                  className="tabular-nums"
                />
              </div>
              <div className="grid w-full min-w-0 flex-1 gap-1.5 sm:max-w-xs">
                <Label htmlFor="butaw-filter-name">Name</Label>
                <Input
                  id="butaw-filter-name"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="Filter…"
                />
              </div>
            </div>
            {filteredMemberTotals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No members match your filters.
              </p>
            ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1040px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Member</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Share capital
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Monthly dues
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Member benefits
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Last payment
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTotals.map((row) => {
                  const s = butawSplit(row.totalPaid)
                  const shareDisplay = s.shareCapital + row.carriedShareCapital
                  return (
                    <tr key={row.memberId} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <span className="font-medium tabular-nums">
                          {row.bodyNumber}
                        </span>
                        <span className="text-muted-foreground"> — </span>
                        <span>{row.memberName}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(shareDisplay)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(s.monthlyDues)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(s.memberBenefits)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.lastPaymentLabel ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1 bg-black text-white hover:bg-black/90"
                            title="Record payment"
                            onClick={() =>
                              openAdd({
                                memberId: row.memberId,
                                bodyNumber: row.bodyNumber,
                                memberName: row.memberName,
                              })
                            }
                          >
                            <Wallet className="size-4" />
                            Payment
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() =>
                              setViewMember({
                                memberId: row.memberId,
                                bodyNumber: row.bodyNumber,
                                memberName: row.memberName,
                              })
                            }
                          >
                            <Eye className="size-4" />
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="p-3 pt-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="size-4" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages}
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
            )}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(viewMember)}
        onOpenChange={(open) => {
          if (!open) setViewMember(null)
        }}
      >
        <DialogContent className="max-h-[85vh] w-[min(100vw-1rem,720px)] max-w-none gap-4 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Butaw entries</DialogTitle>
            {viewMember ? (
              <DialogDescription asChild>
                <span className="text-foreground">
                  <span className="font-medium tabular-nums">
                    {viewMember.bodyNumber}
                  </span>
                  <span className="text-muted-foreground"> — </span>
                  <span>{viewMember.memberName}</span>
                </span>
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {viewMember ? (
            <div className="space-y-4">
              {viewEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[680px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Period</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Amount
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Share cap.
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Dues
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Benefits
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewEntries.map((r) => {
                        const sp = butawSplit(r.amount)
                        const isAdv = Boolean(r.isAdvance)
                        return (
                          <tr key={r.id} className="border-b last:border-0">
                            <td className="px-3 py-2 tabular-nums">
                              {formatButawMonthRange(
                                r.month,
                                r.monthEnd ?? r.month
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isAdv ? (
                                <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950">
                                  Advance
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Regular
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrency(r.amount)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrency(sp.shareCapital)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrency(sp.monthlyDues)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrency(sp.memberBenefits)}
                            </td>
                          </tr>
                        )
                      })}
                      <tr className="border-t-2 font-medium">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(viewTotalPaid)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(
                            viewTotalsSplit.shareCapital +
                              viewCarriedShareCapital
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(viewTotalsSplit.monthlyDues)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(viewTotalsSplit.memberBenefits)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Sheet
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) setAddPrefillMember(null)
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md"
        >
          <SheetHeader className="pb-4">
            <SheetTitle>Payment</SheetTitle>
          </SheetHeader>
          <AddButawRecord
            key={`${addKey}-${addPrefillMember?.memberId ?? "open"}`}
            prefillMember={addPrefillMember}
            allRecords={records}
            onSaved={onButawSaved}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
