"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileUp,
  Filter,
  Pencil,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react"

import type {
  Driver,
  DriverAddress,
  DriverFullName,
} from "@/lib/driver-types"
import { DEFAULT_PROFILE_IMAGE } from "@/lib/driver-types"
import {
  computeAgeFromBirthDate,
  formatPhLocalSpaced,
  formatPhMobileDisplay,
  formatTinDisplay,
  getBodyNumberFormatError,
  getMemberFullNameFormatError,
  isValidPhMobile10,
  isValidTin12,
  normalizeBodyNumber,
  normalizeNamePart,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAppToast } from "@/components/app-toast-provider"
import { MemberAvatarUpload } from "@/components/member-avatar-upload"
import { cn } from "@/lib/utils"
import {
  createDriver,
  deleteDriver,
  fetchDrivers,
  updateDriver,
  type DriverCreatePayload,
} from "@/lib/drivers-api"
import { fetchMembers } from "@/lib/members-api"
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
  parseDriverImportRows,
  type DriverImportRowError,
} from "@/lib/driver-import"
import { createAuditLogEvent } from "@/lib/audit-logs-api"
import { formatAuthActorLabel } from "@/lib/auth-actor"
import { SiteHeader } from "@/components/site-header"
import type { Member } from "@/lib/member-types"

const SUFFIX_OPTIONS = ["", "Jr.", "Sr.", "II", "III", "IV"] as const

const emptyName = (): DriverFullName => ({
  first: "",
  middle: "",
  last: "",
  suffix: "",
})

const emptyAddress = (): DriverAddress => ({
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

function displayFullName(n: DriverFullName): string {
  if (!n.last.trim() && !n.first.trim()) return "—"
  const firstName = capitalizeFirstLetter(n.first.trim())
  const lastName = capitalizeFirstLetter(n.last.trim())
  const head = lastName
    ? `${lastName}, ${firstName}`.trim()
    : firstName
  const suf = n.suffix.trim()
  return suf ? `${head} ${suf}`.trim() : head
}

function initials(n: DriverFullName): string {
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

function viewRow(label: string, value: string) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  )
}

export function DriverListPage() {
  const searchParams = useSearchParams()
  const { showToast } = useAppToast()
  const [drivers, setDrivers] = React.useState<Driver[]>([])
  const [members, setMembers] = React.useState<Member[]>([])
  const [availableBodyNumbers, setAvailableBodyNumbers] = React.useState<string[]>([])
  const [viewMemberForBody, setViewMemberForBody] = React.useState<Member | null>(null)
  const [viewImageSrc, setViewImageSrc] = React.useState<string | null>(null)
  const [listLoading, setListLoading] = React.useState(true)
  const [listError, setListError] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [savePending, setSavePending] = React.useState(false)
  const [saveConfirmOpen, setSaveConfirmOpen] = React.useState(false)
  const [pendingSavePayload, setPendingSavePayload] =
    React.useState<DriverCreatePayload | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<Driver | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)
  const [viewDriver, setViewDriver] = React.useState<Driver | null>(null)
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
  const hasOpenedFromUrl = React.useRef(false)

  const [bodyNumber, setBodyNumber] = React.useState("")
  const [precinctNumber, setPrecinctNumber] = React.useState("")
  const [fullName, setFullName] = React.useState<DriverFullName>(emptyName)
  const [birthday, setBirthday] = React.useState("")
  const [address, setAddress] = React.useState<DriverAddress>(emptyAddress)
  const [contactMobile10, setContactMobile10] = React.useState("")
  const [tinDigits, setTinDigits] = React.useState("")
  const [profileImageSrc, setProfileImageSrc] =
    React.useState<string>(DEFAULT_PROFILE_IMAGE)

  const [provinces, setProvinces] = React.useState<AddressOption[]>([])
  const [cities, setCities] = React.useState<AddressOption[]>([])
  const [barangays, setBarangays] = React.useState<AddressOption[]>([])
  const [addressLoading, setAddressLoading] = React.useState(false)

  const driverImportInputRef = React.useRef<HTMLInputElement>(null)
  const [driverImportBusy, setDriverImportBusy] = React.useState(false)
  const [driverImportReportOpen, setDriverImportReportOpen] =
    React.useState(false)
  const [driverImportReport, setDriverImportReport] = React.useState<{
    created: number
    parseErrors: DriverImportRowError[]
    apiFailures: { excelRow: number; message: string }[]
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setListLoading(true)
    setListError(null)
    Promise.all([fetchDrivers(), fetchMembers()])
      .then(([driversData, membersData]) => {
        if (!cancelled) {
          setDrivers(driversData)
          setMembers(membersData)
          const bodyNums = membersData.map(m => m.bodyNumber).filter(Boolean).sort()
          setAvailableBodyNumbers(bodyNums)
        }
      })
      .catch((e: unknown) => {
        const msg =
          e instanceof Error ? e.message : "Could not load drivers."
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

  React.useEffect(() => {
    const bodyNumParam = searchParams.get("bodyNumber")
    if (bodyNumParam && availableBodyNumbers.length > 0 && !hasOpenedFromUrl.current) {
      hasOpenedFromUrl.current = true
      setEditingId(null)
      setBodyNumber(bodyNumParam)
      setPrecinctNumber("")
      setFullName(emptyName())
      setBirthday("")
      setAddress(emptyAddress())
      setContactMobile10("")
      setTinDigits("")
      setProfileImageSrc(DEFAULT_PROFILE_IMAGE)
      setSheetOpen(true)
    }
  }, [searchParams, availableBodyNumbers])

  const formAge = React.useMemo(
    () => computeAgeFromBirthDate(birthday),
    [birthday]
  )

  const filteredDrivers = React.useMemo(() => {
    return drivers.filter((d) => {
      const fullName = displayFullName(d.fullName).toLowerCase()
      const bodyNumber = d.bodyNumber.toLowerCase()
      const age = computeAgeFromBirthDate(d.birthday)?.toString() || ""
      const contact = formatPhMobileDisplay(d.contactMobile10).toLowerCase()
      const address = [d.address.barangay, d.address.city, d.address.province]
        .filter(Boolean)
        .join(", ")
        .toLowerCase()
      const precinct = (d.precinctNumber || "").toLowerCase()

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
  }, [drivers, filters])

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

  const getDriverExportSections = React.useCallback((): CsvExportSection[] => {
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
      "Body number",
      "Precinct number",
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
      "Operator",
      "Created at",
      "Updated at",
    ] as const

    const rows = filteredDrivers.map((d) => {
      const linked = members.find(
        (m) =>
          normalizeBodyNumber(m.bodyNumber).toLowerCase() ===
          normalizeBodyNumber(d.bodyNumber).toLowerCase()
      )
      const linkedName = linked
        ? displayFullName(linked.fullName as DriverFullName)
        : ""
      const age = computeAgeFromBirthDate(d.birthday)
      return [
        d.bodyNumber,
        d.precinctNumber,
        displayFullName(d.fullName),
        d.fullName.first,
        d.fullName.middle,
        d.fullName.last,
        d.fullName.suffix,
        d.birthday,
        age === null ? "" : String(age),
        d.address.province,
        d.address.city,
        d.address.barangay,
        d.address.line,
        formatPhMobileDisplay(d.contactMobile10),
        formatTinDisplay(d.tinDigits),
        linkedName,
        formatExportDateTimeFromIso(d.createdAt),
        formatExportDateTimeFromIso(d.updatedAt),
      ]
    })

    return [
      {
        title: "Drivers — export summary",
        kind: "keyValues",
        pairs: [
          ["Exported at", formatExportDateTime()],
          ["Row count", String(filteredDrivers.length)],
          [
            "Filters",
            filterParts.length ? filterParts.join("; ") : "None (all drivers)",
          ],
        ],
      },
      {
        title: "Driver details",
        kind: "table",
        headers: [...headers],
        rows,
      },
    ]
  }, [filteredDrivers, filters, members])

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

  function openCreate(prefilledBodyNumber?: string) {
    setEditingId(null)
    setBodyNumber(prefilledBodyNumber || "")
    setPrecinctNumber("")
    setFullName(emptyName())
    setBirthday("")
    setAddress(emptyAddress())
    setContactMobile10("")
    setTinDigits("")
    setProfileImageSrc(DEFAULT_PROFILE_IMAGE)
    setSheetOpen(true)
  }

  function openEdit(d: Driver) {
    setEditingId(d.id)
    setBodyNumber(d.bodyNumber)
    setPrecinctNumber(d.precinctNumber)
    setFullName({ ...d.fullName })
    setBirthday(d.birthday)
    setAddress({ ...d.address })
    setContactMobile10(d.contactMobile10)
    setTinDigits(d.tinDigits)
    setProfileImageSrc(d.profileImageSrc || DEFAULT_PROFILE_IMAGE)
    setSheetOpen(true)
  }

  async function confirmDeleteDriver() {
    if (!deleteTarget) return
    setDeletePending(true)
    try {
      await deleteDriver(deleteTarget.id)
      setDrivers((prev) => prev.filter((d) => d.id !== deleteTarget.id))
      showToast("Driver removed", "success")
      setDeleteTarget(null)
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Could not delete driver."
      showToast(msg, "error")
    } finally {
      setDeletePending(false)
    }
  }

  async function confirmSaveDriver() {
    const basePayload = pendingSavePayload
    const id = editingId
    if (!basePayload) return
    setSavePending(true)
    try {
      if (id) {
        const updated = await updateDriver(id, basePayload)
        setDrivers((prev) => prev.map((d) => (d.id === id ? updated : d)))
        showToast("Driver updated", "success")
      } else {
        const created = await createDriver(basePayload)
        setDrivers((prev) => [created, ...prev])
        showToast("Driver saved", "success")
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

    const bodyFmt = getBodyNumberFormatError(bodyNumber)
    if (bodyFmt) {
      showToast(bodyFmt, "error")
      return
    }
    const bn = normalizeBodyNumber(bodyNumber)
    const memberBodyKeys = new Set(
      members.map((m) => normalizeBodyNumber(m.bodyNumber).toLowerCase())
    )
    if (!memberBodyKeys.has(bn.toLowerCase())) {
      showToast(
        "Body # must match a member’s Body # (select one from the list).",
        "error"
      )
      return
    }
    if (!precinctNumber.trim()) {
      showToast("Precinct number is required.", "error")
      return
    }
    const nameErr = getMemberFullNameFormatError(fullName)
    if (nameErr) {
      showToast(nameErr, "error")
      return
    }
    const fullNameNorm = {
      first: normalizeNamePart(fullName.first),
      middle: normalizeNamePart(fullName.middle),
      last: normalizeNamePart(fullName.last),
      suffix: normalizeNamePart(fullName.suffix),
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

    const basePayload: DriverCreatePayload = {
      bodyNumber: bn,
      precinctNumber: precinctNumber.trim(),
      fullName: fullNameNorm,
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
    }
    setPendingSavePayload(basePayload)
    setSaveConfirmOpen(true)
  }

  async function onDriverImportFileSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setDriverImportBusy(true)
    const apiFailures: { excelRow: number; message: string }[] = []
    let created = 0
    const newDrivers: Driver[] = []
    try {
      const buf = await file.arrayBuffer()
      const memberBodyNormLower = new Set(
        members.map((m) => normalizeBodyNumber(m.bodyNumber).toLowerCase())
      )
      const { items, errors: parseErrors } = parseDriverImportRows(buf, {
        memberBodyNormLower,
      })
      if (!items.length && parseErrors.length) {
        setDriverImportReport({ created: 0, parseErrors, apiFailures: [] })
        setDriverImportReportOpen(true)
        showToast(parseErrors[0]?.message ?? "Import could not read the file.", "error")
        void createAuditLogEvent({
          module: "drivers",
          action: "import",
          message: `${formatAuthActorLabel()} attempted driver Excel import; file validation failed.`,
          method: "IMPORT",
          path: "/drivers/import",
        }).catch(() => {})
        return
      }
      for (const { excelRow, payload } of items) {
        try {
          const d = await createDriver(payload)
          newDrivers.push(d)
          created++
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Request failed"
          apiFailures.push({ excelRow, message: msg })
        }
      }
      if (newDrivers.length) {
        setDrivers((prev) => [...newDrivers, ...prev])
      }
      setDriverImportReport({ created, parseErrors, apiFailures })
      if (parseErrors.length || apiFailures.length) {
        setDriverImportReportOpen(true)
      }
      void createAuditLogEvent({
        module: "drivers",
        action: "import",
        message: `${formatAuthActorLabel()} imported ${created} driver(s) from Excel (${parseErrors.length} row(s) skipped in file, ${apiFailures.length} API error(s)).`,
        method: "IMPORT",
        path: "/drivers/import",
      }).catch(() => {})
      if (!apiFailures.length && !parseErrors.length) {
        showToast(`Imported ${created} driver(s).`, "success")
      } else {
        showToast(
          `Imported ${created} driver(s). Some rows need review — see report.`,
          "success"
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed."
      showToast(msg, "error")
    } finally {
      setDriverImportBusy(false)
    }
  }

  const driverHeaderActions = (
    <>
      <input
        ref={driverImportInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="sr-only"
        aria-label="Select file to import drivers"
        onChange={onDriverImportFileSelected}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={listLoading || driverImportBusy}
        onClick={() => driverImportInputRef.current?.click()}
      >
        <FileUp className="size-4" />
        {driverImportBusy ? "Importing…" : "Import"}
      </Button>
      <PageDataExportButton
        fileBaseName="drivers"
        moduleName="drivers"
        disabled={listLoading || filteredDrivers.length === 0}
        getSections={getDriverExportSections}
      />
    </>
  )

  return (
    <>
      <SiteHeader trailing={driverHeaderActions} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Add drivers with body numbers, complete name, address, and contact.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => openCreate()}
          className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
        >
          <Plus className="size-4" />
          Add driver
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Drivers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="size-4" />
                <span>Filter Drivers</span>
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
              Loading drivers…
            </p>
          ) : listError ? (
            <p className="py-8 text-center text-sm text-red-600">
              {listError}
            </p>
          ) : drivers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No drivers yet. Use &quot;Add driver&quot; to create one.
            </p>
          ) : filteredDrivers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No drivers found matching your search.
            </p>
          ) : (
            <>
              {(() => {
                const totalPages = Math.ceil(filteredDrivers.length / itemsPerPage)
                const startIndex = (currentPage - 1) * itemsPerPage
                const endIndex = startIndex + itemsPerPage
                const paginatedDrivers = filteredDrivers.slice(startIndex, endIndex)
                return (
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-3 font-medium">Driver</th>
                  <th className="pb-3 pr-3 font-medium">Body #</th>
                  <th className="pb-3 pr-3 font-medium">Age</th>
                  <th className="pb-3 pr-3 font-medium">Contact #</th>
                  <th className="pb-3 pr-3 font-medium">Address</th>
                  <th className="pb-3 pr-3 font-medium">Precinct #</th>
                  <th className="pb-3 pl-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDrivers.map((d) => {
                  const age = computeAgeFromBirthDate(d.birthday)
                  const addressDisplay = [d.address.barangay, d.address.city, d.address.province]
                    .filter(Boolean)
                    .join(", ")
                  return (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
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
                          <span className="font-medium">
                            {displayFullName(d.fullName)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">
                        <button
                          type="button"
                          className="hover:underline cursor-pointer"
                          onClick={() => {
                            const member = members.find(m => m.bodyNumber === d.bodyNumber)
                            if (member) setViewMemberForBody(member)
                          }}
                        >
                          {d.bodyNumber}
                        </button>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">
                        {age ?? "—"}
                      </td>
                      <td className="py-3 pr-3 tabular-nums text-muted-foreground">
                        {formatPhMobileDisplay(d.contactMobile10)}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {addressDisplay || "—"}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {d.precinctNumber || "—"}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewDriver(d)}
                            aria-label="View driver"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(d)}
                            aria-label="Edit driver"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(d)}
                            aria-label="Remove driver"
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
              {filteredDrivers.length > itemsPerPage && (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {Math.ceil(filteredDrivers.length / itemsPerPage)}
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
                      onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredDrivers.length / itemsPerPage), p + 1))}
                      disabled={currentPage === Math.ceil(filteredDrivers.length / itemsPerPage)}
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
              {editingId ? "Edit driver" : "Add driver"}
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
                  <Label htmlFor="bodyNumber">Body number</Label>
                  <SearchableSelect
                    id="bodyNumber"
                    className={selectClass}
                    value={bodyNumber}
                    onChange={(e) => setBodyNumber(e.target.value)}
                    disabled={editingId !== null}
                  >
                    <option value="">Select body number</option>
                    {availableBodyNumbers.map((num) => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ))}
                  </SearchableSelect>
                  {editingId && (
                    <p className="text-xs text-muted-foreground">
                      Body number cannot be changed when editing
                    </p>
                  )}
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
                    searchable={false}
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
                    : "Save driver"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!viewDriver}
        onOpenChange={(open) => {
          if (!open) setViewDriver(null)
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl"
        >
          {viewDriver ? (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Eye className="size-5" />
                  Driver details
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col items-center gap-3 border-b pb-6">
                <Avatar 
                  className="h-20 w-20 ring-2 ring-border ring-offset-2 ring-offset-background cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => viewDriver.profileImageSrc && setViewImageSrc(viewDriver.profileImageSrc)}
                >
                  <AvatarImage
                    src={viewDriver.profileImageSrc || undefined}
                    alt=""
                    className="object-cover"
                  />
                  <AvatarFallback>
                    {initials(viewDriver.fullName)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-center text-lg font-semibold">
                  {displayFullName(viewDriver.fullName)}
                </p>
              </div>
              <div className="flex flex-col gap-6 py-6">
                <section>
                  <h3 className="text-sm font-semibold">Identification</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow(
                      "Body number",
                      viewDriver.bodyNumber
                    )}
                    {viewRow(
                      "Precinct number",
                      viewDriver.precinctNumber
                    )}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Full name</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow("First name", viewDriver.fullName.first)}
                    {viewRow("Middle name", viewDriver.fullName.middle)}
                    {viewRow("Last name", viewDriver.fullName.last)}
                    {viewRow("Suffix", viewDriver.fullName.suffix)}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Birthday</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow(
                      "Date of birth",
                      formatBirthdayLong(viewDriver.birthday)
                    )}
                    {viewRow(
                      "Age",
                      (() => {
                        const a = computeAgeFromBirthDate(viewDriver.birthday)
                        return a === null ? "" : `${a} years`
                      })()
                    )}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Address</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow("Province", viewDriver.address.province)}
                    {viewRow("City / municipality", viewDriver.address.city)}
                    {viewRow("Barangay", viewDriver.address.barangay)}
                    {viewRow(
                      "Street / unit / landmarks",
                      viewDriver.address.line
                    )}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Contact &amp; tax</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow(
                      "Mobile (PH)",
                      formatPhMobileDisplay(viewDriver.contactMobile10)
                    )}
                    {viewRow(
                      "TIN",
                      formatTinDisplay(viewDriver.tinDigits)
                    )}
                  </dl>
                </section>
              </div>
              <div className="mt-auto flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViewDriver(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  className="gap-2 bg-black text-white hover:bg-black/90"
                  onClick={() => {
                    const d = viewDriver
                    setViewDriver(null)
                    openEdit(d)
                  }}
                >
                  <Pencil className="size-4" />
                  Edit driver
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

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
              {editingId ? "Save changes?" : "Save new driver?"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? `Update the record for ${displayFullName(pendingSavePayload?.fullName ?? emptyName())} in the database.`
                : "Add this driver to the database with the information you entered."}
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
              onClick={() => void confirmSaveDriver()}
            >
              {savePending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={driverImportReportOpen}
        onOpenChange={(open) => {
          setDriverImportReportOpen(open)
          if (!open) setDriverImportReport(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Excel import report</DialogTitle>
            <DialogDescription>
              {driverImportReport
                ? `${driverImportReport.created} driver(s) saved to the database.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {driverImportReport ? (
            <div className="space-y-4 text-sm">
              {driverImportReport.parseErrors.length ? (
                <div>
                  <p className="font-medium text-destructive">Skipped in file</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {driverImportReport.parseErrors.map((e, i) => (
                      <li key={`d-parse-${i}`}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {driverImportReport.apiFailures.length ? (
                <div>
                  <p className="font-medium text-destructive">Server errors</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {driverImportReport.apiFailures.map((e, i) => (
                      <li key={`d-api-${i}`}>
                        Row {e.excelRow}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!driverImportReport.parseErrors.length &&
              !driverImportReport.apiFailures.length ? (
                <p className="text-muted-foreground">No issues reported.</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setDriverImportReportOpen(false)}
            >
              Close
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
            <DialogTitle>Remove driver?</DialogTitle>
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
              onClick={() => void confirmDeleteDriver()}
            >
              {deletePending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={!!viewMemberForBody}
        onOpenChange={(open) => {
          if (!open) setViewMemberForBody(null)
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl"
        >
          {viewMemberForBody ? (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <User className="size-5" />
                  Member details
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col items-center gap-3 border-b pb-6">
                <Avatar 
                  className="h-20 w-20 ring-2 ring-border ring-offset-2 ring-offset-background cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => viewMemberForBody.profileImageSrc && setViewImageSrc(viewMemberForBody.profileImageSrc)}
                >
                  <AvatarImage
                    src={viewMemberForBody.profileImageSrc || undefined}
                    alt=""
                    className="object-cover"
                  />
                  <AvatarFallback>
                    {initials(viewMemberForBody.fullName)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-center text-lg font-semibold">
                  {displayFullName(viewMemberForBody.fullName)}
                </p>
              </div>
              <div className="flex flex-col gap-6 py-6">
                <section>
                  <h3 className="text-sm font-semibold">Identification</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow(
                      "Body / Prangkisa",
                      viewMemberForBody.bodyNumber
                    )}
                    {viewRow(
                      "Precinct number",
                      viewMemberForBody.precinctNumber
                    )}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Full name</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow("First name", viewMemberForBody.fullName.first)}
                    {viewRow("Middle name", viewMemberForBody.fullName.middle)}
                    {viewRow("Last name", viewMemberForBody.fullName.last)}
                    {viewRow("Suffix", viewMemberForBody.fullName.suffix)}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Birthday</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow(
                      "Date of birth",
                      formatBirthdayLong(viewMemberForBody.birthday)
                    )}
                    {viewRow(
                      "Age",
                      (() => {
                        const a = computeAgeFromBirthDate(viewMemberForBody.birthday)
                        return a === null ? "" : `${a} years`
                      })()
                    )}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Address</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow("Province", viewMemberForBody.address.province)}
                    {viewRow("City / municipality", viewMemberForBody.address.city)}
                    {viewRow("Barangay", viewMemberForBody.address.barangay)}
                    {viewRow(
                      "Street / unit / landmarks",
                      viewMemberForBody.address.line
                    )}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Contact &amp; tax</h3>
                  <dl className="mt-3 space-y-3">
                    {viewRow(
                      "Mobile (PH)",
                      formatPhMobileDisplay(viewMemberForBody.contactMobile10)
                    )}
                    {viewRow(
                      "TIN",
                      formatTinDisplay(viewMemberForBody.tinDigits)
                    )}
                  </dl>
                </section>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold">Financial records</h3>
                  <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    {(
                      [
                        ["Loan", viewMemberForBody.financials.loan],
                        ["Savings", viewMemberForBody.financials.savings],
                        ["Arkilahan", viewMemberForBody.financials.arkilahan],
                        ["Butaw / Hulog", viewMemberForBody.financials.butawHulog],
                        ["Lipatan", viewMemberForBody.financials.lipatan],
                        [
                          "Share capital",
                          viewMemberForBody.financials.shareCapital ?? 0,
                        ],
                      ] as const
                    ).map(([label, v]) => (
                      <li
                        key={label}
                        className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <span className="tabular-nums font-medium">
                          ₱{v.toLocaleString("en-PH")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
              <div className="mt-auto flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViewMemberForBody(null)}
                >
                  Close
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

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
