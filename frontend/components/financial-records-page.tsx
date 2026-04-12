"use client"

import * as React from "react"
import { Download, FileUp, Plus } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { AddEmergencyLoan } from "@/components/add-emergency-loan"
import { AddRegularLoan } from "@/components/add-regular-loan"
import { LoansListTable } from "@/components/loans-list-table"
import {
  ButawRecordsSection,
  type ButawRecordsExportSnapshot,
} from "@/components/butaw-records-section"
import {
  SavingsRecordsSection,
  type SavingsRecordsExportSnapshot,
} from "@/components/savings-records-section"
import { useAppToast } from "@/components/app-toast-provider"
import { PageDataExportButton } from "@/components/page-data-export"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { createAuditLogEvent } from "@/lib/audit-logs-api"
import { formatAuthActorLabel } from "@/lib/auth-actor"
import { emergencyOutstandingBalance } from "@/lib/emergency-loan"
import { normalizeStoredProcessingFeeRate } from "@/lib/loan-processing-fee"
import {
  buildLoanImportMemberRefMap,
  downloadEmergencyLoanImportTemplate,
  downloadRegularLoanImportTemplate,
  parseEmergencyLoanImportRows,
  parseRegularLoanImportRows,
  type LoanImportRowError,
} from "@/lib/loan-import"
import {
  buildSavingsImportMemberRefMap,
  downloadSavingsImportTemplate,
  parseSavingsImportRows,
  type SavingsImportRowError,
} from "@/lib/savings-import"
import {
  buildButawImportMemberRefMap,
  downloadButawImportTemplate,
  parseButawImportRows,
  type ButawImportRowError,
} from "@/lib/butaw-import"
import { createButawRecord } from "@/lib/butaw-api"
import { createLoan, fetchLoans } from "@/lib/loans-api"
import type { Loan } from "@/lib/loan-types"
import { createSavingsRecord } from "@/lib/savings-api"
import { fetchMembers } from "@/lib/members-api"
import type { Member } from "@/lib/member-types"
import {
  formatButawMonthRange,
  recordEndYm,
} from "@/lib/butaw-month"
import type { ButawRecord } from "@/lib/butaw-types"
import {
  formatExportDateTime,
  formatExportDateTimeFromIso,
  type CsvExportSection,
} from "@/lib/csv-export"
import { loanOutstandingBalance } from "@/lib/member-financial-records-display"
import { matchesMemberFilter } from "@/lib/member-filter"
import type { SavingsRecord } from "@/lib/savings-types"
import { cn } from "@/lib/utils"

type MainTab = "loan" | "savings" | "butaw"
type LoanType = "regular" | "emergency"

const loanTypePillClass =
  "rounded-md border px-3 py-2 text-sm font-medium transition-colors"

function formatCurrencyPhp(n: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)
}

function loanTermLabel(loan: Loan): string {
  if (loan.loanType === "emergency") return "—"
  const unit = loan.termUnit === "years" ? "year(s)" : "month(s)"
  return `${loan.termValue} ${unit}`
}

function loanPaidInFull(loan: Loan): boolean {
  if (loan.loanType === "emergency") return Boolean(loan.emergencySettled)
  return loanOutstandingBalance(loan) <= 0.009
}

export function FinancialRecordsPage() {
  const { showToast } = useAppToast()
  const router = useRouter()
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const requestedLoanType = searchParams.get("loanType")
  const targetLoanId = searchParams.get("loanId")
  const defaultTab: MainTab =
    requestedTab === "savings" || requestedTab === "butaw" ? requestedTab : "loan"
  const defaultLoanType: LoanType =
    requestedLoanType === "emergency" ? "emergency" : "regular"

  const [mainTab, setMainTab] = React.useState<MainTab>(defaultTab)
  const [loanType, setLoanType] = React.useState<LoanType>(defaultLoanType)
  const [addLoanOpen, setAddLoanOpen] = React.useState(false)
  const [addLoanKey, setAddLoanKey] = React.useState(0)
  const [addEmergencyOpen, setAddEmergencyOpen] = React.useState(false)
  const [addEmergencyKey, setAddEmergencyKey] = React.useState(0)
  const [loansRefreshKey, setLoansRefreshKey] = React.useState(0)

  const [loanImportMembers, setLoanImportMembers] = React.useState<Member[]>([])
  const [loanImportMembersLoading, setLoanImportMembersLoading] =
    React.useState(false)
  const loanImportInputRef = React.useRef<HTMLInputElement>(null)
  const [loanImportBusy, setLoanImportBusy] = React.useState(false)
  const [loanImportReportOpen, setLoanImportReportOpen] = React.useState(false)
  const [loanImportReport, setLoanImportReport] = React.useState<{
    created: number
    parseErrors: LoanImportRowError[]
    apiFailures: { excelRow: number; message: string }[]
  } | null>(null)

  const emergencyLoanImportInputRef = React.useRef<HTMLInputElement>(null)
  const [emergencyLoanImportBusy, setEmergencyLoanImportBusy] =
    React.useState(false)
  const [emergencyLoanImportReportOpen, setEmergencyLoanImportReportOpen] =
    React.useState(false)
  const [emergencyLoanImportReport, setEmergencyLoanImportReport] =
    React.useState<{
      created: number
      parseErrors: LoanImportRowError[]
      apiFailures: { excelRow: number; message: string }[]
    } | null>(null)

  const loanImportMemberRefMap = React.useMemo(
    () => buildLoanImportMemberRefMap(loanImportMembers),
    [loanImportMembers],
  )

  const [savingsImportMembers, setSavingsImportMembers] = React.useState<Member[]>(
    [],
  )
  const [savingsImportMembersLoading, setSavingsImportMembersLoading] =
    React.useState(false)
  const savingsImportInputRef = React.useRef<HTMLInputElement>(null)
  const [savingsImportBusy, setSavingsImportBusy] = React.useState(false)
  const [savingsImportReportOpen, setSavingsImportReportOpen] =
    React.useState(false)
  const [savingsImportReport, setSavingsImportReport] = React.useState<{
    created: number
    parseErrors: SavingsImportRowError[]
    apiFailures: { excelRow: number; message: string }[]
  } | null>(null)
  const [savingsRefreshKey, setSavingsRefreshKey] = React.useState(0)
  const savingsImportMemberRefMap = React.useMemo(
    () => buildSavingsImportMemberRefMap(savingsImportMembers),
    [savingsImportMembers],
  )

  const [butawImportMembers, setButawImportMembers] = React.useState<Member[]>(
    [],
  )
  const [butawImportMembersLoading, setButawImportMembersLoading] =
    React.useState(false)
  const butawImportInputRef = React.useRef<HTMLInputElement>(null)
  const [butawImportBusy, setButawImportBusy] = React.useState(false)
  const [butawImportReportOpen, setButawImportReportOpen] =
    React.useState(false)
  const [butawImportReport, setButawImportReport] = React.useState<{
    created: number
    parseErrors: ButawImportRowError[]
    apiFailures: { excelRow: number; message: string }[]
  } | null>(null)
  const [butawRefreshKey, setButawRefreshKey] = React.useState(0)
  const butawImportMemberRefMap = React.useMemo(
    () => buildButawImportMemberRefMap(butawImportMembers),
    [butawImportMembers],
  )

  const [loansForExport, setLoansForExport] = React.useState<Loan[]>([])
  const [loansExportLoading, setLoansExportLoading] = React.useState(false)
  const [savingsExportSnap, setSavingsExportSnap] =
    React.useState<SavingsRecordsExportSnapshot | null>(null)
  const [butawExportSnap, setButawExportSnap] =
    React.useState<ButawRecordsExportSnapshot | null>(null)

  const setSavingsExportSnapStable = React.useCallback(
    (snap: SavingsRecordsExportSnapshot) => setSavingsExportSnap(snap),
    []
  )
  const setButawExportSnapStable = React.useCallback(
    (snap: ButawRecordsExportSnapshot) => setButawExportSnap(snap),
    []
  )

  React.useEffect(() => {
    setMainTab(defaultTab)
  }, [defaultTab])

  React.useEffect(() => {
    setLoanType(defaultLoanType)
  }, [defaultLoanType])

  React.useEffect(() => {
    if (mainTab !== "loan") return
    let cancelled = false
    setLoanImportMembersLoading(true)
    fetchMembers()
      .then((list) => {
        if (!cancelled) setLoanImportMembers(list)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : "Could not load members."
        showToast(msg, "error")
      })
      .finally(() => {
        if (!cancelled) setLoanImportMembersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mainTab, showToast])

  React.useEffect(() => {
    if (mainTab !== "savings") return
    let cancelled = false
    setSavingsImportMembersLoading(true)
    fetchMembers()
      .then((list) => {
        if (!cancelled) setSavingsImportMembers(list)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : "Could not load members."
        showToast(msg, "error")
      })
      .finally(() => {
        if (!cancelled) setSavingsImportMembersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mainTab, showToast])

  React.useEffect(() => {
    if (mainTab !== "butaw") return
    let cancelled = false
    setButawImportMembersLoading(true)
    fetchMembers()
      .then((list) => {
        if (!cancelled) setButawImportMembers(list)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : "Could not load members."
        showToast(msg, "error")
      })
      .finally(() => {
        if (!cancelled) setButawImportMembersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mainTab, showToast])

  React.useEffect(() => {
    if (mainTab !== "loan") return
    let cancelled = false
    setLoansExportLoading(true)
    fetchLoans()
      .then((list) => {
        if (!cancelled) setLoansForExport(list)
      })
      .catch(() => {
        if (!cancelled) setLoansForExport([])
      })
      .finally(() => {
        if (!cancelled) setLoansExportLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mainTab, loansRefreshKey])

  const getFinancialRecordsExportSections =
    React.useCallback((): CsvExportSection[] => {
      if (mainTab === "loan") {
        const regular = loansForExport.filter((l) => l.loanType !== "emergency")
        const emergency = loansForExport.filter((l) => l.loanType === "emergency")
        const regularRows = regular.map((l) => [
          l.memberName,
          l.bodyNumber,
          formatCurrencyPhp(l.amountOfLoan),
          l.dateReleased,
          l.maturityDate,
          loanTermLabel(l),
          `${l.interestRate}%`,
          `${normalizeStoredProcessingFeeRate(l.processingFeeRate).toFixed(2)}%`,
          formatCurrencyPhp(loanOutstandingBalance(l)),
          loanPaidInFull(l) ? "Yes" : "No",
          formatExportDateTimeFromIso(l.createdAt),
          formatExportDateTimeFromIso(l.updatedAt),
        ])
        const emergencyRows = emergency.map((l) => [
          l.memberName,
          l.bodyNumber,
          formatCurrencyPhp(l.amountOfLoan),
          l.dateReleased,
          formatCurrencyPhp(emergencyOutstandingBalance(l)),
          l.emergencySettled ? "Yes" : "No",
          l.emergencyAmountPaid != null && Number.isFinite(l.emergencyAmountPaid)
            ? formatCurrencyPhp(l.emergencyAmountPaid)
            : "",
          l.emergencyPaidOn ?? "",
          formatExportDateTimeFromIso(l.createdAt),
          formatExportDateTimeFromIso(l.updatedAt),
        ])
        return [
          {
            title: "Financial records — loans export summary",
            kind: "keyValues",
            pairs: [
              ["Exported at", formatExportDateTime()],
              ["Regular loans", String(regular.length)],
              ["Emergency loans", String(emergency.length)],
            ],
          },
          {
            title: "Regular loans",
            kind: "table",
            headers: [
              "Member name",
              "Body #",
              "Loan amount",
              "Date released",
              "Maturity",
              "Term",
              "Interest rate",
              "Processing fee rate",
              "Outstanding balance",
              "Paid in full",
              "Created at",
              "Updated at",
            ],
            rows: regularRows,
          },
          {
            title: "Emergency loans",
            kind: "table",
            headers: [
              "Member name",
              "Body #",
              "Loan amount",
              "Date released",
              "Outstanding / due",
              "Settled",
              "Amount paid",
              "Paid on",
              "Created at",
              "Updated at",
            ],
            rows: emergencyRows,
          },
        ]
      }

      if (mainTab === "savings") {
        const snap = savingsExportSnap
        if (!snap) {
          return [
            {
              title: "Financial records — savings export summary",
              kind: "keyValues",
              pairs: [["Exported at", formatExportDateTime()]],
            },
          ]
        }
        const filtered = snap.records.filter((r) =>
          matchesMemberFilter(
            r.bodyNumber,
            r.memberName,
            snap.filterBody,
            snap.filterName
          )
        )
        const sorted = [...filtered].sort((a, b) => {
          const byDate = b.date.localeCompare(a.date)
          if (byDate !== 0) return byDate
          return b.createdAt.localeCompare(a.createdAt)
        })
        const filterParts: string[] = []
        if (snap.filterBody.trim())
          filterParts.push(`Body # contains "${snap.filterBody.trim()}"`)
        if (snap.filterName.trim())
          filterParts.push(`Name contains "${snap.filterName.trim()}"`)
        const rows = sorted.map((r: SavingsRecord) => [
          r.bodyNumber,
          r.memberName,
          r.date,
          formatCurrencyPhp(r.amount),
          formatExportDateTimeFromIso(r.createdAt),
          formatExportDateTimeFromIso(r.updatedAt),
        ])
        return [
          {
            title: "Financial records — savings export summary",
            kind: "keyValues",
            pairs: [
              ["Exported at", formatExportDateTime()],
              ["Row count", String(rows.length)],
              [
                "Filters",
                filterParts.length ? filterParts.join("; ") : "None (all rows)",
              ],
            ],
          },
          {
            title: "Savings entries",
            kind: "table",
            headers: [
              "Body #",
              "Member name",
              "Payment date",
              "Amount",
              "Created at",
              "Updated at",
            ],
            rows,
          },
        ]
      }

      const snap = butawExportSnap
      if (!snap) {
        return [
          {
            title: "Financial records — butaw export summary",
            kind: "keyValues",
            pairs: [["Exported at", formatExportDateTime()]],
          },
        ]
      }
      const filtered = snap.records.filter((r) =>
        matchesMemberFilter(
          r.bodyNumber,
          r.memberName,
          snap.filterBody,
          snap.filterName
        )
      )
      const sorted = [...filtered].sort((a, b) => {
        const byEnd = recordEndYm(b).localeCompare(recordEndYm(a))
        if (byEnd !== 0) return byEnd
        return b.createdAt.localeCompare(a.createdAt)
      })
      const filterParts: string[] = []
      if (snap.filterBody.trim())
        filterParts.push(`Body # contains "${snap.filterBody.trim()}"`)
      if (snap.filterName.trim())
        filterParts.push(`Name contains "${snap.filterName.trim()}"`)
      const rows = sorted.map((r: ButawRecord) => [
        r.bodyNumber,
        r.memberName,
        formatButawMonthRange(r.month, r.monthEnd ?? r.month),
        formatCurrencyPhp(r.amount),
        r.isAdvance ? "Yes" : "No",
        formatExportDateTimeFromIso(r.createdAt),
        formatExportDateTimeFromIso(r.updatedAt),
      ])
      return [
        {
          title: "Financial records — butaw export summary",
          kind: "keyValues",
          pairs: [
            ["Exported at", formatExportDateTime()],
            ["Row count", String(rows.length)],
            [
              "Filters",
              filterParts.length ? filterParts.join("; ") : "None (all rows)",
            ],
          ],
        },
        {
          title: "Butaw entries",
          kind: "table",
          headers: [
            "Body #",
            "Member name",
            "Covered months",
            "Amount",
            "Advance",
            "Created at",
            "Updated at",
          ],
          rows,
        },
      ]
    }, [
      mainTab,
      loansForExport,
      savingsExportSnap,
      butawExportSnap,
    ])

  const exportFileBaseName =
    mainTab === "loan"
      ? "financial-records-loans"
      : mainTab === "savings"
        ? "financial-records-savings"
        : "financial-records-butaw"

  const exportDisabled =
    mainTab === "loan"
      ? loansExportLoading || loansForExport.length === 0
      : mainTab === "savings"
        ? !savingsExportSnap ||
          savingsExportSnap.loading ||
          savingsExportSnap.records.filter((r) =>
            matchesMemberFilter(
              r.bodyNumber,
              r.memberName,
              savingsExportSnap.filterBody,
              savingsExportSnap.filterName
            )
          ).length === 0
        : !butawExportSnap ||
          butawExportSnap.loading ||
          butawExportSnap.records.filter((r) =>
            matchesMemberFilter(
              r.bodyNumber,
              r.memberName,
              butawExportSnap.filterBody,
              butawExportSnap.filterName
            )
          ).length === 0

  const exportModuleName =
    mainTab === "loan"
      ? "financial-records-loans"
      : mainTab === "savings"
        ? "financial-records-savings"
        : "financial-records-butaw"

  const financialExportButton = (
    <PageDataExportButton
      fileBaseName={exportFileBaseName}
      moduleName={exportModuleName}
      disabled={exportDisabled}
      getSections={getFinancialRecordsExportSections}
    />
  )

  function onDownloadRegularLoanImportTemplate() {
    downloadRegularLoanImportTemplate()
    void createAuditLogEvent({
      module: "financial-records-loans",
      action: "import",
      message: `${formatAuthActorLabel()} downloaded the regular loans Excel import template.`,
      method: "IMPORT",
      path: "/financial-records/loans/import-template",
    }).catch(() => {})
    showToast("Template downloaded.", "success")
  }

  async function onRegularLoanImportFileSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setLoanImportBusy(true)
    const apiFailures: { excelRow: number; message: string }[] = []
    let created = 0
    try {
      const buf = await file.arrayBuffer()
      const { items, errors: parseErrors } = parseRegularLoanImportRows(buf, {
        memberRefByBodyNormLower: loanImportMemberRefMap,
      })
      if (!items.length && parseErrors.length) {
        setLoanImportReport({ created: 0, parseErrors, apiFailures: [] })
        setLoanImportReportOpen(true)
        showToast(parseErrors[0]?.message ?? "Import could not read the file.", "error")
        void createAuditLogEvent({
          module: "financial-records-loans",
          action: "import",
          message: `${formatAuthActorLabel()} attempted regular loan Excel import; file validation failed.`,
          method: "IMPORT",
          path: "/financial-records/loans/import",
        }).catch(() => {})
        return
      }
      for (const { excelRow, payload } of items) {
        try {
          await createLoan(payload)
          created++
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Request failed"
          apiFailures.push({ excelRow, message: msg })
        }
      }
      setLoanImportReport({ created, parseErrors, apiFailures })
      if (parseErrors.length || apiFailures.length) {
        setLoanImportReportOpen(true)
      }
      void createAuditLogEvent({
        module: "financial-records-loans",
        action: "import",
        message: `${formatAuthActorLabel()} imported ${created} regular loan(s) from Excel (${parseErrors.length} row(s) skipped in file, ${apiFailures.length} API error(s)).`,
        method: "IMPORT",
        path: "/financial-records/loans/import",
      }).catch(() => {})
      if (created > 0) {
        setLoansRefreshKey((k) => k + 1)
      }
      if (!apiFailures.length && !parseErrors.length) {
        showToast(`Imported ${created} loan(s).`, "success")
      } else {
        showToast(
          `Imported ${created} loan(s). Some rows need review — see report.`,
          "success"
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed."
      showToast(msg, "error")
    } finally {
      setLoanImportBusy(false)
    }
  }

  function onDownloadEmergencyLoanImportTemplate() {
    downloadEmergencyLoanImportTemplate()
    void createAuditLogEvent({
      module: "financial-records-loans",
      action: "import",
      message: `${formatAuthActorLabel()} downloaded the emergency loans Excel import template.`,
      method: "IMPORT",
      path: "/financial-records/emergency-loans/import-template",
    }).catch(() => {})
    showToast("Template downloaded.", "success")
  }

  async function onEmergencyLoanImportFileSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setEmergencyLoanImportBusy(true)
    const apiFailures: { excelRow: number; message: string }[] = []
    let created = 0
    try {
      const buf = await file.arrayBuffer()
      const { items, errors: parseErrors } = parseEmergencyLoanImportRows(buf, {
        memberRefByBodyNormLower: loanImportMemberRefMap,
      })
      if (!items.length && parseErrors.length) {
        setEmergencyLoanImportReport({ created: 0, parseErrors, apiFailures: [] })
        setEmergencyLoanImportReportOpen(true)
        showToast(parseErrors[0]?.message ?? "Import could not read the file.", "error")
        void createAuditLogEvent({
          module: "financial-records-loans",
          action: "import",
          message: `${formatAuthActorLabel()} attempted emergency loan Excel import; file validation failed.`,
          method: "IMPORT",
          path: "/financial-records/emergency-loans/import",
        }).catch(() => {})
        return
      }
      for (const { excelRow, payload } of items) {
        try {
          await createLoan(payload)
          created++
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Request failed"
          apiFailures.push({ excelRow, message: msg })
        }
      }
      setEmergencyLoanImportReport({ created, parseErrors, apiFailures })
      if (parseErrors.length || apiFailures.length) {
        setEmergencyLoanImportReportOpen(true)
      }
      void createAuditLogEvent({
        module: "financial-records-loans",
        action: "import",
        message: `${formatAuthActorLabel()} imported ${created} emergency loan(s) from Excel (${parseErrors.length} row(s) skipped in file, ${apiFailures.length} API error(s)).`,
        method: "IMPORT",
        path: "/financial-records/emergency-loans/import",
      }).catch(() => {})
      if (created > 0) {
        setLoansRefreshKey((k) => k + 1)
      }
      if (!apiFailures.length && !parseErrors.length) {
        showToast(`Imported ${created} loan(s).`, "success")
      } else {
        showToast(
          `Imported ${created} loan(s). Some rows need review — see report.`,
          "success"
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed."
      showToast(msg, "error")
    } finally {
      setEmergencyLoanImportBusy(false)
    }
  }

  function onDownloadSavingsImportTemplate() {
    downloadSavingsImportTemplate()
    void createAuditLogEvent({
      module: "financial-records-savings",
      action: "import",
      message: `${formatAuthActorLabel()} downloaded the savings Excel import template.`,
      method: "IMPORT",
      path: "/financial-records/savings/import-template",
    }).catch(() => {})
    showToast("Template downloaded.", "success")
  }

  async function onSavingsImportFileSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setSavingsImportBusy(true)
    const apiFailures: { excelRow: number; message: string }[] = []
    let created = 0
    try {
      const buf = await file.arrayBuffer()
      const { items, errors: parseErrors } = parseSavingsImportRows(buf, {
        memberRefByBodyNormLower: savingsImportMemberRefMap,
      })
      if (!items.length && parseErrors.length) {
        setSavingsImportReport({ created: 0, parseErrors, apiFailures: [] })
        setSavingsImportReportOpen(true)
        showToast(parseErrors[0]?.message ?? "Import could not read the file.", "error")
        void createAuditLogEvent({
          module: "financial-records-savings",
          action: "import",
          message: `${formatAuthActorLabel()} attempted savings Excel import; file validation failed.`,
          method: "IMPORT",
          path: "/financial-records/savings/import",
        }).catch(() => {})
        return
      }
      for (const { excelRow, payload } of items) {
        try {
          await createSavingsRecord(payload)
          created++
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Request failed"
          apiFailures.push({ excelRow, message: msg })
        }
      }
      setSavingsImportReport({ created, parseErrors, apiFailures })
      if (parseErrors.length || apiFailures.length) {
        setSavingsImportReportOpen(true)
      }
      void createAuditLogEvent({
        module: "financial-records-savings",
        action: "import",
        message: `${formatAuthActorLabel()} imported ${created} savings record(s) from Excel (${parseErrors.length} row(s) skipped in file, ${apiFailures.length} API error(s)).`,
        method: "IMPORT",
        path: "/financial-records/savings/import",
      }).catch(() => {})
      if (created > 0) {
        setSavingsRefreshKey((k) => k + 1)
      }
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
      setSavingsImportBusy(false)
    }
  }

  function onDownloadButawImportTemplate() {
    downloadButawImportTemplate()
    void createAuditLogEvent({
      module: "financial-records-butaw",
      action: "import",
      message: `${formatAuthActorLabel()} downloaded the butaw Excel import template.`,
      method: "IMPORT",
      path: "/financial-records/butaw/import-template",
    }).catch(() => {})
    showToast("Template downloaded.", "success")
  }

  async function onButawImportFileSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setButawImportBusy(true)
    const apiFailures: { excelRow: number; message: string }[] = []
    let created = 0
    try {
      const buf = await file.arrayBuffer()
      const { items, errors: parseErrors } = parseButawImportRows(buf, {
        memberRefByBodyNormLower: butawImportMemberRefMap,
      })
      if (!items.length && parseErrors.length) {
        setButawImportReport({ created: 0, parseErrors, apiFailures: [] })
        setButawImportReportOpen(true)
        showToast(parseErrors[0]?.message ?? "Import could not read the file.", "error")
        void createAuditLogEvent({
          module: "financial-records-butaw",
          action: "import",
          message: `${formatAuthActorLabel()} attempted butaw Excel import; file validation failed.`,
          method: "IMPORT",
          path: "/financial-records/butaw/import",
        }).catch(() => {})
        return
      }
      for (const { excelRow, payload } of items) {
        try {
          await createButawRecord(payload)
          created++
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Request failed"
          apiFailures.push({ excelRow, message: msg })
        }
      }
      setButawImportReport({ created, parseErrors, apiFailures })
      if (parseErrors.length || apiFailures.length) {
        setButawImportReportOpen(true)
      }
      void createAuditLogEvent({
        module: "financial-records-butaw",
        action: "import",
        message: `${formatAuthActorLabel()} imported ${created} butaw record(s) from Excel (${parseErrors.length} row(s) skipped in file, ${apiFailures.length} API error(s)).`,
        method: "IMPORT",
        path: "/financial-records/butaw/import",
      }).catch(() => {})
      if (created > 0) {
        setButawRefreshKey((k) => k + 1)
      }
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
      setButawImportBusy(false)
    }
  }

  const headerTrailing = (
    <>
      {mainTab === "loan" && loanType === "regular" ? (
        <>
          <input
            ref={loanImportInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            aria-label="Select file to import regular loans"
            onChange={onRegularLoanImportFileSelected}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={loanImportBusy || loanImportMembersLoading}
            onClick={onDownloadRegularLoanImportTemplate}
          >
            <Download className="size-4" />
            Import template
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={loanImportBusy || loanImportMembersLoading}
            onClick={() => loanImportInputRef.current?.click()}
          >
            <FileUp className="size-4" />
            {loanImportBusy ? "Importing…" : "Import"}
          </Button>
        </>
      ) : null}
      {mainTab === "loan" && loanType === "emergency" ? (
        <>
          <input
            ref={emergencyLoanImportInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            aria-label="Select file to import emergency loans"
            onChange={onEmergencyLoanImportFileSelected}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={emergencyLoanImportBusy || loanImportMembersLoading}
            onClick={onDownloadEmergencyLoanImportTemplate}
          >
            <Download className="size-4" />
            Import template
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={emergencyLoanImportBusy || loanImportMembersLoading}
            onClick={() => emergencyLoanImportInputRef.current?.click()}
          >
            <FileUp className="size-4" />
            {emergencyLoanImportBusy ? "Importing…" : "Import"}
          </Button>
        </>
      ) : null}
      {mainTab === "savings" ? (
        <>
          <input
            ref={savingsImportInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            aria-label="Select file to import savings records"
            onChange={onSavingsImportFileSelected}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={savingsImportBusy || savingsImportMembersLoading}
            onClick={onDownloadSavingsImportTemplate}
          >
            <Download className="size-4" />
            Import template
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={savingsImportBusy || savingsImportMembersLoading}
            onClick={() => savingsImportInputRef.current?.click()}
          >
            <FileUp className="size-4" />
            {savingsImportBusy ? "Importing…" : "Import"}
          </Button>
        </>
      ) : null}
      {mainTab === "butaw" ? (
        <>
          <input
            ref={butawImportInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            aria-label="Select file to import butaw records"
            onChange={onButawImportFileSelected}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={butawImportBusy || butawImportMembersLoading}
            onClick={onDownloadButawImportTemplate}
          >
            <Download className="size-4" />
            Import template
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={butawImportBusy || butawImportMembersLoading}
            onClick={() => butawImportInputRef.current?.click()}
          >
            <FileUp className="size-4" />
            {butawImportBusy ? "Importing…" : "Import"}
          </Button>
        </>
      ) : null}
      {financialExportButton}
    </>
  )

  function openAddLoan() {
    setAddLoanKey((k) => k + 1)
    setAddLoanOpen(true)
  }

  function onLoanSaved() {
    setLoansRefreshKey((k) => k + 1)
    setAddLoanOpen(false)
  }

  function openAddEmergencyLoan() {
    setAddEmergencyKey((k) => k + 1)
    setAddEmergencyOpen(true)
  }

  function onEmergencyLoanSaved() {
    setLoansRefreshKey((k) => k + 1)
    setAddEmergencyOpen(false)
  }

  function goToMainTab(id: MainTab) {
    setMainTab(id)
    const params = new URLSearchParams(searchParams.toString())
    if (id === "loan") {
      params.delete("tab")
    } else {
      params.set("tab", id)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <>
      <SiteHeader trailing={headerTrailing} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Financial Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className="inline-flex w-full max-w-xl flex-col gap-1 rounded-xl border border-border bg-muted/40 p-1.5 sm:flex-row sm:items-stretch"
              role="tablist"
              aria-label="Financial records sections"
            >
              {(
                [
                  ["loan", "Loan"] as const,
                  ["savings", "Savings"] as const,
                  ["butaw", "Butaw"] as const,
                ] satisfies [MainTab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mainTab === id}
                  onClick={() => goToMainTab(id)}
                  className={cn(
                    "flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all sm:py-3",
                    mainTab === id
                      ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                      : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {mainTab === "loan" ? (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Loan type">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={loanType === "regular"}
                    onClick={() => setLoanType("regular")}
                    className={cn(
                      loanTypePillClass,
                      loanType === "regular"
                        ? "border-black bg-black text-white"
                        : "border-input bg-white"
                    )}
                  >
                    Regular Loan
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={loanType === "emergency"}
                    onClick={() => setLoanType("emergency")}
                    className={cn(
                      loanTypePillClass,
                      loanType === "emergency"
                        ? "border-black bg-black text-white"
                        : "border-input bg-white"
                    )}
                  >
                    Emergency Loan
                  </button>
                </div>

                {loanType === "regular" ? (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Regular loans for members. Add a loan to enter details and
                        preview amortization.
                      </p>
                      <Button
                        type="button"
                        onClick={openAddLoan}
                        className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
                      >
                        <Plus className="size-4" />
                        Add regular loan
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Loan list</h3>
                      <LoansListTable
                        refreshKey={loansRefreshKey}
                        loanType="regular"
                        initialViewLoanId={
                          mainTab === "loan" && loanType === "regular"
                            ? targetLoanId
                            : null
                        }
                        onLoanUpdated={() =>
                          setLoansRefreshKey((k) => k + 1)
                        }
                      />
                    </div>

                    <Sheet
                      open={addLoanOpen}
                      onOpenChange={(open) => {
                        setAddLoanOpen(open)
                      }}
                    >
                      <SheetContent
                        side="right"
                        className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-4xl"
                      >
                        <SheetHeader className="pb-4">
                          <SheetTitle>Add regular loan</SheetTitle>
                        </SheetHeader>
                        <AddRegularLoan key={addLoanKey} onSaved={onLoanSaved} />
                      </SheetContent>
                    </Sheet>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Emergency loans have no fixed monthly due date. Use the
                        reference table as a guide to amounts by months from the
                        release date.
                      </p>
                      <Button
                        type="button"
                        onClick={openAddEmergencyLoan}
                        className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
                      >
                        <Plus className="size-4" />
                        Add emergency loan
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Emergency loan list</h3>
                      <LoansListTable
                        refreshKey={loansRefreshKey}
                        loanType="emergency"
                        initialViewLoanId={
                          mainTab === "loan" && loanType === "emergency"
                            ? targetLoanId
                            : null
                        }
                        onLoanUpdated={() =>
                          setLoansRefreshKey((k) => k + 1)
                        }
                      />
                    </div>

                    <Sheet
                      open={addEmergencyOpen}
                      onOpenChange={(open) => {
                        setAddEmergencyOpen(open)
                      }}
                    >
                      <SheetContent
                        side="right"
                        className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl"
                      >
                        <SheetHeader className="pb-4">
                          <SheetTitle>Add emergency loan</SheetTitle>
                        </SheetHeader>
                        <AddEmergencyLoan
                          key={addEmergencyKey}
                          onSaved={onEmergencyLoanSaved}
                        />
                      </SheetContent>
                    </Sheet>
                  </div>
                )}
              </div>
            ) : mainTab === "savings" ? (
              <SavingsRecordsSection
                refreshKey={savingsRefreshKey}
                onExportSnapshot={setSavingsExportSnapStable}
              />
            ) : (
              <ButawRecordsSection
                refreshKey={butawRefreshKey}
                onExportSnapshot={setButawExportSnapStable}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={loanImportReportOpen}
        onOpenChange={(open) => {
          setLoanImportReportOpen(open)
          if (!open) setLoanImportReport(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Excel import report</DialogTitle>
            <DialogDescription>
              {loanImportReport
                ? `${loanImportReport.created} loan(s) saved to the database.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {loanImportReport ? (
            <div className="space-y-4 text-sm">
              {loanImportReport.parseErrors.length ? (
                <div>
                  <p className="font-medium text-destructive">Skipped in file</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {loanImportReport.parseErrors.map((e, i) => (
                      <li key={`loan-parse-${i}`}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {loanImportReport.apiFailures.length ? (
                <div>
                  <p className="font-medium text-destructive">Server errors</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {loanImportReport.apiFailures.map((e, i) => (
                      <li key={`loan-api-${i}`}>
                        Row {e.excelRow}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!loanImportReport.parseErrors.length &&
              !loanImportReport.apiFailures.length ? (
                <p className="text-muted-foreground">No issues reported.</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setLoanImportReportOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={emergencyLoanImportReportOpen}
        onOpenChange={(open) => {
          setEmergencyLoanImportReportOpen(open)
          if (!open) setEmergencyLoanImportReport(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Emergency loan — Excel import report</DialogTitle>
            <DialogDescription>
              {emergencyLoanImportReport
                ? `${emergencyLoanImportReport.created} loan(s) saved to the database.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {emergencyLoanImportReport ? (
            <div className="space-y-4 text-sm">
              {emergencyLoanImportReport.parseErrors.length ? (
                <div>
                  <p className="font-medium text-destructive">Skipped in file</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {emergencyLoanImportReport.parseErrors.map((e, i) => (
                      <li key={`eloan-parse-${i}`}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {emergencyLoanImportReport.apiFailures.length ? (
                <div>
                  <p className="font-medium text-destructive">Server errors</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {emergencyLoanImportReport.apiFailures.map((e, i) => (
                      <li key={`eloan-api-${i}`}>
                        Row {e.excelRow}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!emergencyLoanImportReport.parseErrors.length &&
              !emergencyLoanImportReport.apiFailures.length ? (
                <p className="text-muted-foreground">No issues reported.</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setEmergencyLoanImportReportOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={savingsImportReportOpen}
        onOpenChange={(open) => {
          setSavingsImportReportOpen(open)
          if (!open) setSavingsImportReport(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Savings — Excel import report</DialogTitle>
            <DialogDescription>
              {savingsImportReport
                ? `${savingsImportReport.created} record(s) saved to the database.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {savingsImportReport ? (
            <div className="space-y-4 text-sm">
              {savingsImportReport.parseErrors.length ? (
                <div>
                  <p className="font-medium text-destructive">Skipped in file</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {savingsImportReport.parseErrors.map((e, i) => (
                      <li key={`sav-parse-${i}`}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {savingsImportReport.apiFailures.length ? (
                <div>
                  <p className="font-medium text-destructive">Server errors</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {savingsImportReport.apiFailures.map((e, i) => (
                      <li key={`sav-api-${i}`}>
                        Row {e.excelRow}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!savingsImportReport.parseErrors.length &&
              !savingsImportReport.apiFailures.length ? (
                <p className="text-muted-foreground">No issues reported.</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setSavingsImportReportOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={butawImportReportOpen}
        onOpenChange={(open) => {
          setButawImportReportOpen(open)
          if (!open) setButawImportReport(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Butaw — Excel import report</DialogTitle>
            <DialogDescription>
              {butawImportReport
                ? `${butawImportReport.created} record(s) saved to the database.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {butawImportReport ? (
            <div className="space-y-4 text-sm">
              {butawImportReport.parseErrors.length ? (
                <div>
                  <p className="font-medium text-destructive">Skipped in file</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {butawImportReport.parseErrors.map((e, i) => (
                      <li key={`butaw-parse-${i}`}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {butawImportReport.apiFailures.length ? (
                <div>
                  <p className="font-medium text-destructive">Server errors</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {butawImportReport.apiFailures.map((e, i) => (
                      <li key={`butaw-api-${i}`}>
                        Row {e.excelRow}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!butawImportReport.parseErrors.length &&
              !butawImportReport.apiFailures.length ? (
                <p className="text-muted-foreground">No issues reported.</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setButawImportReportOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
