"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Plus,
  ScrollText,
  X,
} from "lucide-react"
import {
  computeAgeFromBirthDate,
  formatPhLocalSpaced,
  formatPhMobileDisplay,
  formatTinDisplay,
  isValidPhMobile10,
  isValidTin12,
  normalizePhMobile10,
  normalizeTinDigits,
} from "@/lib/member-utils"
import {
  fetchProvinces,
  fetchCities,
  fetchBarangays,
} from "@/lib/ph-address"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Separator } from "@/components/ui/separator"
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
import { useAppToast } from "@/components/app-toast-provider"
import { MemberAvatarUpload } from "@/components/member-avatar-upload"
import { OperationDocumentUpload } from "@/components/operation-document-upload"
import { cn } from "@/lib/utils"
import { fetchButawRecords } from "@/lib/butaw-api"
import { availableShareCapitalForLipatan } from "@/lib/lipatan-share-from-butaw"
import type { ButawRecord } from "@/lib/butaw-types"
import { fetchLoans } from "@/lib/loans-api"
import type { Loan } from "@/lib/loan-types"
import { loanOutstandingBalance } from "@/lib/member-financial-records-display"
import { fetchMembers, lipatanMember } from "@/lib/members-api"
import {
  DEFAULT_PROFILE_IMAGE,
  type LipatanHistoryEntry,
  type Member,
  type MemberAddress,
  type MemberFullName,
} from "@/lib/member-types"
import { LIPATAN_SHARE_CAPITAL_DEDUCTION } from "@/lib/lipatan-constants"
import {
  PageDataExportButton,
  type CsvExportSection,
} from "@/components/page-data-export"
import {
  formatExportDateTime,
  formatExportDateTimeFromIso,
} from "@/lib/csv-export"
import { SiteHeader } from "@/components/site-header"

const LIPATAN_BLOCKED_BY_LOANS_MSG =
  "This body has an outstanding regular or emergency loan. Lipatan is disabled until the balance is fully settled."

const SUFFIX_OPTIONS = ["", "Jr.", "Sr.", "II", "III", "IV"] as const

const emptyName = (): MemberFullName => ({
  first: "",
  middle: "",
  last: "",
  suffix: "",
})

const emptyAddress = (): MemberAddress => ({
  province: "",
  city: "",
  barangay: "",
  line: "",
})

interface AddressOption {
  code: string
  name: string
}

type LipatanTableRow = {
  key: string
  bodyNumber: string
  transferredAt: string
  fromName: string
  toName: string
  documentUrl: string
}

const selectClass = cn(
  "flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm disabled:cursor-not-allowed"
)

function LipatanDocumentPreview({ url }: { url: string }) {
  const [useIframe, setUseIframe] = React.useState(false)
  React.useEffect(() => {
    setUseIframe(false)
  }, [url])
  if (useIframe) {
    return (
      <iframe src={url} title="Document" className="h-[70vh] w-full" />
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

function capitalizeFirstLetter(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function displayFullName(n: MemberFullName): string {
  if (!n.last.trim() && !n.first.trim()) return "—"
  const firstName = capitalizeFirstLetter(n.first.trim().replace(/,/g, ""))
  const lastName = capitalizeFirstLetter(n.last.trim().replace(/,/g, ""))
  const head = lastName
    ? `${lastName}, ${firstName}`.trim()
    : firstName
  const suf = n.suffix.trim().replace(/,/g, "")
  return suf ? `${head} ${suf}`.trim() : head
}

function cleanBodyNumber(bodyNumber: string): string {
  return bodyNumber.replace(/,/g, "").trim()
}

function initials(n: MemberFullName): string {
  const a = n.first.trim().charAt(0)
  const b = n.last.trim().charAt(0)
  if (a || b) return (a + b).toUpperCase()
  return "?"
}

function historyFromLabel(h: LipatanHistoryEntry): string {
  return (
    h.fromOperatorName ?? displayFullName(h.previousPersonal.fullName)
  )
}

function historyToLabel(h: LipatanHistoryEntry): string {
  return h.toOperatorName ?? "—"
}

function formatHistoryDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-PH", { dateStyle: "medium" })
}

function buildLipatanRows(members: Member[]): LipatanTableRow[] {
  const rows: LipatanTableRow[] = []
  for (const m of members) {
    const hist = m.lipatanHistory ?? []
    for (let i = 0; i < hist.length; i++) {
      const h = hist[i]
      rows.push({
        key: `${m.id}-${i}-${h.transferredAt}`,
        bodyNumber: m.bodyNumber,
        transferredAt: h.transferredAt,
        fromName: historyFromLabel(h),
        toName: historyToLabel(h),
        documentUrl: (h.documentUrl ?? "").trim(),
      })
    }
  }
  rows.sort(
    (a, b) =>
      new Date(b.transferredAt).getTime() -
      new Date(a.transferredAt).getTime()
  )
  return rows
}

function lipatanEntryForRow(
  members: Member[],
  row: LipatanTableRow
): { member: Member; entry: LipatanHistoryEntry } | null {
  const member = members.find((m) => m.bodyNumber === row.bodyNumber)
  if (!member?.lipatanHistory?.length) return null
  const entry = member.lipatanHistory.find(
    (h) => h.transferredAt === row.transferredAt
  )
  if (!entry) return null
  return { member, entry }
}

function formatPhpForExport(n: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)
}

function documentUrlForExportLipatan(url: string | undefined): string {
  const u = (url ?? "").trim()
  if (!u) return ""
  if (u.startsWith("data:")) return "[embedded]"
  return u
}

const ITEMS_PER_PAGE = 10

function memberHasBlockingLoanBalance(loans: Loan[], memberId: string): boolean {
  return loans
    .filter((l) => l.memberId === memberId)
    .some((l) => loanOutstandingBalance(l) > 0.009)
}

export function LipatanPage() {
  const { showToast } = useAppToast()
  const [members, setMembers] = React.useState<Member[]>([])
  const [loans, setLoans] = React.useState<Loan[]>([])
  const [butawRecords, setButawRecords] = React.useState<ButawRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [listError, setListError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [sheetMemberId, setSheetMemberId] = React.useState<string | null>(null)

  const [currentPage, setCurrentPage] = React.useState(1)
  const [filters, setFilters] = React.useState({ name: "", bodyNumber: "" })

  const [fullName, setFullName] = React.useState<MemberFullName>(emptyName)
  const [birthday, setBirthday] = React.useState("")
  const [address, setAddress] = React.useState<MemberAddress>(emptyAddress)
  const [contactMobile10, setContactMobile10] = React.useState("")
  const [tinDigits, setTinDigits] = React.useState("")
  const [precinctNumber, setPrecinctNumber] = React.useState("")
  const [profileImageSrc, setProfileImageSrc] =
    React.useState<string>(DEFAULT_PROFILE_IMAGE)
  const [lipatanDocumentUrl, setLipatanDocumentUrl] = React.useState("")
  const [viewDocUrl, setViewDocUrl] = React.useState<string | null>(null)

  const [provinces, setProvinces] = React.useState<AddressOption[]>([])
  const [cities, setCities] = React.useState<AddressOption[]>([])
  const [barangays, setBarangays] = React.useState<AddressOption[]>([])
  const [addressLoading, setAddressLoading] = React.useState(false)

  const sheetMember = React.useMemo(
    () =>
      sheetMemberId ? members.find((m) => m.id === sheetMemberId) ?? null : null,
    [members, sheetMemberId]
  )

  const sheetShareFromButaw = React.useMemo(() => {
    if (!sheetMember) return null
    return availableShareCapitalForLipatan(
      butawRecords,
      sheetMember.id,
      sheetMember.lipatanHistory
    )
  }, [sheetMember, butawRecords])

  const allLipatanRows = React.useMemo(
    () => buildLipatanRows(members),
    [members]
  )

  const filteredLipatanRows = React.useMemo(() => {
    const nq = filters.name.trim().toLowerCase()
    const bq = filters.bodyNumber.trim().toLowerCase()
    return allLipatanRows.filter((row) => {
      const matchBody =
        !bq || row.bodyNumber.toLowerCase().includes(bq)
      const matchName =
        !nq ||
        row.fromName.toLowerCase().includes(nq) ||
        row.toName.toLowerCase().includes(nq)
      return matchBody && matchName
    })
  }, [allLipatanRows, filters])

  const hasActiveFilters =
    filters.name.trim().length > 0 || filters.bodyNumber.trim().length > 0

  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredLipatanRows.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredLipatanRows, currentPage])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLipatanRows.length / ITEMS_PER_PAGE)
  )

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setListError(null)
    Promise.all([fetchMembers(), fetchButawRecords(), fetchLoans()])
      .then(([data, butaw, loanRows]) => {
        if (!cancelled) {
          setMembers(data)
          setButawRecords(butaw)
          setLoans(loanRows)
        }
      })
      .catch((e: unknown) => {
        const msg =
          e instanceof Error ? e.message : "Could not load data."
        if (!cancelled) {
          setListError(msg)
          showToast(msg, "error")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showToast])

  React.useEffect(() => {
    let cancelled = false
    setAddressLoading(true)
    fetchProvinces()
      .then((data) => {
        if (!cancelled) {
          setProvinces(data.map((p) => ({ code: p.code, name: p.name })))
        }
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to load provinces"
        if (!cancelled) showToast(msg, "error")
      })
      .finally(() => {
        if (!cancelled) setAddressLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showToast])

  React.useEffect(() => {
    if (!address.province) {
      setCities([])
      return
    }
    const provinceCode = provinces.find((p) => p.name === address.province)
      ?.code
    if (!provinceCode) return

    let cancelled = false
    setAddressLoading(true)
    fetchCities(provinceCode)
      .then((data) => {
        if (!cancelled) {
          setCities(data.map((c) => ({ code: c.code, name: c.name })))
        }
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to load cities"
        if (!cancelled) showToast(msg, "error")
      })
      .finally(() => {
        if (!cancelled) setAddressLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [address.province, provinces, showToast])

  React.useEffect(() => {
    if (!address.city) {
      setBarangays([])
      return
    }
    const cityCode = cities.find((c) => c.name === address.city)?.code
    if (!cityCode) return

    let cancelled = false
    setAddressLoading(true)
    fetchBarangays(cityCode)
      .then((data) => {
        if (!cancelled) {
          setBarangays(data.map((b) => ({ code: b.code, name: b.name })))
        }
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to load barangays"
        if (!cancelled) showToast(msg, "error")
      })
      .finally(() => {
        if (!cancelled) setAddressLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [address.city, cities, showToast])

  React.useEffect(() => {
    setFullName(emptyName())
    setBirthday("")
    setAddress(emptyAddress())
    setContactMobile10("")
    setTinDigits("")
    setPrecinctNumber("")
    setProfileImageSrc(DEFAULT_PROFILE_IMAGE)
    setLipatanDocumentUrl("")
  }, [sheetMemberId])

  function openRecordSheet() {
    setSheetMemberId(null)
    setSheetOpen(true)
  }

  function clearFilters() {
    setFilters({ name: "", bodyNumber: "" })
    setCurrentPage(1)
  }

  React.useEffect(() => {
    setCurrentPage(1)
  }, [filters.name, filters.bodyNumber])

  const getLipatanExportSections = React.useCallback((): CsvExportSection[] => {
    const filterParts: string[] = []
    if (filters.name.trim())
      filterParts.push(`Name contains "${filters.name.trim()}"`)
    if (filters.bodyNumber.trim())
      filterParts.push(`Body # contains "${filters.bodyNumber.trim()}"`)

    const headers = [
      "Body #",
      "Transferred at",
      "Date (local)",
      "From",
      "To",
      "Share capital deducted",
      "Document URL",
      "Member name (current record)",
      "Previous operator — full name",
      "Previous operator — birthday",
      "Previous operator — mobile",
      "Previous operator — TIN",
      "Previous operator — address",
      "Previous operator — precinct",
    ]

    const rows = filteredLipatanRows.map((row) => {
      const found = lipatanEntryForRow(members, row)
      if (!found) {
        return [
          row.bodyNumber,
          formatExportDateTimeFromIso(row.transferredAt),
          formatHistoryDate(row.transferredAt),
          row.fromName,
          row.toName,
          "",
          documentUrlForExportLipatan(row.documentUrl),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]
      }
      const { member, entry } = found
      const prev = entry.previousPersonal
      const addr = [
        prev.address.line,
        prev.address.barangay,
        prev.address.city,
        prev.address.province,
      ]
        .filter(Boolean)
        .join(", ")
      return [
        row.bodyNumber,
        formatExportDateTimeFromIso(row.transferredAt),
        formatHistoryDate(row.transferredAt),
        row.fromName,
        row.toName,
        formatPhpForExport(entry.shareCapitalDeducted),
        documentUrlForExportLipatan(entry.documentUrl ?? row.documentUrl),
        displayFullName(member.fullName),
        displayFullName(prev.fullName),
        prev.birthday,
        formatPhMobileDisplay(prev.contactMobile10),
        formatTinDisplay(prev.tinDigits),
        addr,
        prev.precinctNumber ?? "",
      ]
    })

    return [
      {
        title: "Lipatan — export summary",
        kind: "keyValues",
        pairs: [
          ["Exported at", formatExportDateTime()],
          ["Row count", String(filteredLipatanRows.length)],
          [
            "Filters",
            filterParts.length ? filterParts.join("; ") : "None (all records)",
          ],
        ],
      },
      {
        title: "Lipatan records",
        kind: "table",
        headers,
        rows,
      },
    ]
  }, [filteredLipatanRows, filters, members])

  const historyRows = sheetMember
    ? [...(sheetMember.lipatanHistory ?? [])].reverse()
    : []

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sheetMemberId) {
      showToast("Select a member record first.", "error")
      return
    }
    if (memberHasBlockingLoanBalance(loans, sheetMemberId)) {
      showToast(LIPATAN_BLOCKED_BY_LOANS_MSG, "error")
      return
    }
    if (!fullName.first.trim() || !fullName.last.trim()) {
      showToast("New operator: first and last name are required.", "error")
      return
    }
    if (!birthday) {
      showToast("Birthday is required.", "error")
      return
    }
    const age = computeAgeFromBirthDate(birthday)
    if (age === null || age < 0) {
      showToast("Enter a valid birthday.", "error")
      return
    }
    if (
      !address.province ||
      !address.city ||
      !address.barangay ||
      !address.line.trim()
    ) {
      showToast(
        "Complete province, city, barangay, and address line for the new operator.",
        "error"
      )
      return
    }
    const mobile = normalizePhMobile10(contactMobile10)
    if (!isValidPhMobile10(mobile)) {
      showToast(
        "Enter a valid PH mobile number (10 digits starting with 9).",
        "error"
      )
      return
    }
    const tin = normalizeTinDigits(tinDigits)
    if (!isValidTin12(tin)) {
      showToast("TIN must be 12 digits.", "error")
      return
    }
    if (!precinctNumber.trim()) {
      showToast("Precinct number is required.", "error")
      return
    }

    const sc = availableShareCapitalForLipatan(
      butawRecords,
      sheetMemberId,
      members.find((m) => m.id === sheetMemberId)?.lipatanHistory
    )
    if (sc.available < LIPATAN_SHARE_CAPITAL_DEDUCTION) {
      showToast(
        `Not enough share capital from Butaw records. Available ₱${sc.available.toLocaleString("en-PH")}; need at least ₱${LIPATAN_SHARE_CAPITAL_DEDUCTION.toLocaleString("en-PH")}.`,
        "error"
      )
      return
    }

    setConfirmOpen(true)
  }

  async function confirmCompleteLipatan() {
    if (!sheetMemberId) return
    if (memberHasBlockingLoanBalance(loans, sheetMemberId)) {
      showToast(LIPATAN_BLOCKED_BY_LOANS_MSG, "error")
      setConfirmOpen(false)
      return
    }
    const mobile = normalizePhMobile10(contactMobile10)
    const tin = normalizeTinDigits(tinDigits)
    setSubmitting(true)
    try {
      await lipatanMember(sheetMemberId, {
        fullName: {
          first: fullName.first.trim(),
          middle: fullName.middle.trim(),
          last: fullName.last.trim(),
          suffix: fullName.suffix.trim(),
        },
        birthday,
        address: {
          province: address.province,
          city: address.city,
          barangay: address.barangay,
          line: address.line.trim(),
        },
        contactMobile10: mobile,
        tinDigits: tin,
        profileImageSrc,
        precinctNumber: precinctNumber.trim(),
        documentUrl: lipatanDocumentUrl.trim() || undefined,
      })
      const [refreshedMembers, refreshedButaw, refreshedLoans] =
        await Promise.all([
          fetchMembers(),
          fetchButawRecords(),
          fetchLoans(),
        ])
      setMembers(refreshedMembers)
      setButawRecords(refreshedButaw)
      setLoans(refreshedLoans)
      showToast("Lipatan completed.", "success")
      setFullName(emptyName())
      setBirthday("")
      setAddress(emptyAddress())
      setContactMobile10("")
      setTinDigits("")
      setPrecinctNumber("")
      setProfileImageSrc(DEFAULT_PROFILE_IMAGE)
      setLipatanDocumentUrl("")
      setConfirmOpen(false)
      setSheetOpen(false)
      setSheetMemberId(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lipatan failed."
      showToast(msg, "error")
    } finally {
      setSubmitting(false)
    }
  }

  const lipatanExportButton = (
    <PageDataExportButton
      fileBaseName="lipatan"
      moduleName="lipatan"
      disabled={loading || filteredLipatanRows.length === 0}
      getSections={getLipatanExportSections}
    />
  )

  return (
    <>
      <SiteHeader trailing={lipatanExportButton} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-muted-foreground max-w-3xl">
          View lipatan history and record when a franchise (body) is transferred
          to a new operator. Personal details update on the member record;
          loans and other balances stay on the same body.
        </p>
        <Button
          type="button"
          onClick={openRecordSheet}
          className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
        >
          <Plus className="size-4" />
          Record lipatan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lipatan history</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="size-4" />
                <span>Filter</span>
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
            <div className="grid grid-cols-2 gap-2 sm:max-w-xl">
              <Input
                placeholder="Name (from / to)"
                value={filters.name}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, name: e.target.value }))
                }}
                className="text-sm"
              />
              <Input
                placeholder="Body #"
                value={filters.bodyNumber}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, bodyNumber: e.target.value }))
                }}
                className="text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : listError ? (
              <p className="py-8 text-center text-sm text-red-600">
                {listError}
              </p>
            ) : allLipatanRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No lipatan records yet. Use Record lipatan to add one.
              </p>
            ) : filteredLipatanRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No records match your filters.
              </p>
            ) : (
              <>
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-3 font-medium">Body #</th>
                      <th className="pb-3 pr-3 font-medium">Date</th>
                      <th className="pb-3 pr-3 font-medium">From → To</th>
                      <th className="pb-3 pr-3 font-medium">Document</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row) => (
                      <tr key={row.key} className="border-b last:border-0">
                        <td className="py-3 pr-3 tabular-nums font-medium">
                          {row.bodyNumber}
                        </td>
                        <td className="py-3 pr-3 tabular-nums text-muted-foreground">
                          {formatHistoryDate(row.transferredAt)}
                        </td>
                        <td className="py-3 pr-3">
                          <span className="font-medium">{row.fromName}</span>
                          <span className="mx-2 text-muted-foreground">
                            →
                          </span>
                          <span className="font-medium">{row.toName}</span>
                        </td>
                        <td className="py-3 pr-3">
                          {row.documentUrl ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => setViewDocUrl(row.documentUrl)}
                            >
                              <Eye className="size-4" />
                              View
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLipatanRows.length > ITEMS_PER_PAGE && (
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="size-4" />
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) {
            setSheetMemberId(null)
            setConfirmOpen(false)
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <ScrollText className="size-5" />
              Record lipatan
            </SheetTitle>
            <p className="text-left text-sm text-muted-foreground">
              Choose the member record (body), then enter the new operator.
            </p>
          </SheetHeader>

          <div className="space-y-2 pb-4">
            <Label htmlFor="lipatan-member-select">Member record</Label>
            <SearchableSelect
              id="lipatan-member-select"
              className={selectClass}
              value={sheetMemberId ?? ""}
              onChange={(e) =>
                setSheetMemberId(e.target.value || null)
              }
            >
              <option value="">Select body / member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {`${cleanBodyNumber(m.bodyNumber)} — ${displayFullName(m.fullName)}`}
                </option>
              ))}
            </SearchableSelect>
          </div>

          {sheetMember ? (
            <>
              {sheetShareFromButaw ? (
                <div className="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <p className="text-lg tabular-nums">
                    <span className="text-muted-foreground">Share Capital:</span>{" "}
                    <span className="font-semibold">
                      ₱{sheetShareFromButaw.available.toLocaleString("en-PH")}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ₱
                    {LIPATAN_SHARE_CAPITAL_DEDUCTION.toLocaleString("en-PH")}{" "}
                    will be deducted when you complete lipatan.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 space-y-2 rounded-md border bg-muted/30 px-3 py-3 text-sm">
                <Label>Lipatan document</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <OperationDocumentUpload
                    label="Upload document"
                    onUploaded={(url) => {
                      setLipatanDocumentUrl(url)
                      showToast("Document uploaded.", "success")
                    }}
                    onToastError={(msg) => showToast(msg, "error")}
                  />
                  {lipatanDocumentUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setViewDocUrl(lipatanDocumentUrl)}
                    >
                      <Eye className="size-4" />
                      View
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-col items-center gap-3 border-b pb-6">
                <Avatar className="h-20 w-20 ring-2 ring-border ring-offset-2 ring-offset-background">
                  <AvatarImage
                    src={profileImageSrc || undefined}
                    alt=""
                    className="object-cover"
                  />
                  <AvatarFallback>
                    {fullName.first || fullName.last
                      ? initials(fullName)
                      : "?"}
                  </AvatarFallback>
                </Avatar>
                <MemberAvatarUpload
                  onUploaded={(url) => setProfileImageSrc(url)}
                  onToastError={(msg) => showToast(msg, "error")}
                />
              </div>

              <form
                onSubmit={handleFormSubmit}
                className="flex flex-1 flex-col gap-4 pb-6 pt-4"
              >
                <div>
                  <h3 className="text-sm font-semibold">New operator</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Personal information only.
                  </p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="lip-first">First name</Label>
                      <Input
                        id="lip-first"
                        value={fullName.first}
                        onChange={(e) =>
                          setFullName((n) => ({ ...n, first: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lip-middle">Middle name</Label>
                      <Input
                        id="lip-middle"
                        value={fullName.middle}
                        onChange={(e) =>
                          setFullName((n) => ({
                            ...n,
                            middle: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lip-last">Last name</Label>
                      <Input
                        id="lip-last"
                        value={fullName.last}
                        onChange={(e) =>
                          setFullName((n) => ({ ...n, last: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lip-suffix">Suffix</Label>
                      <SearchableSelect
                        id="lip-suffix"
                        className={selectClass}
                        value={fullName.suffix}
                        onChange={(e) =>
                          setFullName((n) => ({
                            ...n,
                            suffix: e.target.value,
                          }))
                        }
                        searchable={false}
                      >
                        {SUFFIX_OPTIONS.map((s) => (
                          <option key={s || "none"} value={s}>
                            {s || "—"}
                          </option>
                        ))}
                      </SearchableSelect>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="lip-bday">Birthday</Label>
                      <Input
                        id="lip-bday"
                        type="date"
                        value={birthday}
                        onChange={(e) => setBirthday(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="lip-precinct">Precinct number</Label>
                      <Input
                        id="lip-precinct"
                        value={precinctNumber}
                        onChange={(e) => setPrecinctNumber(e.target.value)}
                        placeholder="Precinct number"
                        className="tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-semibold">Address</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="lip-prov">Province</Label>
                      <SearchableSelect
                        id="lip-prov"
                        className={selectClass}
                        disabled={addressLoading}
                        value={address.province}
                        onChange={(e) =>
                          setAddress((a) => ({
                            ...a,
                            province: e.target.value,
                            city: "",
                            barangay: "",
                          }))
                        }
                      >
                        <option value="">
                          {addressLoading ? "Loading…" : "Select province"}
                        </option>
                        {provinces.map((p) => (
                          <option key={p.code} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </SearchableSelect>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lip-city">City / municipality</Label>
                      <SearchableSelect
                        id="lip-city"
                        className={selectClass}
                        disabled={!address.province || addressLoading}
                        value={address.city}
                        onChange={(e) =>
                          setAddress((a) => ({
                            ...a,
                            city: e.target.value,
                            barangay: "",
                          }))
                        }
                      >
                        <option value="">
                          {!address.province
                            ? "Select province first"
                            : addressLoading
                              ? "Loading…"
                              : "Select city"}
                        </option>
                        {cities.map((c) => (
                          <option key={c.code} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </SearchableSelect>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lip-brgy">Barangay</Label>
                      <SearchableSelect
                        id="lip-brgy"
                        className={selectClass}
                        disabled={!address.city || addressLoading}
                        value={address.barangay}
                        onChange={(e) =>
                          setAddress((a) => ({
                            ...a,
                            barangay: e.target.value,
                          }))
                        }
                      >
                        <option value="">
                          {!address.city
                            ? "Select city first"
                            : addressLoading
                              ? "Loading…"
                              : "Select barangay"}
                        </option>
                        {barangays.map((b) => (
                          <option key={b.code} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </SearchableSelect>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="lip-line">Street / unit / landmarks</Label>
                      <Input
                        id="lip-line"
                        value={address.line}
                        onChange={(e) =>
                          setAddress((a) => ({ ...a, line: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lip-mobile">Mobile (PH)</Label>
                    <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        +63
                      </span>
                      <Input
                        id="lip-mobile"
                        className="border-0 px-0 shadow-none focus-visible:ring-0"
                        inputMode="numeric"
                        placeholder="9XX XXX XXXX"
                        value={formatPhLocalSpaced(contactMobile10)}
                        onChange={(e) =>
                          setContactMobile10(
                            normalizePhMobile10(e.target.value).slice(0, 10)
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lip-tin">TIN</Label>
                    <Input
                      id="lip-tin"
                      inputMode="numeric"
                      placeholder="000-000-000-000"
                      value={formatTinDisplay(tinDigits)}
                      onChange={(e) =>
                        setTinDigits(normalizeTinDigits(e.target.value))
                      }
                    />
                  </div>
                </div>

                {historyRows.length > 0 ? (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold">
                        Prior lipatan (this body)
                      </h3>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[420px] border-collapse text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 pr-2 font-medium">From</th>
                              <th className="pb-2 pr-2 font-medium">To</th>
                              <th className="pb-2 pr-2 font-medium">Date</th>
                              <th className="pb-2 font-medium">Document</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyRows.map((h, i) => (
                              <tr
                                key={`${h.transferredAt}-${i}`}
                                className="border-b last:border-0"
                              >
                                <td className="py-2 pr-2 align-top">
                                  {historyFromLabel(h)}
                                </td>
                                <td className="py-2 pr-2 align-top">
                                  {historyToLabel(h)}
                                </td>
                                <td className="py-2 pr-2 align-top tabular-nums text-muted-foreground">
                                  {formatHistoryDate(h.transferredAt)}
                                </td>
                                <td className="py-2 align-top">
                                  {(h.documentUrl ?? "").trim() ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="gap-1"
                                      onClick={() =>
                                        setViewDocUrl(
                                          (h.documentUrl ?? "").trim()
                                        )
                                      }
                                    >
                                      <Eye className="size-4" />
                                      View
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="mt-auto flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSheetOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-black text-white hover:bg-black/90"
                  >
                    {submitting ? "Processing…" : "Complete lipatan"}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a member record to continue.
            </p>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete lipatan?</DialogTitle>
            <DialogDescription>
              {sheetMember ? (
                <>
                  Body <span className="font-medium">{sheetMember.bodyNumber}</span>{" "}
                  will be assigned to{" "}
                  <span className="font-medium">
                    {displayFullName({
                      first: fullName.first.trim(),
                      middle: fullName.middle.trim(),
                      last: fullName.last.trim(),
                      suffix: fullName.suffix.trim(),
                    })}
                  </span>
                  . Share capital will be reduced by ₱
                  {LIPATAN_SHARE_CAPITAL_DEDUCTION.toLocaleString("en-PH")}{" "}
                  (from Butaw-based available balance).
                  {lipatanDocumentUrl.trim() ? (
                    <>
                      {" "}
                      A lipatan document is attached.
                    </>
                  ) : null}
                </>
              ) : (
                "Confirm to save this lipatan to the database."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitting}
              className="bg-black text-white hover:bg-black/90"
              onClick={() => void confirmCompleteLipatan()}
            >
              {submitting ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
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
            <DialogTitle>Document viewer</DialogTitle>
            <DialogDescription>
              Preview the uploaded document.
            </DialogDescription>
          </DialogHeader>
          {viewDocUrl ? (
            <div className="max-h-[70vh] overflow-auto rounded border">
              <LipatanDocumentPreview url={viewDocUrl} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}
