"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Download, Eye, Filter, Pencil, Plus, Search, Trash2, User, X } from "lucide-react"

import type {
  Member,
  MemberAddress,
  MemberFinancials,
  MemberFullName,
} from "@/lib/member-types"
import {
  DEFAULT_PROFILE_IMAGE,
  STATIC_MEMBER_FINANCIALS,
} from "@/lib/member-types"
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
  type PsgcProvince,
  type PsgcCity,
  type PsgcBarangay,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAppToast } from "@/components/app-toast-provider"
import { MemberAvatarUpload } from "@/components/member-avatar-upload"
import { cn } from "@/lib/utils"
import {
  createMember,
  deleteMember,
  fetchMembers,
  updateMember,
  type MemberCreatePayload,
} from "@/lib/members-api"
import { fetchDrivers } from "@/lib/drivers-api"
import { fetchLoans } from "@/lib/loans-api"
import { fetchSavingsRecords } from "@/lib/savings-api"
import { fetchButawRecords } from "@/lib/butaw-api"
import { fetchArkilahan } from "@/lib/arkilahan-api"
import type { Loan } from "@/lib/loan-types"
import type { SavingsRecord } from "@/lib/savings-types"
import type { ButawRecord } from "@/lib/butaw-types"
import type { Arkilahan } from "@/lib/arkilahan-types"
import {
  getMemberFinancialSnapshot,
  maxLipatanTransferredAt,
} from "@/lib/member-financial-records-display"
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
import { formatExportDateTime } from "@/lib/csv-export"
import { SiteHeader } from "@/components/site-header"

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

const selectClass = cn(
  "flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm disabled:cursor-not-allowed"
)

function capitalizeFirstLetter(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function displayFullName(n: MemberFullName): string {
  if (!n.last.trim() && !n.first.trim()) return "—"
  const firstName = capitalizeFirstLetter(n.first.trim())
  const lastName = capitalizeFirstLetter(n.last.trim())
  const head = lastName
    ? `${lastName}, ${firstName}`.trim()
    : firstName
  const suf = n.suffix.trim()
  return suf ? `${head} ${suf}`.trim() : head
}

function initials(n: MemberFullName): string {
  const a = n.first.trim().charAt(0)
  const b = n.last.trim().charAt(0)
  if (a || b) return (a + b).toUpperCase()
  return "?"
}

function formatBirthdayLong(iso: string): string {
  if (!iso) return "—"
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-PH", { dateStyle: "long" })
}

function formatDateLong(iso: string): string {
  if (!iso) return "—"
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-PH", { dateStyle: "medium" })
}

function viewRow(label: string, value: string) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  )
}

function MemberFinancialRecordsList({
  memberId,
  loans,
  savingsRecords,
  butawRecords,
  carriedShareCapital,
  financialRecordsAfterIso,
  onNavigateFinancialRecords,
}: {
  memberId: string | null
  loans: Loan[]
  savingsRecords: SavingsRecord[]
  butawRecords: ButawRecord[]
  carriedShareCapital?: number
  /** Hide pre–lipatan rows from snapshot (previous operator). */
  financialRecordsAfterIso?: string | null
  onNavigateFinancialRecords: (
    section: "regular" | "emergency" | "savings" | "butaw",
    loanId?: string | null
  ) => void
}) {
  const snap = memberId
    ? getMemberFinancialSnapshot(
        memberId,
        loans,
        savingsRecords,
        butawRecords,
        { carriedShareCapital, financialRecordsAfterIso }
      )
    : {
        regularLoan: "—",
        emergencyLoan: "—",
        savings: "—",
        butaw: "—",
        regularLoanId: null,
        emergencyLoanId: null,
        hasSavingsRecord: false,
        hasButawRecord: false,
        hasAnyFinancialRecord: false,
      }
  const rows: {
    label: string
    value: string
    canView: boolean
    onView: () => void
  }[] = [
    {
      label: "Regular loan",
      value: snap.regularLoan,
      canView: Boolean(snap.regularLoanId),
      onView: () => onNavigateFinancialRecords("regular", snap.regularLoanId),
    },
    {
      label: "Emergency loan",
      value: snap.emergencyLoan,
      canView: Boolean(snap.emergencyLoanId),
      onView: () =>
        onNavigateFinancialRecords("emergency", snap.emergencyLoanId),
    },
    {
      label: "Savings",
      value: snap.savings,
      canView: snap.hasSavingsRecord,
      onView: () => onNavigateFinancialRecords("savings"),
    },
    {
      label: "Butaw",
      value: snap.butaw,
      canView: snap.hasButawRecord,
      onView: () => onNavigateFinancialRecords("butaw"),
    },
  ]

  return (
    <ul className="mt-3 grid gap-2 text-sm">
      {rows.map((row) => (
        <li
          key={row.label}
          className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
        >
          <span className="shrink-0 text-muted-foreground">{row.label}</span>
          <span className="flex items-center gap-3 text-right text-sm font-medium">
            <span className="tabular-nums break-all">{row.value}</span>
            {row.canView ? (
              <button
                type="button"
                className="inline-flex cursor-pointer items-center rounded-md bg-black px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-black/90"
                onClick={row.onView}
              >
                View
              </button>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function MemberListPage() {
  const router = useRouter()
  const { showToast } = useAppToast()
  const [members, setMembers] = React.useState<Member[]>([])
  const [loans, setLoans] = React.useState<Loan[]>([])
  const [savingsRecords, setSavingsRecords] = React.useState<SavingsRecord[]>(
    []
  )
  const [butawRecords, setButawRecords] = React.useState<ButawRecord[]>([])
  const [arkilahanRecords, setArkilahanRecords] = React.useState<Arkilahan[]>([])
  const [drivers, setDrivers] = React.useState<any[]>([])
  const [driverCounts, setDriverCounts] = React.useState<Record<string, number>>({})
  const [viewDriversForBody, setViewDriversForBody] = React.useState<string | null>(null)
  const [viewImageSrc, setViewImageSrc] = React.useState<string | null>(null)
  const [listLoading, setListLoading] = React.useState(true)
  const [listError, setListError] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [savePending, setSavePending] = React.useState(false)
  const [saveConfirmOpen, setSaveConfirmOpen] = React.useState(false)
  const [pendingSavePayload, setPendingSavePayload] =
    React.useState<MemberCreatePayload | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<Member | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)
  const [viewMember, setViewMember] = React.useState<Member | null>(null)
  const [arkilahanHistoryOpen, setArkilahanHistoryOpen] = React.useState(false)
  const [viewArkilahanDocUrl, setViewArkilahanDocUrl] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [filters, setFilters] = React.useState({
    name: "",
    bodyNumber: "",
    age: "",
    contact: "",
    address: "",
    precinctNumber: "",
  })
  const itemsPerPage = 10

  const [bodyNumber, setBodyNumber] = React.useState("")
  const [precinctNumber, setPrecinctNumber] = React.useState("")
  const [fullName, setFullName] = React.useState<MemberFullName>(emptyName)
  const [birthday, setBirthday] = React.useState("")
  const [address, setAddress] = React.useState<MemberAddress>(emptyAddress)
  const [contactMobile10, setContactMobile10] = React.useState("")
  const [tinDigits, setTinDigits] = React.useState("")
  const [profileImageSrc, setProfileImageSrc] =
    React.useState<string>(DEFAULT_PROFILE_IMAGE)
  const [financialsDisplay, setFinancialsDisplay] =
    React.useState<MemberFinancials>(STATIC_MEMBER_FINANCIALS)

  const [provinces, setProvinces] = React.useState<AddressOption[]>([])
  const [cities, setCities] = React.useState<AddressOption[]>([])
  const [barangays, setBarangays] = React.useState<AddressOption[]>([])
  const [addressLoading, setAddressLoading] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setListLoading(true)
    setListError(null)
    Promise.all([
      fetchMembers(),
      fetchDrivers(),
      fetchLoans(),
      fetchSavingsRecords(),
      fetchButawRecords(),
      fetchArkilahan(),
    ])
      .then(
        ([
          membersData,
          driversData,
          loansData,
          savingsData,
          butawData,
          arkilahanData,
        ]) => {
        if (!cancelled) {
          setMembers(membersData)
          setDrivers(driversData)
          setLoans(loansData)
          setSavingsRecords(savingsData)
          setButawRecords(butawData)
          setArkilahanRecords(arkilahanData)
          const counts: Record<string, number> = {}
          driversData.forEach((driver) => {
            counts[driver.bodyNumber] = (counts[driver.bodyNumber] || 0) + 1
          })
          setDriverCounts(counts)
        }
      })
      .catch((e: unknown) => {
        const msg =
          e instanceof Error ? e.message : "Could not load members."
        if (!cancelled) {
          setListError(msg)
          showToast(msg, "error")
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showToast])

  const formAge = React.useMemo(
    () => computeAgeFromBirthDate(birthday),
    [birthday]
  )

  const filteredMembers = React.useMemo(() => {
    return members.filter((m) => {
      const fullName = displayFullName(m.fullName).toLowerCase()
      const bodyNumber = m.bodyNumber.toLowerCase()
      const age = computeAgeFromBirthDate(m.birthday)?.toString() || ""
      const contact = formatPhMobileDisplay(m.contactMobile10).toLowerCase()
      const address = [m.address.barangay, m.address.city, m.address.province]
        .filter(Boolean)
        .join(", ")
        .toLowerCase()
      const precinct = (m.precinctNumber || "").toLowerCase()

      return (
        (!filters.name || fullName.includes(filters.name.toLowerCase())) &&
        (!filters.bodyNumber || bodyNumber.includes(filters.bodyNumber.toLowerCase())) &&
        (!filters.age || age.includes(filters.age)) &&
        (!filters.contact || contact.includes(filters.contact.toLowerCase())) &&
        (!filters.address || address.includes(filters.address.toLowerCase())) &&
        (!filters.precinctNumber ||
          precinct.includes(filters.precinctNumber.toLowerCase()))
      )
    })
  }, [members, filters])

  function clearFilters() {
    setFilters({
      name: "",
      bodyNumber: "",
      age: "",
      contact: "",
      address: "",
      precinctNumber: "",
    })
    setCurrentPage(1)
  }

  const hasActiveFilters = Object.values(filters).some((v) => v.trim().length > 0)

  const getMemberExportSections = React.useCallback((): CsvExportSection[] => {
    const filterParts: string[] = []
    if (filters.name.trim())
      filterParts.push(`Name contains "${filters.name.trim()}"`)
    if (filters.bodyNumber.trim())
      filterParts.push(`Body # contains "${filters.bodyNumber.trim()}"`)
    if (filters.age.trim())
      filterParts.push(`Age contains "${filters.age.trim()}"`)
    if (filters.contact.trim())
      filterParts.push(`Contact contains "${filters.contact.trim()}"`)
    if (filters.address.trim())
      filterParts.push(`Address contains "${filters.address.trim()}"`)
    if (filters.precinctNumber.trim())
      filterParts.push(`Precinct # contains "${filters.precinctNumber.trim()}"`)

    const headers = [
      "Body #",
      "Precinct #",
      "Full name",
      "First name",
      "Middle name",
      "Last name",
      "Suffix",
      "Birthday",
      "Age",
      "Province",
      "City / municipality",
      "Barangay",
      "Street / unit / landmarks",
      "Mobile (PH)",
      "TIN",
      "Drivers count",
      "Driver names",
      "Regular loan",
      "Emergency loan",
      "Savings",
      "Butaw",
      "Arkilahan (latest name)",
      "Arkilahan (latest due)",
      "Lipatan transfers",
    ] as const

    const rows = filteredMembers.map((m) => {
      const afterIso = maxLipatanTransferredAt(m.lipatanHistory)
      const snap = getMemberFinancialSnapshot(
        m.id,
        loans,
        savingsRecords,
        butawRecords,
        {
          carriedShareCapital: m.financials?.shareCapital ?? 0,
          financialRecordsAfterIso: afterIso,
        }
      )
      const memberDrivers = drivers.filter((d) => d.bodyNumber === m.bodyNumber)
      const driverNames = memberDrivers
        .map((d) => displayFullName(d.fullName))
        .join("; ")
      const memberArk = [...arkilahanRecords]
        .filter((r) => r.bodyNumber === m.bodyNumber)
        .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
      const ark0 = memberArk[0]
      const age = computeAgeFromBirthDate(m.birthday)
      return [
        m.bodyNumber,
        m.precinctNumber,
        displayFullName(m.fullName),
        m.fullName.first,
        m.fullName.middle,
        m.fullName.last,
        m.fullName.suffix,
        m.birthday,
        age === null ? "" : String(age),
        m.address.province,
        m.address.city,
        m.address.barangay,
        m.address.line,
        formatPhMobileDisplay(m.contactMobile10),
        formatTinDisplay(m.tinDigits),
        String(driverCounts[m.bodyNumber] ?? memberDrivers.length),
        driverNames,
        snap.regularLoan,
        snap.emergencyLoan,
        snap.savings,
        snap.butaw,
        ark0?.name ?? "",
        ark0?.dueDate ?? "",
        String(m.lipatanHistory?.length ?? 0),
      ]
    })

    return [
      {
        title: "Members — export summary",
        kind: "keyValues",
        pairs: [
          ["Exported at", formatExportDateTime()],
          ["Row count", String(filteredMembers.length)],
          [
            "Filters",
            filterParts.length ? filterParts.join("; ") : "None (all members)",
          ],
        ],
      },
      {
        title: "Member details",
        kind: "table",
        headers: [...headers],
        rows,
      },
    ]
  }, [
    filteredMembers,
    filters,
    loans,
    savingsRecords,
    butawRecords,
    arkilahanRecords,
    drivers,
    driverCounts,
  ])

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
    const provinceCode = provinces.find(p => p.name === address.province)?.code
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
    const cityCode = cities.find(c => c.name === address.city)?.code
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

  function openCreate() {
    setEditingId(null)
    setBodyNumber("")
    setPrecinctNumber("")
    setFullName(emptyName())
    setBirthday("")
    setAddress(emptyAddress())
    setContactMobile10("")
    setTinDigits("")
    setProfileImageSrc(DEFAULT_PROFILE_IMAGE)
    setFinancialsDisplay(STATIC_MEMBER_FINANCIALS)
    setSheetOpen(true)
  }

  function openEdit(m: Member) {
    setEditingId(m.id)
    setBodyNumber(m.bodyNumber)
    setPrecinctNumber(m.precinctNumber)
    setFullName({ ...m.fullName })
    setBirthday(m.birthday)
    setAddress({ ...m.address })
    setContactMobile10(m.contactMobile10)
    setTinDigits(m.tinDigits)
    setProfileImageSrc(m.profileImageSrc || DEFAULT_PROFILE_IMAGE)
    setFinancialsDisplay({
      ...STATIC_MEMBER_FINANCIALS,
      ...(m.financials ?? {}),
    })
    setSheetOpen(true)
  }

  async function confirmDeleteMember() {
    if (!deleteTarget) return
    setDeletePending(true)
    try {
      await deleteMember(deleteTarget.id)
      setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id))
      showToast("Member removed", "success")
      setDeleteTarget(null)
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Could not delete member."
      showToast(msg, "error")
    } finally {
      setDeletePending(false)
    }
  }

  async function confirmSaveMember() {
    const basePayload = pendingSavePayload
    const id = editingId
    if (!basePayload) return
    setSavePending(true)
    try {
      if (id) {
        const updated = await updateMember(id, basePayload)
        setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)))
        showToast("Member updated", "success")
      } else {
        const created = await createMember(basePayload)
        setMembers((prev) => [created, ...prev])
        showToast("Member saved", "success")
      }
      setSaveConfirmOpen(false)
      setPendingSavePayload(null)
      setSheetOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed."
      showToast(msg, "error")
    } finally {
      setSavePending(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!bodyNumber.trim()) {
      showToast("Body / Prangkisa number is required.", "error")
      return
    }
    if (!precinctNumber.trim()) {
      showToast("Precinct number is required.", "error")
      return
    }
    if (!fullName.first.trim() || !fullName.last.trim()) {
      showToast("First and last name are required.", "error")
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
        "Complete province, city, barangay, and address line.",
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

    const financials = financialsDisplay
    const basePayload: MemberCreatePayload = {
      bodyNumber: bodyNumber.trim(),
      precinctNumber: precinctNumber.trim(),
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
      financials,
    }
    setPendingSavePayload(basePayload)
    setSaveConfirmOpen(true)
  }

  const memberExportButton = (
    <PageDataExportButton
      fileBaseName="members"
      moduleName="members"
      disabled={listLoading || filteredMembers.length === 0}
      getSections={getMemberExportSections}
    />
  )

  return (
    <>
      <SiteHeader trailing={memberExportButton} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Add members with ID numbers, complete name, address, and contact.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
        >
          <Plus className="size-4" />
          Add member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="size-4" />
                <span>Filter Members</span>
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
            <div className="grid grid-cols-6 gap-2">
              <Input
                placeholder="Name"
                value={filters.name}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, name: e.target.value }))
                  setCurrentPage(1)
                }}
                className="text-sm"
              />
              <Input
                placeholder="Body #"
                value={filters.bodyNumber}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, bodyNumber: e.target.value }))
                  setCurrentPage(1)
                }}
                className="text-sm"
              />
              <Input
                placeholder="Age"
                value={filters.age}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, age: e.target.value }))
                  setCurrentPage(1)
                }}
                className="text-sm"
              />
              <Input
                placeholder="Contact"
                value={filters.contact}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, contact: e.target.value }))
                  setCurrentPage(1)
                }}
                className="text-sm"
              />
              <Input
                placeholder="Address"
                value={filters.address}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, address: e.target.value }))
                  setCurrentPage(1)
                }}
                className="text-sm"
              />
              <Input
                placeholder="Precinct #"
                value={filters.precinctNumber}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, precinctNumber: e.target.value }))
                  setCurrentPage(1)
                }}
                className="text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
          {listLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading members…
            </p>
          ) : listError ? (
            <p className="py-8 text-center text-sm text-red-600">
              {listError}
            </p>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No members yet. Use &quot;Add member&quot; to create one.
            </p>
          ) : filteredMembers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No members found matching your search.
            </p>
          ) : (
            <>
              {(() => {
                const totalPages = Math.ceil(filteredMembers.length / itemsPerPage)
                const startIndex = (currentPage - 1) * itemsPerPage
                const endIndex = startIndex + itemsPerPage
                const paginatedMembers = filteredMembers.slice(startIndex, endIndex)
                return (
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-3 font-medium">Member</th>
                  <th className="pb-3 pr-3 font-medium">Body #</th>
                  <th className="pb-3 pr-3 font-medium">Age</th>
                  <th className="pb-3 pr-3 font-medium">Contact #</th>
                  <th className="pb-3 pr-3 font-medium">Address</th>
                  <th className="pb-3 pr-3 font-medium">Precinct #</th>
                  <th className="pb-3 pr-3 font-medium">Drivers</th>
                  <th className="pb-3 pl-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMembers.map((m) => {
                  const age = computeAgeFromBirthDate(m.birthday)
                  const addressDisplay = [m.address.barangay, m.address.city, m.address.province]
                    .filter(Boolean)
                    .join(", ")
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <Avatar 
                            className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => m.profileImageSrc && setViewImageSrc(m.profileImageSrc)}
                          >
                            <AvatarImage
                              src={m.profileImageSrc || undefined}
                              alt=""
                              className="object-cover"
                            />
                            <AvatarFallback>{initials(m.fullName)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {displayFullName(m.fullName)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">{m.bodyNumber}</td>
                      <td className="py-3 pr-3 tabular-nums">
                        {age ?? "—"}
                      </td>
                      <td className="py-3 pr-3 tabular-nums text-muted-foreground">
                        {formatPhMobileDisplay(m.contactMobile10)}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {addressDisplay || "—"}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {m.precinctNumber || "—"}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="tabular-nums hover:underline cursor-pointer"
                            onClick={() => setViewDriversForBody(m.bodyNumber)}
                          >
                            {driverCounts[m.bodyNumber] || 0}
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 rounded-full bg-black text-white hover:bg-black/90 hover:text-white"
                            aria-label="Add driver"
                            onClick={() => router.push(`/driver?bodyNumber=${encodeURIComponent(m.bodyNumber)}`)}
                          >
                            <Plus className="size-2.5" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewMember(m)}
                            aria-label="View member"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(m)}
                            aria-label="Edit member"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(m)}
                            aria-label="Remove member"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
              )})()}
              {filteredMembers.length > itemsPerPage && (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {Math.ceil(filteredMembers.length / itemsPerPage)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="size-4" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredMembers.length / itemsPerPage), p + 1))}
                      disabled={currentPage === Math.ceil(filteredMembers.length / itemsPerPage)}
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
            setSaveConfirmOpen(false)
            setPendingSavePayload(null)
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <User className="size-5" />
              {editingId ? "Edit member" : "Add member"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col items-center gap-3 pb-6">
            <div className="relative">
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
            </div>
            <MemberAvatarUpload
              onUploaded={(url) => setProfileImageSrc(url)}
              onToastError={(msg) => showToast(msg, "error")}
            />
          </div>

          <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 pb-8">
            <div>
              <h3 className="text-sm font-semibold">Identification</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bodyNumber">Body / Prangkisa number</Label>
                  <Input
                    id="bodyNumber"
                    value={bodyNumber}
                    onChange={(e) => setBodyNumber(e.target.value)}
                    placeholder="Same number for body and prangkisa"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precinctNumber">Precinct number</Label>
                  <Input
                    id="precinctNumber"
                    value={precinctNumber}
                    onChange={(e) => setPrecinctNumber(e.target.value)}
                    placeholder="Precinct number"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-semibold">Full name</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first">First name</Label>
                  <Input
                    id="first"
                    value={fullName.first}
                    onChange={(e) =>
                      setFullName((n) => ({ ...n, first: e.target.value }))
                    }
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middle">Middle name</Label>
                  <Input
                    id="middle"
                    value={fullName.middle}
                    onChange={(e) =>
                      setFullName((n) => ({ ...n, middle: e.target.value }))
                    }
                    autoComplete="additional-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last">Last name</Label>
                  <Input
                    id="last"
                    value={fullName.last}
                    onChange={(e) =>
                      setFullName((n) => ({ ...n, last: e.target.value }))
                    }
                    autoComplete="family-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suffix">Suffix</Label>
                  <SearchableSelect
                    id="suffix"
                    className={selectClass}
                    value={fullName.suffix}
                    onChange={(e) =>
                      setFullName((n) => ({ ...n, suffix: e.target.value }))
                    }
                  >
                    {SUFFIX_OPTIONS.map((s) => (
                      <option key={s || "none"} value={s}>
                        {s || "— None —"}
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-semibold">Birthday</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="birthday">Date of birth</Label>
                  <Input
                    id="birthday"
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="cursor-pointer [color-scheme:light]"
                    onPointerDown={(e) => {
                      const el = e.currentTarget
                      if (typeof el.showPicker === "function") {
                        try {
                          el.showPicker()
                        } catch {
                          el.focus()
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return
                      e.preventDefault()
                      const el = e.currentTarget
                      if (typeof el.showPicker === "function") {
                        try {
                          el.showPicker()
                        } catch {
                          el.focus()
                        }
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Age</Label>
                  <Input
                    readOnly
                    tabIndex={-1}
                    value={
                      formAge === null ? "" : `${formAge} years`
                    }
                    placeholder="Auto from birthday"
                    className="bg-muted/50"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-semibold">Address</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="province">Province</Label>
                  <SearchableSelect
                    id="province"
                    className={selectClass}
                    value={address.province}
                    disabled={addressLoading && provinces.length === 0}
                    onChange={(e) => {
                      setAddress((a) => ({
                        ...a,
                        province: e.target.value,
                        city: "",
                        barangay: "",
                      }))
                    }}
                  >
                    <option value="">
                      {provinces.length === 0 && addressLoading ? "Loading..." : "Select province"}
                    </option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City / municipality</Label>
                  <SearchableSelect
                    id="city"
                    className={selectClass}
                    disabled={!address.province || addressLoading}
                    value={address.city}
                    onChange={(e) => {
                      setAddress((a) => ({
                        ...a,
                        city: e.target.value,
                        barangay: "",
                      }))
                    }}
                  >
                    <option value="">
                      {!address.province
                        ? "Select province first"
                        : addressLoading
                          ? "Loading..."
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
                  <Label htmlFor="barangay">Barangay</Label>
                  <SearchableSelect
                    id="barangay"
                    className={selectClass}
                    disabled={!address.city || addressLoading}
                    value={address.barangay}
                    onChange={(e) => {
                      setAddress((a) => ({
                        ...a,
                        barangay: e.target.value,
                      }))
                    }}
                  >
                    <option value="">
                      {!address.city
                        ? "Select city first"
                        : addressLoading
                          ? "Loading..."
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
                  <Label htmlFor="line">Street / unit / landmarks</Label>
                  <Input
                    id="line"
                    value={address.line}
                    onChange={(e) =>
                      setAddress((a) => ({ ...a, line: e.target.value }))
                    }
                    placeholder="House no., street, subdivision, etc."
                    autoComplete="street-address"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile (PH)</Label>
                <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    +63
                  </span>
                  <Input
                    id="mobile"
                    className="border-0 px-0 shadow-none focus-visible:ring-0"
                    inputMode="numeric"
                    autoComplete="tel"
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
                <Label htmlFor="tin">Tax Identification Number</Label>
                <Input
                  id="tin"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000-000-000-000"
                  value={formatTinDisplay(tinDigits)}
                  onChange={(e) =>
                    setTinDigits(normalizeTinDigits(e.target.value))
                  }
                />
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-semibold">Financial records</h3>
              <MemberFinancialRecordsList
                memberId={editingId}
                loans={loans}
                savingsRecords={savingsRecords}
                butawRecords={butawRecords}
                carriedShareCapital={
                  editingId
                    ? (members.find((m) => m.id === editingId)?.financials
                        .shareCapital ?? 0)
                    : undefined
                }
                financialRecordsAfterIso={maxLipatanTransferredAt(
                  editingId
                    ? members.find((m) => m.id === editingId)?.lipatanHistory
                    : undefined
                )}
                onNavigateFinancialRecords={(section, loanId) => {
                  if (section === "savings") {
                    router.push("/financial-records?tab=savings")
                    return
                  }
                  if (section === "butaw") {
                    router.push("/financial-records?tab=butaw")
                    return
                  }
                  const params = new URLSearchParams({
                    tab: "loan",
                    loanType: section,
                  })
                  if (loanId) params.set("loanId", loanId)
                  router.push(`/financial-records?${params.toString()}`)
                }}
              />
            </div>

            <div className="mt-auto flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savePending}
                className="bg-black text-white hover:bg-black/90"
              >
                {savePending
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Save member"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!viewMember}
        onOpenChange={(open) => {
          if (!open) {
            setViewMember(null)
            setArkilahanHistoryOpen(false)
            setViewArkilahanDocUrl("")
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl"
        >
          {viewMember ? (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Eye className="size-5" />
                  Member details
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col items-center gap-3 border-b pb-6">
                <Avatar 
                  className="h-20 w-20 ring-2 ring-border ring-offset-2 ring-offset-background cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => viewMember.profileImageSrc && setViewImageSrc(viewMember.profileImageSrc)}
                >
                  <AvatarImage
                    src={viewMember.profileImageSrc || undefined}
                    alt=""
                    className="object-cover"
                  />
                  <AvatarFallback>
                    {initials(viewMember.fullName)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-center text-lg font-semibold">
                  {displayFullName(viewMember.fullName)}
                </p>
              </div>
              <div className="flex flex-col gap-6 py-6">
                <section>
                  <h3 className="text-sm font-semibold">Identification</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow(
                      "Body / Prangkisa",
                      viewMember.bodyNumber
                    )}
                    {viewRow(
                      "Precinct number",
                      viewMember.precinctNumber
                    )}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Full name</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow("First name", viewMember.fullName.first)}
                    {viewRow("Middle name", viewMember.fullName.middle)}
                    {viewRow("Last name", viewMember.fullName.last)}
                    {viewRow("Suffix", viewMember.fullName.suffix)}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Birthday</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow(
                      "Date of birth",
                      formatBirthdayLong(viewMember.birthday)
                    )}
                    {viewRow(
                      "Age",
                      (() => {
                        const a = computeAgeFromBirthDate(viewMember.birthday)
                        return a === null ? "" : `${a} years`
                      })()
                    )}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Address</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow("Province", viewMember.address.province)}
                    {viewRow("City / municipality", viewMember.address.city)}
                    {viewRow("Barangay", viewMember.address.barangay)}
                    {viewRow(
                      "Street / unit / landmarks",
                      viewMember.address.line
                    )}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Contact &amp; tax</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow(
                      "Mobile (PH)",
                      formatPhMobileDisplay(viewMember.contactMobile10)
                    )}
                    {viewRow(
                      "TIN",
                      formatTinDisplay(viewMember.tinDigits)
                    )}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Drivers</h3>
                  {(() => {
                    const memberDrivers = drivers.filter(d => d.bodyNumber === viewMember.bodyNumber)
                    return memberDrivers.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">None</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {memberDrivers.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2"
                          >
                            <Avatar 
                              className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => d.profileImageSrc && setViewImageSrc(d.profileImageSrc)}
                            >
                              <AvatarImage
                                src={d.profileImageSrc || undefined}
                                alt=""
                                className="object-cover"
                              />
                              <AvatarFallback>{initials(d.fullName)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {displayFullName(d.fullName)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )
                  })()}
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Arkilahan</h3>
                  {(() => {
                    const memberArkilahan = arkilahanRecords
                      .filter((r) => r.bodyNumber === viewMember.bodyNumber)
                      .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
                    if (memberArkilahan.length === 0) {
                      return (
                        <p className="mt-3 text-sm text-muted-foreground">-</p>
                      )
                    }
                    const today = new Date().toISOString().slice(0, 10)
                    const active =
                      [...memberArkilahan]
                        .filter((r) => r.dueDate >= today)
                        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ??
                      memberArkilahan[0]
                    const history = memberArkilahan.filter((r) => r.id !== active.id)
                    return (
                      <div className="mt-3 space-y-3">
                        <div className="rounded-md border bg-muted/30 p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-muted-foreground">Active</p>
                            {history.length > 0 ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => setArkilahanHistoryOpen(true)}
                              >
                                View history
                              </Button>
                            ) : null}
                          </div>
                          <p className="mt-1">{active.name || "-"}</p>
                          {(active.documentUrl ?? "").trim() ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-2 h-7 px-2 text-xs"
                              onClick={() =>
                                setViewArkilahanDocUrl(
                                  (active.documentUrl ?? "").trim()
                                )
                              }
                            >
                              <Eye className="mr-1 size-3" />
                              View contract
                            </Button>
                          ) : null}
                          <p className="mt-1 font-medium tabular-nums">
                            {active.fee.toLocaleString("en-PH", {
                              style: "currency",
                              currency: "PHP",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Due {formatDateLong(active.dueDate)} • {active.termValue}{" "}
                            {active.termUnit}
                          </p>
                        </div>
                      </div>
                    )
                  })()}
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Financial records</h3>
                  <MemberFinancialRecordsList
                    memberId={viewMember.id}
                    loans={loans}
                    savingsRecords={savingsRecords}
                    butawRecords={butawRecords}
                    carriedShareCapital={
                      viewMember.financials?.shareCapital ?? 0
                    }
                    financialRecordsAfterIso={maxLipatanTransferredAt(
                      viewMember.lipatanHistory
                    )}
                    onNavigateFinancialRecords={(section, loanId) => {
                      if (section === "savings") {
                        router.push("/financial-records?tab=savings")
                        return
                      }
                      if (section === "butaw") {
                        router.push("/financial-records?tab=butaw")
                        return
                      }
                      const params = new URLSearchParams({
                        tab: "loan",
                        loanType: section,
                      })
                      if (loanId) params.set("loanId", loanId)
                      router.push(`/financial-records?${params.toString()}`)
                    }}
                  />
                </section>
                {(viewMember.lipatanHistory?.length ?? 0) > 0 ? (
                  <>
                    <Separator />
                    <section>
                      <h3 className="text-sm font-semibold">Lipatan history</h3>
                      <ul className="mt-3 space-y-3 text-sm">
                        {[...(viewMember.lipatanHistory ?? [])]
                          .reverse()
                          .map((h, i) => (
                            <li
                              key={`${h.transferredAt}-${i}`}
                              className="rounded-md border bg-muted/30 p-3"
                            >
                              <p className="text-xs text-muted-foreground">
                                {new Date(h.transferredAt).toLocaleString(
                                  "en-PH",
                                  {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  }
                                )}
                              </p>
                              <p className="mt-1 font-medium">
                                {h.fromOperatorName ??
                                  displayFullName(h.previousPersonal.fullName)}{" "}
                                →{" "}
                                {h.toOperatorName ?? "—"}
                              </p>
                            </li>
                          ))}
                      </ul>
                    </section>
                  </>
                ) : null}
              </div>
              <div className="mt-auto flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setViewMember(null)
                    setArkilahanHistoryOpen(false)
                    setViewArkilahanDocUrl("")
                  }}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  className="gap-2 bg-black text-white hover:bg-black/90"
                  onClick={() => {
                    const m = viewMember
                    setViewMember(null)
                    openEdit(m)
                  }}
                >
                  <Pencil className="size-4" />
                  Edit member
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog
        open={arkilahanHistoryOpen}
        onOpenChange={(open) => setArkilahanHistoryOpen(open)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Arkilahan history</DialogTitle>
            <DialogDescription>
              {viewMember
                ? `Body #${viewMember.bodyNumber}`
                : "Arkilahan records"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto py-1">
            {(() => {
              if (!viewMember) return null
              const memberArkilahan = arkilahanRecords
                .filter((r) => r.bodyNumber === viewMember.bodyNumber)
                .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
              if (memberArkilahan.length <= 1) {
                return (
                  <p className="text-sm text-muted-foreground">No history yet.</p>
                )
              }
              const today = new Date().toISOString().slice(0, 10)
              const active =
                [...memberArkilahan]
                  .filter((r) => r.dueDate >= today)
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ??
                memberArkilahan[0]
              const history = memberArkilahan.filter((r) => r.id !== active.id)
              return history.map((r) => (
                <div
                  key={r.id}
                  className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
                >
                  <p>{r.name || "-"}</p>
                  {(r.documentUrl ?? "").trim() ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 px-2 text-xs"
                      onClick={() =>
                        setViewArkilahanDocUrl((r.documentUrl ?? "").trim())
                      }
                    >
                      <Eye className="mr-1 size-3" />
                      View contract
                    </Button>
                  ) : null}
                  <p className="font-medium tabular-nums">
                    {r.fee.toLocaleString("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Due {formatDateLong(r.dueDate)} • {r.termValue} {r.termUnit}
                  </p>
                </div>
              ))
            })()}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setArkilahanHistoryOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewArkilahanDocUrl)}
        onOpenChange={(open) => {
          if (!open) setViewArkilahanDocUrl("")
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Arkilahan contract</DialogTitle>
            <DialogDescription>Preview the uploaded contract.</DialogDescription>
          </DialogHeader>
          {viewArkilahanDocUrl ? (
            <div className="mt-2">
              {viewArkilahanDocUrl.toLowerCase().includes(".pdf") ? (
                <iframe
                  src={viewArkilahanDocUrl}
                  className="h-[70vh] w-full rounded border"
                  title="Arkilahan contract"
                />
              ) : (
                <img
                  src={viewArkilahanDocUrl}
                  alt="Arkilahan contract"
                  className="max-h-[70vh] w-full rounded border object-contain"
                />
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={saveConfirmOpen}
        onOpenChange={(open) => {
          setSaveConfirmOpen(open)
          if (!open) setPendingSavePayload(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Save changes?" : "Save new member?"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? `Update the record for ${displayFullName(pendingSavePayload?.fullName ?? emptyName())} in the database.`
                : "Add this member to the database with the information you entered."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSaveConfirmOpen(false)
                setPendingSavePayload(null)
              }}
              disabled={savePending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-black text-white hover:bg-black/90"
              disabled={savePending}
              onClick={() => void confirmSaveMember()}
            >
              {savePending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Permanently remove ${displayFullName(deleteTarget.fullName)} from the list. This cannot be undone.`
                : null}
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
              onClick={() => void confirmDeleteMember()}
            >
              {deletePending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewDriversForBody}
        onOpenChange={(open) => {
          if (!open) setViewDriversForBody(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Drivers for Body #{viewDriversForBody}</DialogTitle>
            <DialogDescription>
              {(() => {
                const count = viewDriversForBody ? driverCounts[viewDriversForBody] || 0 : 0
                return count === 1 ? "1 driver assigned" : `${count} drivers assigned`
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {viewDriversForBody && (() => {
              const bodyDrivers = drivers.filter(d => d.bodyNumber === viewDriversForBody)
              return bodyDrivers.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">No drivers</p>
              ) : (
                <ul className="space-y-2">
                  {bodyDrivers.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2.5"
                    >
                      <Avatar 
                        className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => d.profileImageSrc && setViewImageSrc(d.profileImageSrc)}
                      >
                        <AvatarImage
                          src={d.profileImageSrc || undefined}
                          alt=""
                          className="object-cover"
                        />
                        <AvatarFallback>{initials(d.fullName)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {displayFullName(d.fullName)}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewDriversForBody(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewImageSrc}
        onOpenChange={(open) => {
          if (!open) setViewImageSrc(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Profile Image</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            {viewImageSrc && (
              <img
                src={viewImageSrc}
                alt="Profile"
                className="max-h-[70vh] w-auto rounded-lg object-contain"
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                if (!viewImageSrc) return
                try {
                  const response = await fetch(viewImageSrc)
                  const blob = await response.blob()
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `profile-image.${blob.type.split("/")[1] || "jpg"}`
                  document.body.appendChild(a)
                  a.click()
                  window.URL.revokeObjectURL(url)
                  document.body.removeChild(a)
                } catch {
                  showToast("Failed to download image", "error")
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}
