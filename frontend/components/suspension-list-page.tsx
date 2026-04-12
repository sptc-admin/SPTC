"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  FileUp,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react"

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
import {
  PageDataExportButton,
  type CsvExportSection,
} from "@/components/page-data-export"
import {
  formatExportDateTime,
  formatExportDateTimeFromIso,
} from "@/lib/csv-export"
import {
  parseSuspensionImportRows,
  type SuspensionImportDriverRef,
  type SuspensionImportRowError,
} from "@/lib/suspension-import"
import { createAuditLogEvent } from "@/lib/audit-logs-api"
import { formatAuthActorLabel } from "@/lib/auth-actor"
import { SiteHeader } from "@/components/site-header"
import { formatPhMobileDisplay, normalizeBodyNumber } from "@/lib/member-utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { Driver } from "@/lib/driver-types"
import { fetchDrivers } from "@/lib/drivers-api"
import {
  createSuspension,
  deleteSuspension,
  fetchSuspensions,
  type SuspensionCreatePayload,
  updateSuspension,
} from "@/lib/suspensions-api"
import type { Suspension, SuspensionStatus } from "@/lib/suspension-types"

const selectClassName =
  "flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed"

function displayDriverName(driver: Driver): string {
  return [
    driver.fullName.first,
    driver.fullName.middle,
    driver.fullName.last,
    driver.fullName.suffix,
  ]
    .filter(Boolean)
    .join(" ")
    .trim()
}

function suspensionStatusLabel(status: SuspensionStatus): string {
  return status === "active" ? "Suspended" : "Cleared"
}

export function SuspensionListPage() {
  const { showToast } = useAppToast()
  const [suspensions, setSuspensions] = React.useState<Suspension[]>([])
  const [drivers, setDrivers] = React.useState<Driver[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [savePending, setSavePending] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Suspension | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10

  const [driverId, setDriverId] = React.useState("")
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [status, setStatus] = React.useState<SuspensionStatus>("active")
  const [filters, setFilters] = React.useState({
    driver: "",
    bodyNumber: "",
    startFrom: "",
    startTo: "",
    endFrom: "",
    endTo: "",
    status: "",
  })

  const suspensionImportInputRef = React.useRef<HTMLInputElement>(null)
  const [suspensionImportBusy, setSuspensionImportBusy] = React.useState(false)
  const [suspensionImportReportOpen, setSuspensionImportReportOpen] =
    React.useState(false)
  const [suspensionImportReport, setSuspensionImportReport] = React.useState<{
    created: number
    parseErrors: SuspensionImportRowError[]
    apiFailures: { excelRow: number; message: string }[]
  } | null>(null)

  const driverRefByBodyNormLower = React.useMemo(() => {
    const m = new Map<string, SuspensionImportDriverRef>()
    for (const d of drivers) {
      const k = normalizeBodyNumber(d.bodyNumber).toLowerCase()
      if (!m.has(k)) {
        m.set(k, {
          id: d.id,
          bodyNumber: d.bodyNumber,
          driverName: displayDriverName(d),
        })
      }
    }
    return m
  }, [drivers])

  const filteredSuspensions = React.useMemo(() => {
    return suspensions.filter((item) => {
      return (
        (!filters.driver ||
          item.driverName.toLowerCase().includes(filters.driver.toLowerCase())) &&
        (!filters.bodyNumber ||
          item.bodyNumber.toLowerCase().includes(filters.bodyNumber.toLowerCase())) &&
        (!filters.startFrom || item.startDate >= filters.startFrom) &&
        (!filters.startTo || item.startDate <= filters.startTo) &&
        (!filters.endFrom || item.endDate >= filters.endFrom) &&
        (!filters.endTo || item.endDate <= filters.endTo) &&
        (!filters.status || item.status === filters.status)
      )
    })
  }, [suspensions, filters])
  const hasActiveFilters = Object.values(filters).some((v) => v.trim().length > 0)

  const getSuspensionExportSections = React.useCallback((): CsvExportSection[] => {
    const filterParts: string[] = []
    if (filters.driver.trim())
      filterParts.push(`Driver contains "${filters.driver.trim()}"`)
    if (filters.bodyNumber.trim())
      filterParts.push(`Body # contains "${filters.bodyNumber.trim()}"`)
    if (filters.startFrom.trim())
      filterParts.push(`Start date from ${filters.startFrom}`)
    if (filters.startTo.trim())
      filterParts.push(`Start date to ${filters.startTo}`)
    if (filters.endFrom.trim())
      filterParts.push(`End date from ${filters.endFrom}`)
    if (filters.endTo.trim())
      filterParts.push(`End date to ${filters.endTo}`)
    if (filters.status.trim())
      filterParts.push(
        filters.status === "active"
          ? "Status: Suspended"
          : "Status: Cleared"
      )

    const headers = [
      "Driver name",
      "Body #",
      "Start date",
      "End date",
      "Status",
      "Driver mobile (PH)",
      "Created at",
      "Updated at",
    ]

    const rows = filteredSuspensions.map((item) => {
      const drv = drivers.find((d) => d.id === item.driverId)
      return [
        item.driverName,
        item.bodyNumber,
        formatExportDateTimeFromIso(item.startDate),
        formatExportDateTimeFromIso(item.endDate),
        suspensionStatusLabel(item.status),
        drv ? formatPhMobileDisplay(drv.contactMobile10) : "",
        formatExportDateTimeFromIso(item.createdAt),
        formatExportDateTimeFromIso(item.updatedAt),
      ]
    })

    return [
      {
        title: "Suspensions — export summary",
        kind: "keyValues",
        pairs: [
          ["Exported at", formatExportDateTime()],
          ["Row count", String(filteredSuspensions.length)],
          [
            "Filters",
            filterParts.length ? filterParts.join("; ") : "None (all records)",
          ],
        ],
      },
      {
        title: "Suspension records",
        kind: "table",
        headers,
        rows,
      },
    ]
  }, [filteredSuspensions, filters, drivers])

  const paginatedSuspensions = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredSuspensions.slice(start, start + itemsPerPage)
  }, [filteredSuspensions, currentPage])
  const totalPages = Math.max(
    1,
    Math.ceil(filteredSuspensions.length / itemsPerPage)
  )

  React.useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchSuspensions(), fetchDrivers()])
      .then(([suspensionsData, driversData]) => {
        if (cancelled) return
        setSuspensions(suspensionsData)
        setDrivers(driversData)
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Could not load suspensions."
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
    setDriverId("")
    setStartDate("")
    setEndDate("")
    setStatus("active")
  }

  function openCreate() {
    setEditingId(null)
    resetForm()
    setSheetOpen(true)
  }

  function openEdit(item: Suspension) {
    setEditingId(item.id)
    setDriverId(item.driverId)
    setStartDate(item.startDate)
    setEndDate(item.endDate)
    setStatus(item.status)
    setSheetOpen(true)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const selectedDriver = drivers.find((d) => d.id === driverId)
    if (!selectedDriver) {
      showToast("Please select a driver.", "error")
      return
    }
    if (!startDate || !endDate) {
      showToast("Start and end dates are required.", "error")
      return
    }
    if (endDate < startDate) {
      showToast("End date cannot be earlier than start date.", "error")
      return
    }

    const payload: SuspensionCreatePayload = {
      driverId: selectedDriver.id,
      bodyNumber: selectedDriver.bodyNumber,
      driverName: displayDriverName(selectedDriver),
      startDate,
      endDate,
      status,
    }

    setSavePending(true)
    try {
      if (editingId) {
        const updated = await updateSuspension(editingId, payload)
        setSuspensions((prev) =>
          prev.map((item) => (item.id === editingId ? updated : item))
        )
        showToast("Suspension updated.", "success")
      } else {
        const created = await createSuspension(payload)
        setSuspensions((prev) => [created, ...prev])
        showToast("Suspension saved.", "success")
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
      await deleteSuspension(deleteTarget.id)
      setSuspensions((prev) => prev.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
      showToast("Suspension removed.", "success")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Delete failed."
      showToast(msg, "error")
    } finally {
      setDeletePending(false)
    }
  }

  function clearFilters() {
    setFilters({
      driver: "",
      bodyNumber: "",
      startFrom: "",
      startTo: "",
      endFrom: "",
      endTo: "",
      status: "",
    })
    setCurrentPage(1)
  }

  async function onSuspensionImportFileSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setSuspensionImportBusy(true)
    const apiFailures: { excelRow: number; message: string }[] = []
    let created = 0
    const newRows: Suspension[] = []
    try {
      const buf = await file.arrayBuffer()
      const { items, errors: parseErrors } = parseSuspensionImportRows(buf, {
        driverRefByBodyNormLower,
      })
      if (!items.length && parseErrors.length) {
        setSuspensionImportReport({ created: 0, parseErrors, apiFailures: [] })
        setSuspensionImportReportOpen(true)
        showToast(parseErrors[0]?.message ?? "Import could not read the file.", "error")
        void createAuditLogEvent({
          module: "suspensions",
          action: "import",
          message: `${formatAuthActorLabel()} attempted suspensions Excel import; file validation failed.`,
          method: "IMPORT",
          path: "/suspensions/import",
        }).catch(() => {})
        return
      }
      for (const { excelRow, payload } of items) {
        try {
          const row = await createSuspension(payload)
          newRows.push(row)
          created++
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Request failed"
          apiFailures.push({ excelRow, message: msg })
        }
      }
      if (newRows.length) {
        setSuspensions((prev) => [...newRows, ...prev])
      }
      setSuspensionImportReport({ created, parseErrors, apiFailures })
      if (parseErrors.length || apiFailures.length) {
        setSuspensionImportReportOpen(true)
      }
      void createAuditLogEvent({
        module: "suspensions",
        action: "import",
        message: `${formatAuthActorLabel()} imported ${created} suspension(s) from Excel (${parseErrors.length} row(s) skipped in file, ${apiFailures.length} API error(s)).`,
        method: "IMPORT",
        path: "/suspensions/import",
      }).catch(() => {})
      if (!apiFailures.length && !parseErrors.length) {
        showToast(`Imported ${created} record(s).`, "success")
      } else {
        showToast(
          `Imported ${created} record(s). Some rows need review — see report.`,
          "success"
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed."
      showToast(msg, "error")
    } finally {
      setSuspensionImportBusy(false)
    }
  }

  const suspensionHeaderActions = (
    <>
      <input
        ref={suspensionImportInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="sr-only"
        aria-label="Select file to import suspensions"
        onChange={onSuspensionImportFileSelected}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={loading || suspensionImportBusy}
        onClick={() => suspensionImportInputRef.current?.click()}
      >
        <FileUp className="size-4" />
        {suspensionImportBusy ? "Importing…" : "Import"}
      </Button>
      <PageDataExportButton
        fileBaseName="suspensions"
        moduleName="suspensions"
        disabled={loading || filteredSuspensions.length === 0}
        getSections={getSuspensionExportSections}
      />
    </>
  )

  return (
    <>
      <SiteHeader trailing={suspensionHeaderActions} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Suspend drivers with suspended/cleared status and full history log.
        </p>
        <Button
          type="button"
          onClick={openCreate}
          className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
        >
          <Plus className="size-4" />
          Add suspension
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suspension History Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="size-4" />
                <span>Filter Suspensions</span>
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
            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_0.7fr_1.4fr_1.4fr_0.7fr]">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Driver</Label>
                <Input
                  placeholder="Driver"
                  value={filters.driver}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, driver: e.target.value }))
                  }
                  className="text-sm"
                />
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
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Input
                    type="date"
                    value={filters.startFrom}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, startFrom: e.target.value }))
                    }
                    className="text-sm"
                  />
                  <span className="text-xs text-muted-foreground">-</span>
                  <Input
                    type="date"
                    value={filters.startTo}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, startTo: e.target.value }))
                    }
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Input
                    type="date"
                    value={filters.endFrom}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, endFrom: e.target.value }))
                    }
                    className="text-sm"
                  />
                  <span className="text-xs text-muted-foreground">-</span>
                  <Input
                    type="date"
                    value={filters.endTo}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, endTo: e.target.value }))
                    }
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <SearchableSelect
                  className={selectClassName}
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, status: e.target.value }))
                  }
                >
                  <option value="">All</option>
                  <option value="active">Suspended</option>
                  <option value="cleared">Cleared</option>
                </SearchableSelect>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading suspensions...
              </p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-red-600">{error}</p>
            ) : suspensions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No suspension history yet.
              </p>
            ) : filteredSuspensions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No suspensions match your filters.
              </p>
            ) : (
              <>
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-3 font-medium">Driver</th>
                    <th className="pb-3 pr-3 font-medium">Body #</th>
                    <th className="pb-3 pr-3 font-medium">Start Date</th>
                    <th className="pb-3 pr-3 font-medium">End Date</th>
                    <th className="pb-3 pr-3 font-medium">Status</th>
                    <th className="pb-3 pl-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSuspensions.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 pr-3">{item.driverName}</td>
                      <td className="py-3 pr-3 tabular-nums">{item.bodyNumber}</td>
                      <td className="py-3 pr-3">{item.startDate}</td>
                      <td className="py-3 pr-3">{item.endDate}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            item.status === "active"
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {item.status === "active" ? "Suspended" : "Cleared"}
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(item)}
                            aria-label="Edit suspension"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(item)}
                            aria-label="Delete suspension"
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
              <ShieldAlert className="size-5" />
              {editingId ? "Edit suspension" : "Add suspension"}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={onSubmit} className="grid gap-4 pb-8">
            <div className="space-y-2">
              <Label htmlFor="suspension-driver">Driver</Label>
              <SearchableSelect
                id="suspension-driver"
                className={selectClassName}
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                required
              >
                <option value="">Select driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.bodyNumber} - {displayDriverName(driver)}
                  </option>
                ))}
              </SearchableSelect>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="suspension-start-date">Start Date</Label>
                <Input
                  id="suspension-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suspension-end-date">End Date</Label>
                <Input
                  id="suspension-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="suspension-status">Status</Label>
              <SearchableSelect
                id="suspension-status"
                className={selectClassName}
                value={status}
                onChange={(e) => setStatus(e.target.value as SuspensionStatus)}
                required
              >
                <option value="active">Suspended</option>
                <option value="cleared">Cleared</option>
              </SearchableSelect>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full bg-black text-white hover:bg-black/90"
                disabled={savePending}
              >
                {savePending
                  ? "Saving..."
                  : editingId
                    ? "Update suspension"
                    : "Save suspension"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog
        open={suspensionImportReportOpen}
        onOpenChange={(open) => {
          setSuspensionImportReportOpen(open)
          if (!open) setSuspensionImportReport(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Excel import report</DialogTitle>
            <DialogDescription>
              {suspensionImportReport
                ? `${suspensionImportReport.created} record(s) saved to the database.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {suspensionImportReport ? (
            <div className="space-y-4 text-sm">
              {suspensionImportReport.parseErrors.length ? (
                <div>
                  <p className="font-medium text-destructive">Skipped in file</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {suspensionImportReport.parseErrors.map((e, i) => (
                      <li key={`s-parse-${i}`}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {suspensionImportReport.apiFailures.length ? (
                <div>
                  <p className="font-medium text-destructive">Server errors</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {suspensionImportReport.apiFailures.map((e, i) => (
                      <li key={`s-api-${i}`}>
                        Row {e.excelRow}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!suspensionImportReport.parseErrors.length &&
              !suspensionImportReport.apiFailures.length ? (
                <p className="text-muted-foreground">No issues reported.</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setSuspensionImportReportOpen(false)}
            >
              Close
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete suspension record?</DialogTitle>
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
      </div>
    </>
  )
}
