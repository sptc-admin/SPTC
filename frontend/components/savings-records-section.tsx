"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Eye, Plus } from "lucide-react"

import { AddSavingsRecord } from "@/components/add-savings-record"
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
import { matchesMemberFilter } from "@/lib/member-filter"
import { fetchSavingsRecords } from "@/lib/savings-api"
import type { SavingsRecord } from "@/lib/savings-types"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatYmdDisplay(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function totalsByMember(records: SavingsRecord[]) {
  const map = new Map<
    string,
    {
      bodyNumber: string
      memberName: string
      total: number
      lastPaymentDate: string | null
      lastCreatedAt: string
    }
  >()
  for (const r of records) {
    const prev = map.get(r.memberId) ?? {
      bodyNumber: r.bodyNumber,
      memberName: r.memberName,
      total: 0,
      lastPaymentDate: null as string | null,
      lastCreatedAt: "",
    }
    prev.total += r.amount
    if (
      prev.lastPaymentDate === null ||
      r.date > prev.lastPaymentDate ||
      (r.date === prev.lastPaymentDate && r.createdAt > prev.lastCreatedAt)
    ) {
      prev.lastPaymentDate = r.date
      prev.lastCreatedAt = r.createdAt
    }
    map.set(r.memberId, prev)
  }
  return [...map.entries()]
    .map(([memberId, v]) => ({
      memberId,
      bodyNumber: v.bodyNumber,
      memberName: v.memberName,
      total: v.total,
      lastPaymentDate: v.lastPaymentDate,
    }))
    .sort((a, b) => a.bodyNumber.localeCompare(b.bodyNumber))
}

function memberEntries(records: SavingsRecord[], memberId: string) {
  return records
    .filter((r) => r.memberId === memberId)
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date)
      if (byDate !== 0) return byDate
      return b.createdAt.localeCompare(a.createdAt)
    })
}

type ViewMember = {
  memberId: string
  bodyNumber: string
  memberName: string
}

export type SavingsRecordsExportSnapshot = {
  records: SavingsRecord[]
  filterBody: string
  filterName: string
  loading: boolean
}

type SavingsRecordsSectionProps = {
  onExportSnapshot?: (snap: SavingsRecordsExportSnapshot) => void
}

export function SavingsRecordsSection({
  onExportSnapshot,
}: SavingsRecordsSectionProps) {
  const [records, setRecords] = React.useState<SavingsRecord[]>([])
  const [recordsLoading, setRecordsLoading] = React.useState(true)
  const [recordsError, setRecordsError] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [addKey, setAddKey] = React.useState(0)
  const [viewMember, setViewMember] = React.useState<ViewMember | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10
  const [filterBody, setFilterBody] = React.useState("")
  const [filterName, setFilterName] = React.useState("")

  const loadRecords = React.useCallback(() => {
    setRecordsLoading(true)
    setRecordsError(null)
    fetchSavingsRecords()
      .then(setRecords)
      .catch((e: unknown) => {
        setRecordsError(
          e instanceof Error ? e.message : "Could not load savings."
        )
      })
      .finally(() => setRecordsLoading(false))
  }, [])

  React.useEffect(() => {
    loadRecords()
  }, [loadRecords])

  React.useEffect(() => {
    onExportSnapshot?.({
      records,
      filterBody,
      filterName,
      loading: recordsLoading,
    })
  }, [records, filterBody, filterName, recordsLoading, onExportSnapshot])

  function openAddSavings() {
    setAddKey((k) => k + 1)
    setAddOpen(true)
  }

  function onSavingsSaved() {
    setAddOpen(false)
    loadRecords()
  }

  const memberTotals = React.useMemo(() => totalsByMember(records), [records])
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

  const viewTotal = React.useMemo(
    () => viewEntries.reduce((s, r) => s + r.amount, 0),
    [viewEntries]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Record savings by member, date, and amount. View each member&apos;s
          entry log from the table below.
        </p>
        <Button
          type="button"
          onClick={openAddSavings}
          className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
        >
          <Plus className="size-4" />
          Add savings
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Savings by member</h3>
        {recordsLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : recordsError ? (
          <p className="text-sm text-red-600">{recordsError}</p>
        ) : memberTotals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No savings records yet.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="grid w-full gap-1.5 sm:max-w-[140px]">
                <Label htmlFor="savings-filter-body">Body #</Label>
                <Input
                  id="savings-filter-body"
                  value={filterBody}
                  onChange={(e) => setFilterBody(e.target.value)}
                  placeholder="Filter…"
                  className="tabular-nums"
                />
              </div>
              <div className="grid w-full min-w-0 flex-1 gap-1.5 sm:max-w-xs">
                <Label htmlFor="savings-filter-name">Name</Label>
                <Input
                  id="savings-filter-name"
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
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Member</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Total savings
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Last payment
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTotals.map((row) => (
                  <tr key={row.memberId} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium tabular-nums">
                        {row.bodyNumber}
                      </span>
                      <span className="text-muted-foreground"> — </span>
                      <span>{row.memberName}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatCurrency(row.total)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.lastPaymentDate
                        ? formatYmdDisplay(row.lastPaymentDate)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
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
                    </td>
                  </tr>
                ))}
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
        <DialogContent className="max-h-[85vh] w-[min(100vw-1rem,560px)] max-w-none gap-4 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Savings entries</DialogTitle>
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
                <>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 text-right font-medium">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewEntries.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b last:border-0"
                          >
                            <td className="px-3 py-2 tabular-nums">
                              {formatYmdDisplay(r.date)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrency(r.amount)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 font-medium">
                          <td className="px-3 py-2">Total</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrency(viewTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md"
        >
          <SheetHeader className="pb-4">
            <SheetTitle>Add savings</SheetTitle>
          </SheetHeader>
          <AddSavingsRecord key={addKey} onSaved={onSavingsSaved} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
