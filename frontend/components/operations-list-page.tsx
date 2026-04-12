"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileUp,
  History,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from "lucide-react"

import { useAppToast } from "@/components/app-toast-provider"
import { OperationDocumentUpload } from "@/components/operation-document-upload"
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
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { fetchMembers } from "@/lib/members-api"
import {
  createOperation,
  deleteOperation,
  fetchOperations,
  type OperationCreatePayload,
  updateOperation,
} from "@/lib/operations-api"
import type { Operation } from "@/lib/operation-types"
import {
  PageDataExportButton,
  type CsvExportSection,
} from "@/components/page-data-export"
import {
  formatExportDateTime,
  formatExportDateTimeFromIso,
} from "@/lib/csv-export"
import {
  downloadOperationImportTemplate,
  parseOperationImportRows,
  type OperationImportRowError,
} from "@/lib/operation-import"
import { createAuditLogEvent } from "@/lib/audit-logs-api"
import { formatAuthActorLabel } from "@/lib/auth-actor"
import { normalizeBodyNumber } from "@/lib/member-utils"
import { SiteHeader } from "@/components/site-header"

function formatReplacedMonthYear(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" })
}

const selectClassName =
  "flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed"

function todayYmdLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function isBeforeTodayYmd(ymd: string): boolean {
  if (!isValidYmd(ymd)) return true
  return ymd < todayYmdLocal()
}

function registrationIsActive(item: Operation): boolean {
  return !isBeforeTodayYmd(item.mtopExpirationDate)
}

function documentUrlForExport(url: string | undefined): string {
  const u = (url ?? "").trim()
  if (!u) return ""
  if (u.startsWith("data:")) return "[embedded]"
  return u
}

function OperationDocumentPreview({ url }: { url: string }) {
  const [useIframe, setUseIframe] = React.useState(false)

  React.useEffect(() => {
    setUseIframe(false)
  }, [url])

  if (useIframe) {
    return (
      <iframe
        src={url}
        title="Document"
        className="h-[70vh] w-full"
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Document"
      className="h-auto w-full"
      onError={() => setUseIframe(true)}
    />
  )
}

export function OperationsListPage() {
  const { showToast } = useAppToast()
  const [operations, setOperations] = React.useState<Operation[]>([])
  const [bodyNumbers, setBodyNumbers] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [savePending, setSavePending] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Operation | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)
  const [viewDocUrl, setViewDocUrl] = React.useState<string | null>(null)
  const [historyFor, setHistoryFor] = React.useState<Operation | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10
  const [filterBody, setFilterBody] = React.useState("")
  const [filterRegStatus, setFilterRegStatus] = React.useState<
    "all" | "active" | "expired"
  >("all")

  const operationImportInputRef = React.useRef<HTMLInputElement>(null)
  const [operationImportBusy, setOperationImportBusy] = React.useState(false)
  const [operationImportReportOpen, setOperationImportReportOpen] =
    React.useState(false)
  const [operationImportReport, setOperationImportReport] = React.useState<{
    created: number
    parseErrors: OperationImportRowError[]
    apiFailures: { excelRow: number; message: string }[]
  } | null>(null)

  const memberBodyNormLower = React.useMemo(
    () =>
      new Set(
        bodyNumbers.map((bn) => normalizeBodyNumber(bn).toLowerCase()),
      ),
    [bodyNumbers],
  )

  const [bodyNumber, setBodyNumber] = React.useState("")
  const [mtopDocumentUrl, setMtopDocumentUrl] = React.useState("")
  const [ltoDocumentUrl, setLtoDocumentUrl] = React.useState("")
  const [mtopExpirationDate, setMtopExpirationDate] = React.useState("")
  const [ltoExpirationDate, setLtoExpirationDate] = React.useState("")

  const filteredOperations = React.useMemo(() => {
    const q = filterBody.trim().toLowerCase()
    return operations.filter((item) => {
      if (q && !item.bodyNumber.toLowerCase().includes(q)) return false
      const active = registrationIsActive(item)
      if (filterRegStatus === "active" && !active) return false
      if (filterRegStatus === "expired" && active) return false
      return true
    })
  }, [operations, filterBody, filterRegStatus])

  const getOperationsExportSections = React.useCallback((): CsvExportSection[] => {
    const filterParts: string[] = []
    if (filterBody.trim())
      filterParts.push(`Body # contains "${filterBody.trim()}"`)
    if (filterRegStatus !== "all") {
      filterParts.push(
        filterRegStatus === "active"
          ? "MTOP registration: Active only"
          : "MTOP registration: Expired only"
      )
    }

    const mainHeaders = [
      "Body #",
      "MTOP registration",
      "MTOP expiration",
      "LTO expiration",
      "MTOP document URL",
      "LTO document URL",
      "MTOP prior versions",
      "LTO prior versions",
      "Created at",
      "Updated at",
    ]

    const mainRows = filteredOperations.map((item) => {
      const active = registrationIsActive(item)
      return [
        item.bodyNumber,
        active ? "Active" : "Expired",
        item.mtopExpirationDate,
        item.ltoExpirationDate,
        documentUrlForExport(item.mtopDocumentUrl),
        documentUrlForExport(item.ltoDocumentUrl),
        String(item.mtopDocumentHistory?.length ?? 0),
        String(item.ltoDocumentHistory?.length ?? 0),
        formatExportDateTimeFromIso(item.createdAt),
        formatExportDateTimeFromIso(item.updatedAt),
      ]
    })

    const sections: CsvExportSection[] = [
      {
        title: "Operations — export summary",
        kind: "keyValues",
        pairs: [
          ["Exported at", formatExportDateTime()],
          ["Row count", String(filteredOperations.length)],
          [
            "Filters",
            filterParts.length ? filterParts.join("; ") : "None (all records)",
          ],
        ],
      },
      {
        title: "Operations records",
        kind: "table",
        headers: mainHeaders,
        rows: mainRows,
      },
    ]

    const mtopHist: (string | number)[][] = []
    const ltoHist: (string | number)[][] = []
    for (const op of filteredOperations) {
      for (const h of op.mtopDocumentHistory ?? []) {
        mtopHist.push([
          op.bodyNumber,
          formatExportDateTimeFromIso(h.replacedAt),
          documentUrlForExport(h.url),
        ])
      }
      for (const h of op.ltoDocumentHistory ?? []) {
        ltoHist.push([
          op.bodyNumber,
          formatExportDateTimeFromIso(h.replacedAt),
          documentUrlForExport(h.url),
        ])
      }
    }

    if (mtopHist.length) {
      sections.push({
        title: "Prior MTOP documents (replaced)",
        kind: "table",
        headers: ["Body #", "Replaced at", "Document URL"],
        rows: mtopHist,
      })
    }
    if (ltoHist.length) {
      sections.push({
        title: "Prior LTO documents (replaced)",
        kind: "table",
        headers: ["Body #", "Replaced at", "Document URL"],
        rows: ltoHist,
      })
    }

    return sections
  }, [filteredOperations, filterBody, filterRegStatus])

  const paginatedOperations = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredOperations.slice(start, start + itemsPerPage)
  }, [filteredOperations, currentPage])
  const totalPages = Math.max(
    1,
    Math.ceil(filteredOperations.length / itemsPerPage)
  )

  React.useEffect(() => {
    setCurrentPage(1)
  }, [filterBody, filterRegStatus])

  React.useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchOperations(), fetchMembers()])
      .then(([opsData, membersData]) => {
        if (cancelled) return
        setOperations(opsData)
        const bodyNums = Array.from(
          new Set(membersData.map((m) => m.bodyNumber).filter(Boolean))
        ).sort()
        setBodyNumbers(bodyNums)
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Could not load operations."
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
    setBodyNumber("")
    setMtopDocumentUrl("")
    setLtoDocumentUrl("")
    setMtopExpirationDate("")
    setLtoExpirationDate("")
  }

  function openCreate() {
    setEditingId(null)
    resetForm()
    setSheetOpen(true)
  }

  function openEdit(item: Operation) {
    setEditingId(item.id)
    setBodyNumber(item.bodyNumber)
    setMtopDocumentUrl(item.mtopDocumentUrl)
    setLtoDocumentUrl(item.ltoDocumentUrl)
    setMtopExpirationDate(item.mtopExpirationDate)
    setLtoExpirationDate(item.ltoExpirationDate)
    setSheetOpen(true)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!bodyNumber) return showToast("Body # is required.", "error")
    if (!mtopDocumentUrl) return showToast("MTOP document is required.", "error")
    if (!ltoDocumentUrl) return showToast("LTO document is required.", "error")
    if (!mtopExpirationDate || !ltoExpirationDate) {
      return showToast("Both expiration dates are required.", "error")
    }

    const payload: OperationCreatePayload = {
      bodyNumber,
      mtopDocumentUrl,
      ltoDocumentUrl,
      mtopExpirationDate,
      ltoExpirationDate,
    }

    setSavePending(true)
    try {
      if (editingId) {
        const updated = await updateOperation(editingId, payload)
        setOperations((prev) => prev.map((i) => (i.id === editingId ? updated : i)))
        showToast("Operations record updated.", "success")
      } else {
        const created = await createOperation(payload)
        setOperations((prev) => [created, ...prev])
        showToast("Operations record saved.", "success")
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
      await deleteOperation(deleteTarget.id)
      setOperations((prev) => prev.filter((i) => i.id !== deleteTarget.id))
      setDeleteTarget(null)
      showToast("Operations record removed.", "success")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Delete failed."
      showToast(msg, "error")
    } finally {
      setDeletePending(false)
    }
  }

  function onDownloadOperationImportTemplate() {
    downloadOperationImportTemplate()
    void createAuditLogEvent({
      module: "operations",
      action: "import",
      message: `${formatAuthActorLabel()} downloaded the operations Excel import template.`,
      method: "IMPORT",
      path: "/operations/import-template",
    }).catch(() => {})
    showToast("Template downloaded.", "success")
  }

  async function onOperationImportFileSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setOperationImportBusy(true)
    const apiFailures: { excelRow: number; message: string }[] = []
    let created = 0
    const newRows: Operation[] = []
    try {
      const buf = await file.arrayBuffer()
      const { items, errors: parseErrors } = parseOperationImportRows(buf, {
        memberBodyNormLower,
      })
      if (!items.length && parseErrors.length) {
        setOperationImportReport({ created: 0, parseErrors, apiFailures: [] })
        setOperationImportReportOpen(true)
        showToast(parseErrors[0]?.message ?? "Import could not read the file.", "error")
        void createAuditLogEvent({
          module: "operations",
          action: "import",
          message: `${formatAuthActorLabel()} attempted operations Excel import; file validation failed.`,
          method: "IMPORT",
          path: "/operations/import",
        }).catch(() => {})
        return
      }
      for (const { excelRow, payload } of items) {
        try {
          const row = await createOperation(payload)
          newRows.push(row)
          created++
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Request failed"
          apiFailures.push({ excelRow, message: msg })
        }
      }
      if (newRows.length) {
        setOperations((prev) => [...newRows, ...prev])
      }
      setOperationImportReport({ created, parseErrors, apiFailures })
      if (parseErrors.length || apiFailures.length) {
        setOperationImportReportOpen(true)
      }
      void createAuditLogEvent({
        module: "operations",
        action: "import",
        message: `${formatAuthActorLabel()} imported ${created} operations record(s) from Excel (${parseErrors.length} row(s) skipped in file, ${apiFailures.length} API error(s)).`,
        method: "IMPORT",
        path: "/operations/import",
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
      setOperationImportBusy(false)
    }
  }

  const operationsHeaderActions = (
    <>
      <input
        ref={operationImportInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="sr-only"
        aria-label="Select file to import operations records"
        onChange={onOperationImportFileSelected}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={loading || operationImportBusy}
        onClick={onDownloadOperationImportTemplate}
      >
        <Download className="size-4" />
        Import template
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={loading || operationImportBusy}
        onClick={() => operationImportInputRef.current?.click()}
      >
        <FileUp className="size-4" />
        {operationImportBusy ? "Importing…" : "Import"}
      </Button>
      <PageDataExportButton
        fileBaseName="operations"
        moduleName="operations"
        disabled={loading || filteredOperations.length === 0}
        getSections={getOperationsExportSections}
      />
    </>
  )

  return (
    <>
      <SiteHeader trailing={operationsHeaderActions} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Upload MTOP and LTO documents with expiration dates per body number.
        </p>
        <Button
          type="button"
          onClick={openCreate}
          className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
        >
          <Plus className="size-4" />
          Add operation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading operations...
              </p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-red-600">{error}</p>
            ) : operations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No operations records yet.
              </p>
            ) : (
              <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="grid w-full gap-1.5 sm:max-w-[180px]">
                    <Label htmlFor="operations-filter-body">Body #</Label>
                    <Input
                      id="operations-filter-body"
                      value={filterBody}
                      onChange={(e) => setFilterBody(e.target.value)}
                      placeholder="Filter…"
                      className="tabular-nums"
                    />
                  </div>
                  <div className="grid w-full gap-1.5 sm:max-w-[200px]">
                    <Label htmlFor="operations-filter-reg">MTOP Registration</Label>
                    <SearchableSelect
                      id="operations-filter-reg"
                      className={selectClassName}
                      value={filterRegStatus}
                      onChange={(e) =>
                        setFilterRegStatus(
                          e.target.value as "all" | "active" | "expired"
                        )
                      }
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                    </SearchableSelect>
                  </div>
                </div>
                {filteredOperations.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No operations match your filters.
                  </p>
                ) : (
                  <div>
                    <table className="w-full min-w-[1040px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-3 font-medium">Body #</th>
                    <th className="pb-3 pr-3 font-medium">MTOP Registration</th>
                    <th className="pb-3 pr-3 font-medium">MTOP Expiration</th>
                    <th className="pb-3 pr-3 font-medium">LTO Expiration</th>
                    <th className="pb-3 pr-3 font-medium">MTOP Document</th>
                    <th className="pb-3 pr-3 font-medium">LTO Document</th>
                    <th className="pb-3 pl-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOperations.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 pr-3 tabular-nums">{item.bodyNumber}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={
                            registrationIsActive(item)
                              ? "inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-950"
                              : "inline-flex rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-950"
                          }
                        >
                          {registrationIsActive(item) ? "Active" : "Expired"}
                        </span>
                      </td>
                      <td className="py-3 pr-3">{item.mtopExpirationDate}</td>
                      <td className="py-3 pr-3">{item.ltoExpirationDate}</td>
                      <td className="py-3 pr-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setViewDocUrl(item.mtopDocumentUrl)}
                        >
                          <Eye className="size-4" />
                          View
                        </Button>
                      </td>
                      <td className="py-3 pr-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setViewDocUrl(item.ltoDocumentUrl)}
                        >
                          <Eye className="size-4" />
                          View
                        </Button>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setHistoryFor(item)}
                            aria-label="Document history"
                          >
                            <History className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(item)}
                            aria-label="Edit operation"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(item)}
                            aria-label="Delete operation"
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
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
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
                            setCurrentPage((p) =>
                              Math.min(totalPages, p + 1)
                            )
                          }
                          disabled={currentPage >= totalPages}
                        >
                          Next
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <div className="shrink-0 border-b px-6 pb-5 pt-6">
            <SheetHeader className="space-y-2 p-0 text-left">
              <SheetTitle className="flex items-center gap-2.5 pr-10 text-xl font-semibold leading-tight">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Settings className="size-5 text-foreground" aria-hidden />
                </span>
                {editingId ? "Edit operation" : "Add operation"}
              </SheetTitle>
              <SheetDescription className="text-pretty leading-relaxed">
                Choose a body number, then upload each permit document and set
                its expiration date.
              </SheetDescription>
            </SheetHeader>
          </div>

          <form
            onSubmit={onSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="space-y-2">
                <Label htmlFor="operation-body-number" className="text-sm">
                  Body number
                </Label>
                <SearchableSelect
                  id="operation-body-number"
                  className={selectClassName}
                  value={bodyNumber}
                  onChange={(e) => setBodyNumber(e.target.value)}
                  required
                >
                  <option value="">Select a body number</option>
                  {bodyNumbers.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </SearchableSelect>
                <p className="text-xs leading-normal text-muted-foreground">
                  Only members with a body number are listed.
                </p>
              </div>

              <Separator className="bg-border/80" />

              <section
                className="space-y-4 rounded-xl border border-border/80 bg-muted/25 p-4 sm:p-5"
                aria-labelledby="operation-mtop-heading"
              >
                <div className="space-y-1">
                  <h3
                    id="operation-mtop-heading"
                    className="text-sm font-semibold text-foreground"
                  >
                    MTOP
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Municipal permit — PDF or image, max 8 MB.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm leading-snug">Document file</Label>
                    <div className="mt-2 flex flex-col gap-3">
                      <OperationDocumentUpload
                        label="Upload MTOP file"
                        onUploaded={(url) => {
                          setMtopDocumentUrl(url)
                          showToast("MTOP uploaded.", "success")
                        }}
                        onToastError={(msg) => showToast(msg, "error")}
                      />
                      {mtopDocumentUrl ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-fit gap-1.5"
                          onClick={() => setViewDocUrl(mtopDocumentUrl)}
                        >
                          <Eye className="size-4" aria-hidden />
                          Preview current file
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="operation-mtop-expiration"
                      className="text-sm"
                    >
                      Expiration date
                    </Label>
                    <Input
                      id="operation-mtop-expiration"
                      type="date"
                      value={mtopExpirationDate}
                      onChange={(e) => setMtopExpirationDate(e.target.value)}
                      required
                      className="bg-background"
                    />
                  </div>
                </div>
              </section>

              <section
                className="space-y-4 rounded-xl border border-border/80 bg-muted/25 p-4 sm:p-5"
                aria-labelledby="operation-lto-heading"
              >
                <div className="space-y-1">
                  <h3
                    id="operation-lto-heading"
                    className="text-sm font-semibold text-foreground"
                  >
                    LTO
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Land Transportation Office — PDF or image, max 8 MB.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm leading-snug">Document file</Label>
                    <div className="mt-2 flex flex-col gap-3">
                      <OperationDocumentUpload
                        label="Upload LTO file"
                        onUploaded={(url) => {
                          setLtoDocumentUrl(url)
                          showToast("LTO uploaded.", "success")
                        }}
                        onToastError={(msg) => showToast(msg, "error")}
                      />
                      {ltoDocumentUrl ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-fit gap-1.5"
                          onClick={() => setViewDocUrl(ltoDocumentUrl)}
                        >
                          <Eye className="size-4" aria-hidden />
                          Preview current file
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="operation-lto-expiration"
                      className="text-sm"
                    >
                      Expiration date
                    </Label>
                    <Input
                      id="operation-lto-expiration"
                      type="date"
                      value={ltoExpirationDate}
                      onChange={(e) => setLtoExpirationDate(e.target.value)}
                      required
                      className="bg-background"
                    />
                  </div>
                </div>
              </section>
            </div>

            <SheetFooter className="shrink-0 flex-col gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:justify-stretch">
              <Button
                type="submit"
                className="w-full bg-black text-white hover:bg-black/90 sm:min-h-10"
                disabled={savePending}
              >
                {savePending
                  ? "Saving..."
                  : editingId
                    ? "Update operation"
                    : "Save operation"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(historyFor)}
        onOpenChange={(open) => {
          if (!open) setHistoryFor(null)
        }}
      >
        <DialogContent className="max-h-[min(90vh,640px)] gap-4 overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Document history</DialogTitle>
            <DialogDescription>
              {historyFor ? (
                <>
                  Replaced uploads for body{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {historyFor.bodyNumber}
                  </span>
                  . Current files are not listed here.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {historyFor ? (
            <div className="max-h-[min(55vh,420px)] space-y-6 overflow-y-auto pr-1">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">MTOP</p>
                {(historyFor.mtopDocumentHistory?.length ?? 0) > 0 ? (
                  <ul className="divide-y rounded-md border">
                    {historyFor.mtopDocumentHistory!.map((entry) => (
                      <li
                        key={`${entry.url}-${entry.replacedAt}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                      >
                        <span className="text-sm text-foreground">
                          {formatReplacedMonthYear(entry.replacedAt)}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1"
                          onClick={() => setViewDocUrl(entry.url)}
                        >
                          <Eye className="size-4" aria-hidden />
                          View
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No previous MTOP uploads.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">LTO</p>
                {(historyFor.ltoDocumentHistory?.length ?? 0) > 0 ? (
                  <ul className="divide-y rounded-md border">
                    {historyFor.ltoDocumentHistory!.map((entry) => (
                      <li
                        key={`${entry.url}-${entry.replacedAt}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                      >
                        <span className="text-sm text-foreground">
                          {formatReplacedMonthYear(entry.replacedAt)}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1"
                          onClick={() => setViewDocUrl(entry.url)}
                        >
                          <Eye className="size-4" aria-hidden />
                          View
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No previous LTO uploads.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewDocUrl)}
        onOpenChange={(open) => {
          if (!open) setViewDocUrl(null)
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Document Viewer</DialogTitle>
            <DialogDescription>
              Preview the uploaded document.
            </DialogDescription>
          </DialogHeader>
          {viewDocUrl ? (
            <div className="max-h-[70vh] overflow-auto rounded border">
              <OperationDocumentPreview url={viewDocUrl} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={operationImportReportOpen}
        onOpenChange={(open) => {
          setOperationImportReportOpen(open)
          if (!open) setOperationImportReport(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Excel import report</DialogTitle>
            <DialogDescription>
              {operationImportReport
                ? `${operationImportReport.created} record(s) saved to the database.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {operationImportReport ? (
            <div className="space-y-4 text-sm">
              {operationImportReport.parseErrors.length ? (
                <div>
                  <p className="font-medium text-destructive">Skipped in file</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {operationImportReport.parseErrors.map((e, i) => (
                      <li key={`o-parse-${i}`}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {operationImportReport.apiFailures.length ? (
                <div>
                  <p className="font-medium text-destructive">Server errors</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {operationImportReport.apiFailures.map((e, i) => (
                      <li key={`o-api-${i}`}>
                        Row {e.excelRow}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!operationImportReport.parseErrors.length &&
              !operationImportReport.apiFailures.length ? (
                <p className="text-muted-foreground">No issues reported.</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setOperationImportReportOpen(false)}
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
            <DialogTitle>Delete operations record?</DialogTitle>
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
