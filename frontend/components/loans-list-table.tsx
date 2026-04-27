"use client"

import * as React from "react"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react"

import { useAppToast } from "@/components/app-toast-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { cn } from "@/lib/utils"
import {
  currentMonthBucket,
  EMERGENCY_REFERENCE_MONTHS,
  emergencyDueDateYmd,
  emergencyInterest,
  emergencyOutstandingBalance,
  emergencyTotalPayment,
} from "@/lib/emergency-loan"
import {
  DIMINISHING_SCHEDULE_FACTOR,
  computeEffectiveSchedule,
  type EffectiveScheduleRow,
} from "@/lib/loan-schedule"
import { normalizeStoredProcessingFeeRate } from "@/lib/loan-processing-fee"
import { deleteLoan, fetchLoans, updateLoan } from "@/lib/loans-api"
import type { Loan, LoanScheduleRow, LoanPaymentRecord } from "@/lib/loan-types"
import { matchesMemberFilter } from "@/lib/member-filter"

function todayYmdLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

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

function dueLabelLong(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function scheduleTotals(rows: LoanScheduleRow[]) {
  return rows.reduce(
    (acc, row) => ({
      interest: acc.interest + row.interest,
      principal: acc.principal + row.principal,
      total: acc.total + row.total,
      processingFee: acc.processingFee + row.processingFee,
      payment: acc.payment + row.payment,
    }),
    { interest: 0, principal: 0, total: 0, processingFee: 0, payment: 0 }
  )
}

function formatPercentValue(value: number): string {
  return `${value.toFixed(2)}%`
}

function processingFeeTotal(loan: Loan): number {
  const r = normalizeStoredProcessingFeeRate(loan.processingFeeRate)
  return loan.amountOfLoan * (r / 100)
}

function loanTypeLabel(loan: Loan): string {
  const t = loan.loanType || "regular"
  return t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, " ")
}

function termLabel(loan: Loan): string {
  if (loan.loanType === "emergency") return "—"
  const unit = loan.termUnit === "years" ? "year(s)" : "month(s)"
  return `${loan.termValue} ${unit}`
}

function maturityDisplay(loan: Loan): string {
  if (loan.loanType === "emergency") return "—"
  return formatYmdDisplay(loan.maturityDate)
}

/** Amount due now for emergency (interest + principal), or regular outstanding balance. */
function outstandingBalance(loan: Loan): number {
  if (loan.loanType === "emergency") {
    return emergencyOutstandingBalance(loan)
  }
  const schedule = loan.schedule ?? []
  if (schedule.length === 0) {
    return loan.amountOfLoan
  }
  const effective = computeEffectiveSchedule(
    schedule,
    loan.payments,
    loan.interestRate,
    loan.amountOfLoan
  )
  const paid = new Set(loan.paidDueDates ?? [])
  const ordered = [...effective].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate)
  )
  let i = 0
  while (i < ordered.length && paid.has(ordered[i].dueDate)) {
    i += 1
  }
  if (i >= ordered.length) {
    return 0
  }
  if (i === 0) {
    return loan.amountOfLoan
  }
  return ordered[i - 1].balance
}

function nextPaymentDisplay(loan: Loan): string {
  const schedule = loan.schedule ?? []
  if (schedule.length === 0) return "—"
  const paid = new Set(loan.paidDueDates ?? [])
  const next = schedule
    .filter((row) => !paid.has(row.dueDate))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  if (!next) return "Paid"
  return formatYmdDisplay(next.dueDate)
}

function paidOnOrNextDueCell(loan: Loan): string {
  if (loan.loanType === "emergency") {
    if (!loan.emergencySettled) return "-"
    const ymd =
      loan.emergencyPaidOn?.trim() ||
      (loan.updatedAt && loan.updatedAt.length >= 10
        ? loan.updatedAt.slice(0, 10)
        : "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "-"
    return formatYmdDisplay(ymd)
  }
  return nextPaymentDisplay(loan)
}

function emergencyAmountPaidColumn(loan: Loan): string {
  if (loan.loanType !== "emergency" || !loan.emergencySettled) return "-"
  if (
    loan.emergencyAmountPaid != null &&
    Number.isFinite(loan.emergencyAmountPaid)
  ) {
    return formatCurrency(loan.emergencyAmountPaid)
  }
  return "-"
}

function isLoanPaidInFull(loan: Loan): boolean {
  if (loan.loanType === "emergency") return Boolean(loan.emergencySettled)
  return outstandingBalance(loan) <= 0
}

export function LoansListTable({
  refreshKey,
  loanType = "regular",
  initialViewLoanId = null,
  onLoanUpdated,
}: {
  refreshKey: number
  loanType?: "regular" | "emergency" | "all"
  initialViewLoanId?: string | null
  onLoanUpdated?: () => void
}) {
  const { showToast } = useAppToast()
  const [loans, setLoans] = React.useState<Loan[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [viewLoan, setViewLoan] = React.useState<Loan | null>(null)
  const [togglingDueDate, setTogglingDueDate] = React.useState<string | null>(
    null
  )
  const [emergencySettlingId, setEmergencySettlingId] = React.useState<
    string | null
  >(null)
  const [emergencyPayDateLoan, setEmergencyPayDateLoan] =
    React.useState<Loan | null>(null)
  const [emergencyPayDate, setEmergencyPayDate] = React.useState("")
  const [emergencyPayAmount, setEmergencyPayAmount] = React.useState("")
  const [fullPaymentConfirmOpen, setFullPaymentConfirmOpen] =
    React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Loan | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [bulkDeletePending, setBulkDeletePending] = React.useState(false)
  const [paymentDialogRow, setPaymentDialogRow] =
    React.useState<EffectiveScheduleRow | null>(null)
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [paymentSaving, setPaymentSaving] = React.useState(false)
  const selectAllPageRef = React.useRef<HTMLInputElement>(null)
  const openedInitialLoanIdRef = React.useRef<string | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10
  const [filterBody, setFilterBody] = React.useState("")
  const [filterName, setFilterName] = React.useState("")
  const [filterTerms, setFilterTerms] = React.useState("")
  const [filterTermUnit, setFilterTermUnit] = React.useState<
    "all" | "months" | "years"
  >("all")
  const [filterPaid, setFilterPaid] = React.useState<
    "all" | "paid" | "unpaid"
  >("all")

  React.useEffect(() => {
    setFilterBody("")
    setFilterName("")
    setFilterTerms("")
    setFilterTermUnit("all")
    setFilterPaid("all")
    setCurrentPage(1)
    setSelectedIds([])
  }, [loanType])

  React.useEffect(() => {
    const valid = new Set(loans.map((l) => l.id))
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)))
  }, [loans])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchLoans()
      .then((list) => {
        if (cancelled) return
        const filtered =
          loanType === "all"
            ? list
            : list.filter((l) => l.loanType === loanType)
        setLoans(filtered)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Could not load loans.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, loanType])

  React.useEffect(() => {
    if (!initialViewLoanId) return
    if (openedInitialLoanIdRef.current === initialViewLoanId) return
    const target = loans.find((loan) => loan.id === initialViewLoanId)
    if (!target) return
    setViewLoan(target)
    openedInitialLoanIdRef.current = initialViewLoanId
  }, [initialViewLoanId, loans])

  React.useEffect(() => {
    if (!viewLoan) setFullPaymentConfirmOpen(false)
  }, [viewLoan])

  const effectiveSchedule = React.useMemo(() => {
    if (!viewLoan || viewLoan.loanType === "emergency") return []
    return computeEffectiveSchedule(
      viewLoan.schedule ?? [],
      viewLoan.payments,
      viewLoan.interestRate,
      viewLoan.amountOfLoan
    )
  }, [viewLoan])

  const viewTotals = React.useMemo(() => {
    if (!viewLoan) return null
    if (effectiveSchedule.length > 0) {
      return effectiveSchedule.reduce(
        (acc, row) => ({
          interest: acc.interest + row.interest,
          principal: acc.principal + row.principal,
          total: acc.total + row.total,
          processingFee: acc.processingFee + row.processingFee,
          payment: acc.payment + row.payment,
        }),
        { interest: 0, principal: 0, total: 0, processingFee: 0, payment: 0 }
      )
    }
    return scheduleTotals(viewLoan.schedule ?? [])
  }, [viewLoan, effectiveSchedule])

  function openPaymentDialog(row: EffectiveScheduleRow) {
    setPaymentDialogRow(row)
    setPaymentAmount(row.payment.toString())
  }

  async function toggleMonthPaid(dueDate: string) {
    if (!viewLoan) return
    const isPaid = (viewLoan.paidDueDates ?? []).includes(dueDate)
    if (isPaid) {
      setTogglingDueDate(dueDate)
      try {
        const nextPaid = (viewLoan.paidDueDates ?? []).filter((d) => d !== dueDate)
        const nextPayments = (viewLoan.payments ?? []).filter(
          (p) => p.dueDate !== dueDate
        )
        const updated = await updateLoan(viewLoan.id, {
          paidDueDates: nextPaid,
          payments: nextPayments,
        })
        setViewLoan(updated)
        setLoans((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
        onLoanUpdated?.()
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Could not update payment status."
        showToast(msg, "error")
      } finally {
        setTogglingDueDate(null)
      }
    } else {
      const row = effectiveSchedule.find((r) => r.dueDate === dueDate)
      if (row) openPaymentDialog(row)
    }
  }

  async function submitPayment() {
    if (!viewLoan || !paymentDialogRow) return
    const amount = parseFloat(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid payment amount.", "error")
      return
    }
    setPaymentSaving(true)
    try {
      const dueDate = paymentDialogRow.dueDate
      const existingPayments = viewLoan.payments ?? []
      const newPayments: LoanPaymentRecord[] = [
        ...existingPayments.filter((p) => p.dueDate !== dueDate),
        { dueDate, amount: Math.round(amount) },
      ].sort((a, b) => a.dueDate.localeCompare(b.dueDate))

      const existingPaid = viewLoan.paidDueDates ?? []
      const newPaid = existingPaid.includes(dueDate)
        ? existingPaid
        : [...existingPaid, dueDate].sort()

      const updated = await updateLoan(viewLoan.id, {
        paidDueDates: newPaid,
        payments: newPayments,
      })
      setViewLoan(updated)
      setLoans((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
      onLoanUpdated?.()
      setPaymentDialogRow(null)
      showToast("Payment recorded.", "success")
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Could not record payment."
      showToast(msg, "error")
    } finally {
      setPaymentSaving(false)
    }
  }

  async function markAllMonthsPaid(): Promise<boolean> {
    if (!viewLoan || viewLoan.loanType === "emergency") return false
    const allDueDates = Array.from(
      new Set((viewLoan.schedule ?? []).map((row) => row.dueDate))
    ).sort()
    if (allDueDates.length === 0) return false
    setTogglingDueDate("__all__")
    try {
      const updated = await updateLoan(viewLoan.id, { paidDueDates: allDueDates })
      setViewLoan(updated)
      onLoanUpdated?.()
      return true
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Could not update payment status."
      showToast(msg, "error")
      return false
    } finally {
      setTogglingDueDate(null)
    }
  }

  async function confirmFullPayment() {
    const ok = await markAllMonthsPaid()
    if (ok) setFullPaymentConfirmOpen(false)
  }

  async function setEmergencySettled(loan: Loan, settled: boolean) {
    if (loan.loanType !== "emergency") return
    setEmergencySettlingId(loan.id)
    try {
      const updated = await updateLoan(loan.id, { emergencySettled: settled })
      setLoans((prev) =>
        prev.map((l) => (l.id === updated.id ? updated : l))
      )
      setViewLoan((v) => (v?.id === updated.id ? updated : v))
      onLoanUpdated?.()
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Could not update settlement status."
      showToast(msg, "error")
    } finally {
      setEmergencySettlingId(null)
    }
  }

  function openEmergencyPayDateDialog(loan: Loan) {
    setEmergencyPayDateLoan(loan)
    setEmergencyPayDate(todayYmdLocal())
    const n = currentMonthBucket(loan.dateReleased)
    const total = emergencyTotalPayment(loan.amountOfLoan, n)
    setEmergencyPayAmount(
      Number.isFinite(total) ? total.toFixed(2) : ""
    )
  }

  async function confirmEmergencyPaid() {
    const loan = emergencyPayDateLoan
    if (!loan || loan.loanType !== "emergency") return
    const ymd = emergencyPayDate.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      showToast("Choose a valid payment date.", "error")
      return
    }
    const amountNum = Number(String(emergencyPayAmount).replace(/,/g, ""))
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      showToast("Enter a valid amount paid.", "error")
      return
    }
    setEmergencySettlingId(loan.id)
    try {
      const updated = await updateLoan(loan.id, {
        emergencySettled: true,
        emergencyPaidOn: ymd,
        emergencyAmountPaid: amountNum,
      })
      setLoans((prev) =>
        prev.map((l) => (l.id === updated.id ? updated : l))
      )
      setViewLoan((v) => (v?.id === updated.id ? updated : v))
      setEmergencyPayDateLoan(null)
      onLoanUpdated?.()
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Could not update settlement status."
      showToast(msg, "error")
    } finally {
      setEmergencySettlingId(null)
    }
  }

  async function confirmDeleteLoan() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeletePending(true)
    try {
      await deleteLoan(id)
      setLoans((prev) => prev.filter((l) => l.id !== id))
      setViewLoan((v) => (v?.id === id ? null : v))
      setEmergencyPayDateLoan((v) => (v?.id === id ? null : v))
      setSelectedIds((prev) => prev.filter((x) => x !== id))
      showToast("Loan deleted.", "success")
      setDeleteTarget(null)
      onLoanUpdated?.()
    } catch (e: unknown) {
      showToast(
        e instanceof Error ? e.message : "Could not delete loan.",
        "error"
      )
    } finally {
      setDeletePending(false)
    }
  }

  function toggleLoanSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function confirmBulkDeleteLoans() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkDeletePending(true)
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteLoan(id)))
      const okIds = ids.filter((_, i) => results[i].status === "fulfilled")
      const failCount = results.filter((r) => r.status === "rejected").length
      setLoans((prev) => prev.filter((l) => !okIds.includes(l.id)))
      setViewLoan((v) => (v && okIds.includes(v.id) ? null : v))
      setEmergencyPayDateLoan((v) => (v && okIds.includes(v.id) ? null : v))
      setSelectedIds((prev) => prev.filter((id) => !okIds.includes(id)))
      if (failCount === 0) {
        showToast(`Deleted ${okIds.length} loan(s).`, "success")
      } else if (okIds.length > 0) {
        showToast(
          `Deleted ${okIds.length}; ${failCount} could not be deleted.`,
          "error"
        )
      } else {
        showToast("Could not delete selected loans.", "error")
      }
      setBulkDeleteOpen(false)
      onLoanUpdated?.()
    } finally {
      setBulkDeletePending(false)
    }
  }

  const showTermMaturity = loanType !== "emergency"
  const showAmountPaidColumn = loanType === "emergency"
  const dueColumnLabel = loanType === "emergency" ? "Paid on" : "Next due"
  const filteredLoans = React.useMemo(
    () =>
      loans.filter((l) => {
        if (
          !matchesMemberFilter(l.bodyNumber, l.memberName, filterBody, filterName)
        ) {
          return false
        }
        const paid = isLoanPaidInFull(l)
        if (filterPaid === "paid" && !paid) return false
        if (filterPaid === "unpaid" && paid) return false
        if (!showTermMaturity) return true
        if (filterTermUnit !== "all") {
          if (l.loanType === "emergency") return false
          if (l.termUnit !== filterTermUnit) return false
        }
        const termsFilter = filterTerms.trim().toLowerCase()
        if (!termsFilter) return true
        return termLabel(l).toLowerCase().includes(termsFilter)
      }),
    [
      loans,
      filterBody,
      filterName,
      filterTerms,
      filterTermUnit,
      filterPaid,
      showTermMaturity,
    ]
  )
  const paginatedLoans = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredLoans.slice(start, start + itemsPerPage)
  }, [filteredLoans, currentPage])
  const totalPages = Math.max(
    1,
    Math.ceil(filteredLoans.length / itemsPerPage)
  )

  React.useEffect(() => {
    setCurrentPage(1)
  }, [filterBody, filterName, filterTerms, filterTermUnit, filterPaid])

  React.useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  const pageIds = React.useMemo(
    () => paginatedLoans.map((l) => l.id),
    [paginatedLoans]
  )
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))
  const somePageSelected =
    pageIds.some((id) => selectedIds.includes(id)) && !allPageSelected

  React.useEffect(() => {
    const el = selectAllPageRef.current
    if (el) {
      el.indeterminate = somePageSelected
      if (allPageSelected) el.indeterminate = false
    }
  }, [somePageSelected, allPageSelected])

  function toggleSelectAllOnPage() {
    if (pageIds.length === 0) return
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])])
    }
  }

  return (
    <div className="overflow-x-auto">
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Loading loans...
        </p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">{error}</p>
      ) : loans.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {loanType === "emergency"
            ? "No emergency loans yet."
            : "No loans yet. Add a regular loan to get started."}
        </p>
      ) : (
        <>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4 sm:gap-y-3">
          <div className="grid w-full shrink-0 gap-1.5 sm:w-[8.75rem]">
            <Label htmlFor="loan-filter-body">Body #</Label>
            <Input
              id="loan-filter-body"
              value={filterBody}
              onChange={(e) => setFilterBody(e.target.value)}
              placeholder="Filter…"
              className="tabular-nums"
            />
          </div>
          <div className="grid w-full min-w-0 gap-1.5 sm:min-w-[10rem] sm:max-w-xs sm:flex-1 sm:basis-0">
            <Label htmlFor="loan-filter-name">Name</Label>
            <Input
              id="loan-filter-name"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Filter…"
            />
          </div>
          <div className="grid w-full shrink-0 gap-1.5 sm:w-[11rem]">
            <Label htmlFor="loan-filter-paid">Paid</Label>
            <SearchableSelect
              id="loan-filter-paid"
              className="h-9 w-full min-w-0 truncate rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={filterPaid}
              onChange={(e) =>
                setFilterPaid(e.target.value as "all" | "paid" | "unpaid")
              }
              searchable={false}
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </SearchableSelect>
          </div>
          {showTermMaturity ? (
            <>
              <div className="grid w-full shrink-0 gap-1.5 sm:w-[11.25rem]">
                <Label htmlFor="loan-filter-terms">Terms</Label>
                <Input
                  id="loan-filter-terms"
                  value={filterTerms}
                  onChange={(e) => setFilterTerms(e.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
              <div className="grid w-full shrink-0 gap-1.5 sm:w-[8.75rem]">
                <Label htmlFor="loan-filter-term-unit">Unit</Label>
                <SearchableSelect
                  id="loan-filter-term-unit"
                  className="h-9 w-full min-w-0 truncate rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={filterTermUnit}
                  onChange={(e) =>
                    setFilterTermUnit(
                      e.target.value as "all" | "months" | "years"
                    )
                  }
                  searchable={false}
                >
                  <option value="all">All</option>
                  <option value="months">Month(s)</option>
                  <option value="years">Year(s)</option>
                </SearchableSelect>
              </div>
            </>
          ) : null}
        </div>
        {selectedIds.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-input bg-muted/40 px-3 py-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {selectedIds.length}
              </span>{" "}
              selected
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={bulkDeletePending || deletePending}
              onClick={() => setBulkDeleteOpen(true)}
            >
              Delete selected
            </Button>
          </div>
        ) : null}
        {filteredLoans.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No loans match your filters.
          </p>
        ) : (
          <>
        <table
          className={`w-full border-collapse text-sm ${showTermMaturity ? "min-w-[980px]" : showAmountPaidColumn ? "min-w-[880px]" : "min-w-[780px]"}`}
        >
          <thead>
            <tr className="border-b bg-muted/50 text-left text-muted-foreground">
              <th className="w-10 pb-3 pr-2 pl-1">
                <input
                  ref={selectAllPageRef}
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAllOnPage}
                  disabled={bulkDeletePending || deletePending}
                  className="size-4 cursor-pointer rounded border border-input accent-foreground"
                  aria-label="Select all loans on this page"
                />
              </th>
              <th className="pb-3 pr-3 font-medium">Member</th>
              <th className="pb-3 pr-3 font-medium">Loan balance</th>
              {showTermMaturity ? (
                <th className="pb-3 pr-3 font-medium">Terms</th>
              ) : null}
              <th className="pb-3 pr-3 font-medium">Date released</th>
              {showTermMaturity ? (
                <th className="pb-3 pr-3 font-medium">Maturity</th>
              ) : null}
              <th className="pb-3 pr-3 font-medium">{dueColumnLabel}</th>
              {showAmountPaidColumn ? (
                <th className="pb-3 pr-3 font-medium">Amount paid</th>
              ) : null}
              <th className="pb-3 pl-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLoans.map((loan) => {
              const rowPaid = isLoanPaidInFull(loan)
              const cellGreen =
                "bg-green-50 text-green-950 dark:bg-green-950/30 dark:text-green-100"
              return (
              <tr key={loan.id} className="border-b last:border-0">
                <td
                  className={cn(
                    "w-10 py-3 pr-2 pl-1 align-middle",
                    rowPaid && cellGreen
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(loan.id)}
                    onChange={() => toggleLoanSelected(loan.id)}
                    disabled={bulkDeletePending || deletePending}
                    className="size-4 cursor-pointer rounded border border-input accent-foreground"
                    aria-label={`Select loan for ${loan.memberName}`}
                  />
                </td>
                <td className={cn("py-3 pr-3", rowPaid && cellGreen)}>
                  <span className="font-medium tabular-nums">{loan.bodyNumber}</span>
                  <span className="text-muted-foreground"> — </span>
                  <span>{loan.memberName}</span>
                </td>
                <td
                  className={cn(
                    "py-3 pr-3 tabular-nums",
                    rowPaid && cellGreen
                  )}
                >
                  {formatCurrency(outstandingBalance(loan))}
                </td>
                {showTermMaturity ? (
                  <td className={cn("py-3 pr-3", rowPaid && cellGreen)}>
                    {termLabel(loan)}
                  </td>
                ) : null}
                <td
                  className={cn(
                    "py-3 pr-3 tabular-nums",
                    rowPaid && cellGreen
                  )}
                >
                  {formatYmdDisplay(loan.dateReleased)}
                </td>
                {showTermMaturity ? (
                  <td
                    className={cn(
                      "py-3 pr-3 tabular-nums",
                      rowPaid && cellGreen
                    )}
                  >
                    {maturityDisplay(loan)}
                  </td>
                ) : null}
                <td
                  className={cn(
                    "py-3 pr-3 tabular-nums",
                    rowPaid && cellGreen
                  )}
                >
                  {paidOnOrNextDueCell(loan)}
                </td>
                {showAmountPaidColumn ? (
                  <td
                    className={cn(
                      "py-3 pr-3 tabular-nums",
                      rowPaid && cellGreen
                    )}
                  >
                    {emergencyAmountPaidColumn(loan)}
                  </td>
                ) : null}
                <td className={cn("py-3 pl-3 text-right", rowPaid && cellGreen)}>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setViewLoan(loan)}
                    >
                      <Eye className="size-4" />
                      View
                    </Button>
                    {loan.loanType === "emergency" ? (
                      <Button
                        type="button"
                        variant={loan.emergencySettled ? "outline" : "default"}
                        size="sm"
                        className={
                          loan.emergencySettled
                            ? "gap-1 border-green-600 text-green-800 hover:bg-green-50"
                            : "gap-1 bg-black text-white hover:bg-black/90"
                        }
                        disabled={emergencySettlingId === loan.id}
                        onClick={() =>
                          loan.emergencySettled
                            ? setEmergencySettled(loan, false)
                            : openEmergencyPayDateDialog(loan)
                        }
                      >
                        {emergencySettlingId === loan.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : loan.emergencySettled ? (
                          <>
                            <CheckCircle2 className="size-4" />
                            Paid
                          </>
                        ) : (
                          "Mark paid"
                        )}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={deletePending || bulkDeletePending}
                      onClick={() => setDeleteTarget(loan)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-between">
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
          </>
        )}
        </>
      )}

      <Dialog
        open={Boolean(viewLoan)}
        onOpenChange={(open) => {
          if (!open) setViewLoan(null)
        }}
      >
        <DialogContent className="grid max-h-[90vh] w-[min(100vw-1rem,1280px)] max-w-none gap-4 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
          <DialogHeader>
            <DialogTitle>
              {viewLoan?.loanType === "emergency"
                ? "Emergency loan"
                : "Payment schedule"}
            </DialogTitle>
            <DialogDescription>
              {viewLoan ? (
                <>
                  <span className="font-medium tabular-nums text-foreground">
                    {viewLoan.bodyNumber}
                  </span>
                  <span className="text-muted-foreground"> — </span>
                  <span className="text-foreground">{viewLoan.memberName}</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {viewLoan ? (
            <div className="space-y-4">
              {viewLoan.loanType === "emergency" ? (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="mb-3 text-sm font-semibold">
                    Emergency loan details
                  </h3>
                  <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground">Amount</dt>
                      <dd className="font-medium tabular-nums">
                        {formatCurrency(viewLoan.amountOfLoan)}
                      </dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground">Date released</dt>
                      <dd className="font-medium tabular-nums">
                        {formatYmdDisplay(viewLoan.dateReleased)}
                      </dd>
                    </div>
                    <div className="space-y-0.5 sm:col-span-2">
                      <dt className="text-muted-foreground">Reason</dt>
                      <dd className="font-medium">{viewLoan.reason ?? "—"}</dd>
                    </div>
                    {!viewLoan.emergencySettled ? (
                      <>
                        <div className="space-y-0.5">
                          <dt className="text-muted-foreground">
                            Total payment due
                          </dt>
                          <dd className="font-medium tabular-nums">
                            {formatCurrency(
                              emergencyTotalPayment(
                                viewLoan.amountOfLoan,
                                currentMonthBucket(viewLoan.dateReleased)
                              )
                            )}
                          </dd>
                        </div>
                        <div className="space-y-0.5">
                          <dt className="text-muted-foreground">Pay by</dt>
                          <dd className="font-medium tabular-nums">
                            {formatYmdDisplay(
                              emergencyDueDateYmd(
                                viewLoan.dateReleased,
                                currentMonthBucket(viewLoan.dateReleased)
                              )
                            )}
                          </dd>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-0.5">
                          <dt className="text-muted-foreground">Paid on</dt>
                          <dd className="font-medium tabular-nums">
                            {viewLoan.emergencyPaidOn
                              ? formatYmdDisplay(viewLoan.emergencyPaidOn)
                              : "—"}
                          </dd>
                        </div>
                        <div className="space-y-0.5">
                          <dt className="text-muted-foreground">Amount paid</dt>
                          <dd className="font-medium tabular-nums">
                            {viewLoan.emergencyAmountPaid != null &&
                            Number.isFinite(viewLoan.emergencyAmountPaid)
                              ? formatCurrency(viewLoan.emergencyAmountPaid)
                              : "—"}
                          </dd>
                        </div>
                        <div className="space-y-0.5 sm:col-span-2">
                          <dt className="text-muted-foreground">Status</dt>
                          <dd className="font-medium text-green-800">
                            Paid in full
                          </dd>
                        </div>
                      </>
                    )}
                  </dl>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="mb-3 text-sm font-semibold">Loan details</h3>
                  <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground">Loan type</dt>
                      <dd className="font-medium">{loanTypeLabel(viewLoan)}</dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground">Amount of loan</dt>
                      <dd className="font-medium tabular-nums">
                        {formatCurrency(viewLoan.amountOfLoan)}
                      </dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground">Interest (monthly)</dt>
                      <dd className="font-medium tabular-nums">
                        {formatPercentValue(viewLoan.interestRate)} diminishing
                      </dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground">Schedule factor</dt>
                      <dd className="font-medium tabular-nums">
                        {formatPercentValue(DIMINISHING_SCHEDULE_FACTOR * 100)} on
                        principal (fixed monthly total)
                      </dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground">Processing fee</dt>
                      <dd className="font-medium tabular-nums">
                        {formatPercentValue(
                          normalizeStoredProcessingFeeRate(
                            viewLoan.processingFeeRate,
                          ),
                        )}{" "}
                        (
                        {formatCurrency(processingFeeTotal(viewLoan))} total)
                      </dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground">Capital build-up (2%)</dt>
                      <dd className="font-medium tabular-nums">
                        {formatCurrency(viewLoan.capitalBuildUpAmount)}
                      </dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground">Insurance</dt>
                      <dd className="font-medium tabular-nums">
                        {formatCurrency(viewLoan.insuranceAmount)}
                      </dd>
                    </div>
                    <div className="space-y-0.5 sm:col-span-2 lg:col-span-3">
                      <dt className="text-muted-foreground">Amount released</dt>
                      <dd className="font-medium tabular-nums">
                        {formatCurrency(viewLoan.amountRelease)}
                      </dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground">Date released</dt>
                      <dd className="font-medium tabular-nums">
                        {formatYmdDisplay(viewLoan.dateReleased)}
                      </dd>
                    </div>
                    {viewLoan.reason ? (
                      <div className="space-y-0.5 sm:col-span-2 lg:col-span-3">
                        <dt className="text-muted-foreground">Reason</dt>
                        <dd className="font-medium">{viewLoan.reason}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              )}

              {(viewLoan.schedule?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Monthly payment schedule</h3>
                    {viewLoan.loanType !== "emergency" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-black text-white hover:bg-black/90"
                        disabled={
                          togglingDueDate != null ||
                          (viewLoan.schedule ?? []).every((row) =>
                            (viewLoan.paidDueDates ?? []).includes(row.dueDate)
                          )
                        }
                        onClick={() => setFullPaymentConfirmOpen(true)}
                      >
                        Full payment
                      </Button>
                    ) : null}
                  </div>
                  <div className="min-w-0 overflow-x-auto rounded-md border lg:overflow-x-visible">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-2 font-medium">Due Date/Month</th>
                    <th className="px-3 py-2 font-medium">Interest</th>
                    <th className="px-3 py-2 font-medium">Principal</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Balance</th>
                    <th className="px-3 py-2 font-medium">Processing Fee</th>
                    <th className="px-3 py-2 font-medium">Payment</th>
                    <th className="px-3 py-2 text-right font-medium">Pay month</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">Start</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2 font-medium tabular-nums">
                      {formatCurrency(viewLoan.amountOfLoan)}
                    </td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2 text-right">—</td>
                  </tr>
                  {effectiveSchedule.map((row, index) => {
                    const paid = (viewLoan.paidDueDates ?? []).includes(
                      row.dueDate
                    )
                    const busy = togglingDueDate === row.dueDate
                    const hasOverpay = row.extraPrincipal > 0
                    return (
                    <tr
                      key={`${row.dueDate}-${index}`}
                      className={`border-b last:border-0 ${paid ? "bg-green-50/60" : ""}`}
                    >
                      <td className="px-3 py-2">{dueLabelLong(row.dueDate)}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(row.interest)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(row.principal)}
                        {hasOverpay && (
                          <span className="ml-1 text-xs text-green-700">
                            (+{formatCurrency(row.extraPrincipal)})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(row.total)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(row.balance)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(row.processingFee)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(row.payment)}
                        {row.actualPayment !== null && row.actualPayment !== row.payment && (
                          <span className="ml-1 text-xs text-blue-700">
                            (actual: {formatCurrency(row.actualPayment)})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant={paid ? "outline" : "default"}
                          size="sm"
                          className={
                            paid
                              ? "gap-1 border-green-600 text-green-800 hover:bg-green-50"
                              : "gap-1 bg-black text-white hover:bg-black/90"
                          }
                          disabled={busy}
                          onClick={() => toggleMonthPaid(row.dueDate)}
                        >
                          {busy ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : paid ? (
                            <>
                              <CheckCircle2 className="size-4" />
                              Paid
                            </>
                          ) : (
                            "Mark paid"
                          )}
                        </Button>
                      </td>
                    </tr>
                    )
                  })}
                  {viewTotals ? (
                    <tr className="border-t-2 font-medium">
                      <td className="px-3 py-2">Totals</td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(viewTotals.interest)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(viewTotals.principal)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(viewTotals.total)}
                      </td>
                      <td className="px-3 py-2">—</td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(viewTotals.processingFee)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(viewTotals.payment)}
                      </td>
                      <td className="px-3 py-2 text-right">—</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
                  </div>
                </div>
              ) : viewLoan.loanType === "emergency" ? (
                viewLoan.emergencySettled ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    No further payments — this loan was marked paid in full.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Reference</h3>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full min-w-[360px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50 text-left">
                            <th className="px-3 py-2 font-medium">Month</th>
                            <th className="px-3 py-2 font-medium">Interest</th>
                            <th className="px-3 py-2 font-medium">
                              Total payment
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(
                            { length: EMERGENCY_REFERENCE_MONTHS },
                            (_, i) => i + 1
                          ).map(
                            (n) => (
                              <tr key={n} className="border-b last:border-0">
                                <td className="px-3 py-2 tabular-nums">{n}</td>
                                <td className="px-3 py-2 tabular-nums">
                                  {formatCurrency(
                                    emergencyInterest(
                                      viewLoan.amountOfLoan,
                                      n
                                    )
                                  )}
                                </td>
                                <td className="px-3 py-2 tabular-nums">
                                  {formatCurrency(
                                    emergencyTotalPayment(
                                      viewLoan.amountOfLoan,
                                      n
                                    )
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No payment schedule stored for this loan.
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={fullPaymentConfirmOpen}
        onOpenChange={setFullPaymentConfirmOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark full payment?</DialogTitle>
            <DialogDescription>
              This will mark every month in the schedule as paid for this loan.
              You can still change individual months afterward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={togglingDueDate === "__all__"}
              onClick={() => setFullPaymentConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-black text-white hover:bg-black/90"
              disabled={togglingDueDate === "__all__"}
              onClick={confirmFullPayment}
            >
              {togglingDueDate === "__all__" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(emergencyPayDateLoan)}
        onOpenChange={(open) => {
          if (!open) setEmergencyPayDateLoan(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Enter the date and amount paid for this loan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="emergency-pay-date">Payment date</Label>
              <Input
                id="emergency-pay-date"
                type="date"
                value={emergencyPayDate}
                onChange={(e) => setEmergencyPayDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emergency-pay-amount">Amount paid</Label>
              <Input
                id="emergency-pay-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={emergencyPayAmount}
                onChange={(e) => setEmergencyPayAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmergencyPayDateLoan(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-black text-white hover:bg-black/90"
              disabled={
                emergencyPayDateLoan
                  ? emergencySettlingId === emergencyPayDateLoan.id
                  : false
              }
              onClick={confirmEmergencyPaid}
            >
              {emergencyPayDateLoan &&
              emergencySettlingId === emergencyPayDateLoan.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this loan?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  <span className="font-medium tabular-nums text-foreground">
                    {deleteTarget.bodyNumber}
                  </span>
                  <span className="text-muted-foreground"> — </span>
                  <span className="text-foreground">{deleteTarget.memberName}</span>
                  <span className="mt-2 block">
                    {deleteTarget.loanType === "emergency"
                      ? "Emergency loan"
                      : "Regular loan"}
                    . This cannot be undone.
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deletePending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending}
              onClick={() => void confirmDeleteLoan()}
            >
              {deletePending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open) setBulkDeleteOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete selected loans?</DialogTitle>
            <DialogDescription>
              Permanently delete{" "}
              <span className="font-medium text-foreground">
                {selectedIds.length}
              </span>{" "}
              loan
              {selectedIds.length === 1 ? "" : "s"}. This cannot be undone.
            </DialogDescription>
            {selectedIds.length > 0 ? (
              <ul className="max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-sm text-muted-foreground">
                {loans
                  .filter((l) => selectedIds.includes(l.id))
                  .slice(0, 8)
                  .map((l) => (
                    <li key={l.id}>
                      <span className="tabular-nums text-foreground">
                        {l.bodyNumber}
                      </span>
                      <span> — </span>
                      {l.memberName}
                    </li>
                  ))}
                {selectedIds.length > 8 ? (
                  <li className="list-none">…and {selectedIds.length - 8} more</li>
                ) : null}
              </ul>
            ) : null}
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={bulkDeletePending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={bulkDeletePending || selectedIds.length === 0}
              onClick={() => void confirmBulkDeleteLoans()}
            >
              {bulkDeletePending ? "Deleting..." : "Delete all selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(paymentDialogRow)}
        onOpenChange={(open) => {
          if (!open) setPaymentDialogRow(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {paymentDialogRow ? (
                <>
                  Due date:{" "}
                  <span className="font-medium text-foreground">
                    {dueLabelLong(paymentDialogRow.dueDate)}
                  </span>
                  <br />
                  Scheduled payment:{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(paymentDialogRow.payment)}
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Payment Amount</Label>
            <Input
              id="payment-amount"
              type="number"
              min="0"
              step="1"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Enter payment amount"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentDialogRow(null)}
              disabled={paymentSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={paymentSaving}
              onClick={() => void submitPayment()}
            >
              {paymentSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save Payment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
