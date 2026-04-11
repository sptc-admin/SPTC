"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  X,
} from "lucide-react"

import {
  createArkilahan,
  deleteArkilahan,
  fetchArkilahan,
  type ArkilahanCreatePayload,
  updateArkilahan,
} from "@/lib/arkilahan-api"
import type { Arkilahan, ArkilahanTermUnit } from "@/lib/arkilahan-types"
import { fetchMembers } from "@/lib/members-api"
import type { Member } from "@/lib/member-types"
import { useAppToast } from "@/components/app-toast-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { OperationDocumentUpload } from "@/components/operation-document-upload"

const SUFFIX_OPTIONS = ["", "Jr.", "Sr.", "II", "III", "IV"] as const

const selectClassName =
  "flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed"

export function ArkilahanListPage() {
  const { showToast } = useAppToast()
  const [entries, setEntries] = React.useState<Arkilahan[]>([])
  const [members, setMembers] = React.useState<Member[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [savePending, setSavePending] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Arkilahan | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)
  const [viewDocUrl, setViewDocUrl] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10
  const [filters, setFilters] = React.useState({
    dateFrom: "",
    dateTo: "",
    bodyNumber: "",
    name: "",
    fee: "",
    dueDateFrom: "",
    dueDateTo: "",
    terms: "",
  })

  const [date, setDate] = React.useState("")
  const [bodyNumber, setBodyNumber] = React.useState("")
  const [firstName, setFirstName] = React.useState("")
  const [middleInitial, setMiddleInitial] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [suffix, setSuffix] = React.useState("")
  const [fee, setFee] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [termValue, setTermValue] = React.useState("1")
  const [termUnit, setTermUnit] = React.useState<ArkilahanTermUnit>("months")
  const [documentUrl, setDocumentUrl] = React.useState("")
  const openDatePicker = React.useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      const input = e.currentTarget
      if (typeof input.showPicker === "function") {
        try {
          input.showPicker()
        } catch {
          // Ignore when browser rejects picker call.
        }
      }
    },
    []
  )

  const bodyNumbers = React.useMemo(
    () => Array.from(new Set(members.map((m) => m.bodyNumber).filter(Boolean))).sort(),
    [members]
  )
  const filteredEntries = React.useMemo(() => {
    return entries.filter((item) => {
      const feeText = item.fee.toString()
      const termsText = `${item.termValue} ${item.termUnit}`.toLowerCase()
      return (
        (!filters.dateFrom || item.date >= filters.dateFrom) &&
        (!filters.dateTo || item.date <= filters.dateTo) &&
        (!filters.bodyNumber ||
          item.bodyNumber.toLowerCase().includes(filters.bodyNumber.toLowerCase())) &&
        (!filters.name || item.name.toLowerCase().includes(filters.name.toLowerCase())) &&
        (!filters.fee || feeText.includes(filters.fee)) &&
        (!filters.dueDateFrom || item.dueDate >= filters.dueDateFrom) &&
        (!filters.dueDateTo || item.dueDate <= filters.dueDateTo) &&
        (!filters.terms || termsText.includes(filters.terms.toLowerCase()))
      )
    })
  }, [entries, filters])
  const hasActiveFilters = Object.values(filters).some((value) => value.trim().length > 0)
  const paginatedEntries = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredEntries.slice(start, start + itemsPerPage)
  }, [filteredEntries, currentPage])
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / itemsPerPage))

  React.useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([fetchArkilahan(), fetchMembers()])
      .then(([arkilahanData, membersData]) => {
        if (cancelled) return
        setEntries(arkilahanData)
        setMembers(membersData)
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Could not load Arkilahan."
        if (cancelled) return
        setError(msg)
        showToast(msg, "error")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [showToast])

  function resetForm() {
    setDate("")
    setBodyNumber("")
    setFirstName("")
    setMiddleInitial("")
    setLastName("")
    setSuffix("")
    setFee("")
    setDueDate("")
    setTermValue("1")
    setTermUnit("months")
    setDocumentUrl("")
  }

  function openCreate() {
    setEditingId(null)
    resetForm()
    setSheetOpen(true)
  }

  function openEdit(item: Arkilahan) {
    setEditingId(item.id)
    setDate(item.date)
    setBodyNumber(item.bodyNumber)
    const parsed = parseStoredName(item.name)
    setFirstName(parsed.firstName)
    setMiddleInitial(parsed.middleInitial)
    setLastName(parsed.lastName)
    setSuffix(parsed.suffix)
    setFee(item.fee.toString())
    setDueDate(item.dueDate)
    setTermValue(item.termValue.toString())
    setTermUnit(item.termUnit)
    setDocumentUrl(item.documentUrl ?? "")
    setSheetOpen(true)
  }

  function onBodyNumberChange(value: string) {
    setBodyNumber(value)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) return showToast("Date is required.", "error")
    if (!bodyNumber) return showToast("Body number is required.", "error")
    if (!firstName.trim() || !lastName.trim()) {
      return showToast("First name and last name are required.", "error")
    }
    if (!dueDate) return showToast("Due date is required.", "error")

    const parsedFee = Number(fee)
    if (!Number.isFinite(parsedFee) || parsedFee <= 0) {
      return showToast("Fee must be greater than 0.", "error")
    }

    const parsedTermValue = Number(termValue)
    if (!Number.isInteger(parsedTermValue) || parsedTermValue <= 0) {
      return showToast("Terms must be at least 1.", "error")
    }

    const fullName = [
      firstName.trim(),
      middleInitial.trim(),
      lastName.trim(),
      suffix.trim(),
    ]
      .filter(Boolean)
      .join(" ")

    const payload: ArkilahanCreatePayload = {
      date,
      bodyNumber,
      name: fullName,
      fee: parsedFee,
      dueDate,
      termValue: parsedTermValue,
      termUnit,
      documentUrl: documentUrl.trim() || undefined,
    }

    setSavePending(true)
    try {
      if (editingId) {
        const updated = await updateArkilahan(editingId, payload)
        setEntries((prev) => prev.map((i) => (i.id === editingId ? updated : i)))
        showToast("Arkilahan updated.", "success")
      } else {
        const created = await createArkilahan(payload)
        setEntries((prev) => [created, ...prev])
        showToast("Arkilahan saved.", "success")
      }
      setSheetOpen(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed."
      showToast(msg, "error")
    } finally {
      setSavePending(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeletePending(true)
    try {
      await deleteArkilahan(deleteTarget.id)
      setEntries((prev) => prev.filter((i) => i.id !== deleteTarget.id))
      setDeleteTarget(null)
      showToast("Arkilahan removed.", "success")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Delete failed."
      showToast(msg, "error")
    } finally {
      setDeletePending(false)
    }
  }

  function clearFilters() {
    setFilters({
      dateFrom: "",
      dateTo: "",
      bodyNumber: "",
      name: "",
      fee: "",
      dueDateFrom: "",
      dueDateTo: "",
      terms: "",
    })
    setCurrentPage(1)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Manage Arkila records with fee, due date, and terms.
        </p>
        <Button
          type="button"
          onClick={openCreate}
          className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
        >
          <Plus className="size-4" />
          Arkila
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arkilahan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="size-4" />
                <span>Filter Arkilahan</span>
              </div>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-2 text-xs"
                >
                  <X className="size-3" />
                  Clear all
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.7fr_0.9fr_0.7fr_1.4fr_0.7fr]">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Input
                    type="date"
                    placeholder="From"
                    value={filters.dateFrom}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                    }
                    onClick={openDatePicker}
                    className="text-sm"
                  />
                  <span className="text-xs text-muted-foreground">-</span>
                  <Input
                    type="date"
                    placeholder="To"
                    value={filters.dateTo}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
                    }
                    onClick={openDatePicker}
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Body #</Label>
                <Input
                  placeholder="Body #"
                  value={filters.bodyNumber}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, bodyNumber: e.target.value }))
                  }
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  placeholder="Name"
                  value={filters.name}
                  onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fee</Label>
                <Input
                  placeholder="Fee"
                  value={filters.fee}
                  onChange={(e) => setFilters((prev) => ({ ...prev, fee: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Due Date</Label>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Input
                    type="date"
                    placeholder="From"
                    value={filters.dueDateFrom}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, dueDateFrom: e.target.value }))
                    }
                    onClick={openDatePicker}
                    className="text-sm"
                  />
                  <span className="text-xs text-muted-foreground">-</span>
                  <Input
                    type="date"
                    placeholder="To"
                    value={filters.dueDateTo}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, dueDateTo: e.target.value }))
                    }
                    onClick={openDatePicker}
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Terms</Label>
                <Input
                  placeholder="Terms"
                  value={filters.terms}
                  onChange={(e) => setFilters((prev) => ({ ...prev, terms: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading arkilahan...
              </p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-red-600">{error}</p>
            ) : entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No arkilahan records yet.
              </p>
            ) : filteredEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No arkilahan records match your filters.
              </p>
            ) : (
              <>
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-3 font-medium">Date</th>
                    <th className="pb-3 pr-3 font-medium">Body #</th>
                    <th className="pb-3 pr-3 font-medium">Name</th>
                    <th className="pb-3 pr-3 font-medium">Fee</th>
                    <th className="pb-3 pr-3 font-medium">Due Date</th>
                    <th className="pb-3 pr-3 font-medium">Terms</th>
                    <th className="pb-3 pr-3 font-medium">Contract</th>
                    <th className="pb-3 pl-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEntries.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 pr-3">{item.date}</td>
                      <td className="py-3 pr-3 tabular-nums">{item.bodyNumber}</td>
                      <td className="py-3 pr-3">{item.name}</td>
                      <td className="py-3 pr-3 tabular-nums">
                        {item.fee.toLocaleString("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        })}
                      </td>
                      <td className="py-3 pr-3">{item.dueDate}</td>
                      <td className="py-3 pr-3">
                        {item.termValue} {item.termUnit}
                      </td>
                      <td className="py-3 pr-3">
                        {(item.documentUrl ?? "").trim() ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setViewDocUrl((item.documentUrl ?? "").trim())}
                          >
                            View contract
                          </Button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="flex justify-end gap-1">
                          {(item.documentUrl ?? "").trim() ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setViewDocUrl((item.documentUrl ?? "").trim())}
                              aria-label="View arkilahan contract"
                            >
                              <Eye className="size-4" />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(item)}
                            aria-label="Edit arkilahan"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(item)}
                            aria-label="Delete arkilahan"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex items-center justify-between">
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
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open && !editingId) resetForm()
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <ReceiptText className="size-5" />
              {editingId ? "Edit Arkila" : "Add Arkila"}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={onSubmit} className="grid gap-4 pb-8">
            <div className="space-y-2">
              <Label htmlFor="arkila-date">Date</Label>
              <Input
                id="arkila-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onClick={openDatePicker}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arkila-body-number">Body #</Label>
              <SearchableSelect
                id="arkila-body-number"
                className={selectClassName}
                value={bodyNumber}
                onChange={(e) => onBodyNumberChange(e.target.value)}
                required
              >
                <option value="">Select body #</option>
                {bodyNumbers.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </SearchableSelect>
            </div>

            <div>
              <Label>Name</Label>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="arkila-first-name">First Name</Label>
                  <Input
                    id="arkila-first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arkila-middle-initial">Middle Initial / Name</Label>
                  <Input
                    id="arkila-middle-initial"
                    value={middleInitial}
                    onChange={(e) => setMiddleInitial(e.target.value)}
                    placeholder="Middle name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arkila-last-name">Last Name</Label>
                  <Input
                    id="arkila-last-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arkila-suffix">Suffix (optional)</Label>
                  <SearchableSelect
                    id="arkila-suffix"
                    className={selectClassName}
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                  >
                    {SUFFIX_OPTIONS.map((value) => (
                      <option key={value || "none"} value={value}>
                        {value || "None"}
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Terms</Label>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <Input
                  id="arkila-term-value"
                  type="number"
                  min="1"
                  step="1"
                  value={termValue}
                  onChange={(e) => setTermValue(e.target.value)}
                  required
                />
                <SearchableSelect
                  id="arkila-term-unit"
                  className={selectClassName}
                  value={termUnit}
                  onChange={(e) => setTermUnit(e.target.value as ArkilahanTermUnit)}
                  required
                >
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </SearchableSelect>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="arkila-due-date">Due Date</Label>
              <Input
                id="arkila-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onClick={openDatePicker}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arkila-fee">Fee</Label>
              <Input
                id="arkila-fee"
                type="number"
                min="0.01"
                step="0.01"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2 rounded-md border bg-muted/30 px-3 py-3">
              <Label>Contract</Label>
              <div className="flex flex-wrap items-center gap-2">
                <OperationDocumentUpload
                  label="Upload contract"
                  onUploaded={(url) => {
                    setDocumentUrl(url)
                    showToast("Contract uploaded.", "success")
                  }}
                  onToastError={(msg) => showToast(msg, "error")}
                />
                {documentUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setViewDocUrl(documentUrl)}
                  >
                    <Eye className="size-4" />
                    View
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full bg-black text-white hover:bg-black/90"
                disabled={savePending}
              >
                {savePending ? "Saving..." : editingId ? "Update Arkila" : "Save Arkila"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete arkilahan entry?</DialogTitle>
            <DialogDescription>
              This action cannot be undone.
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
              onClick={confirmDelete}
              disabled={deletePending}
            >
              {deletePending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(viewDocUrl)}
        onOpenChange={(open) => {
          if (!open) setViewDocUrl("")
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Arkilahan contract</DialogTitle>
            <DialogDescription>Preview the uploaded contract.</DialogDescription>
          </DialogHeader>
          {viewDocUrl ? (
            <div className="mt-2">
              {viewDocUrl.toLowerCase().includes(".pdf") ? (
                <iframe
                  src={viewDocUrl}
                  className="h-[70vh] w-full rounded border"
                  title="Arkilahan contract"
                />
              ) : (
                <img
                  src={viewDocUrl}
                  alt="Arkilahan contract"
                  className="max-h-[70vh] w-full rounded border object-contain"
                />
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function parseStoredName(value: string): {
  firstName: string
  middleInitial: string
  lastName: string
  suffix: string
} {
  const knownSuffixes = new Set(["JR.", "SR.", "II", "III", "IV"])
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return { firstName: "", middleInitial: "", lastName: "", suffix: "" }
  }

  let suffix = ""
  const lastToken = parts[parts.length - 1].toUpperCase()
  if (knownSuffixes.has(lastToken)) {
    suffix = parts.pop() ?? ""
  }

  if (parts.length === 1) {
    return { firstName: parts[0], middleInitial: "", lastName: "", suffix }
  }

  const firstName = parts[0] ?? ""
  const lastName = parts[parts.length - 1] ?? ""
  const middleRaw = parts.slice(1, -1).join(" ")
  const middleInitial = middleRaw ? middleRaw.charAt(0).toUpperCase() : ""

  return { firstName, middleInitial, lastName, suffix }
}
