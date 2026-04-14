import * as XLSX from "xlsx"

import type { DriverCreatePayload } from "@/lib/drivers-api"
import { DEFAULT_PROFILE_IMAGE } from "@/lib/driver-types"
import { triggerXlsxDownload } from "@/lib/csv-export"
import {
  computeAgeFromBirthDate,
  getBodyNumberFormatError,
  getMemberFullNameFormatError,
  isValidPhMobile10,
  isValidTin12,
  normalizeBodyNumber,
  normalizeNamePart,
  normalizePhMobile10,
  normalizeTinDigits,
} from "@/lib/member-utils"

export const DRIVER_IMPORT_SHEET = "Drivers"

const HEADER_SYNONYMS: Record<string, string[]> = {
  bodyNumber: ["body #", "body number", "prangkisa #", "prangkisa"],
  precinctNumber: ["precinct #", "precinct number", "precinct"],
  firstName: ["first name", "given name"],
  middleName: ["middle name", "middle"],
  lastName: ["last name", "surname", "family name"],
  suffix: ["suffix"],
  birthday: [
    "birthday (yyyy-mm-dd)",
    "birthday",
    "birth date",
    "date of birth",
  ],
  province: ["province"],
  city: ["city / municipality", "city", "municipality"],
  barangay: ["barangay"],
  addressLine: [
    "street / unit / landmarks",
    "address line",
    "street",
    "address",
  ],
  mobile: ["mobile (10 digits)", "mobile", "contact", "phone"],
  tin: ["tin (12 digits)", "tin", "tin number"],
}

function normHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .trim()
}

function buildHeaderMap(headerRow: unknown[]): Map<string, string> {
  const labelToField = new Map<string, string>()
  for (const [field, labels] of Object.entries(HEADER_SYNONYMS)) {
    for (const label of labels) {
      labelToField.set(normHeader(label), field)
    }
  }
  const out = new Map<string, string>()
  headerRow.forEach((cell, i) => {
    const n = normHeader(String(cell ?? ""))
    if (!n) return
    const field = labelToField.get(n)
    if (field) out.set(String(i), field)
  })
  return out
}

function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial)) return null
  const utc = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(utc)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function parseBirthday(value: unknown): string | null {
  if (value == null || value === "") return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    if (value > 1e4) return excelSerialToIsoDate(value)
  }
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

function pick(
  row: unknown[],
  colToField: Map<string, string>,
  field: string,
): unknown {
  for (let i = 0; i < row.length; i++) {
    if (colToField.get(String(i)) === field) return row[i]
  }
  return undefined
}

function strVal(v: unknown): string {
  if (v == null || v === "") return ""
  return String(v).trim()
}

export type DriverImportRowError = { excelRow: number; message: string }

export type DriverImportParsedRow = {
  excelRow: number
  payload: DriverCreatePayload
}

export type DriverImportParseOptions = {
  /** Normalized member Body # values (lowercase) — driver Body # must match one. */
  memberBodyNormLower: Set<string>
}

export function buildDriverImportTemplateBuffer(): ArrayBuffer {
  const headers = [
    "Body #",
    "Precinct #",
    "First name",
    "Middle name",
    "Last name",
    "Suffix",
    "Birthday (YYYY-MM-DD)",
    "Province",
    "City / municipality",
    "Barangay",
    "Street / unit / landmarks",
    "Mobile (10 digits)",
    "TIN (12 digits)",
  ]
  const sampleRow = [
    "SAMPLE-DELETE-ME",
    "001",
    "Juan",
    "Santos",
    "Dela Cruz",
    "",
    "1990-01-15",
    "Rizal",
    "Antipolo City",
    "San Jose",
    "Sample street / landmark",
    "9171234567",
    "123456789012",
  ]
  const wb = XLSX.utils.book_new()
  const rows = [headers, sampleRow]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(48, Math.max(14, h.length + 4)),
  }))
  XLSX.utils.book_append_sheet(wb, ws, DRIVER_IMPORT_SHEET)
  return XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true })
}

export function downloadDriverImportTemplate(): void {
  const buf = buildDriverImportTemplateBuffer()
  triggerXlsxDownload("drivers-import-template", buf)
}

export function parseDriverImportRows(
  arrayBuffer: ArrayBuffer,
  options: DriverImportParseOptions,
): {
  items: DriverImportParsedRow[]
  errors: DriverImportRowError[]
} {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true })
  const sheetName =
    wb.SheetNames.find(
      (n) => n.trim().toLowerCase() === DRIVER_IMPORT_SHEET.toLowerCase(),
    ) ?? wb.SheetNames[0]
  if (!sheetName) {
    return {
      items: [],
      errors: [{ excelRow: 0, message: "Workbook has no sheets." }],
    }
  }
  const ws = wb.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][]

  if (!matrix.length) {
    return {
      items: [],
      errors: [{ excelRow: 1, message: "Sheet is empty." }],
    }
  }

  const headerRow = matrix[0] ?? []
  const colToField = buildHeaderMap(headerRow)
  const requiredFields = [
    "bodyNumber",
    "precinctNumber",
    "firstName",
    "lastName",
    "birthday",
    "province",
    "city",
    "barangay",
    "addressLine",
    "mobile",
    "tin",
  ] as const
  const missingHeaders = requiredFields.filter(
    (f) => ![...colToField.values()].includes(f),
  )
  if (missingHeaders.length) {
    return {
      items: [],
      errors: [
        {
          excelRow: 1,
          message: `Missing required column(s): ${missingHeaders.join(", ")}. Use the template headers in row 1.`,
        },
      ],
    }
  }

  const memberBodies = options.memberBodyNormLower
  const items: DriverImportParsedRow[] = []
  const errors: DriverImportRowError[] = []
  let nonEmptyDataRowCount = 0
  let skippedTemplateSampleRows = 0
  let firstSkippedSampleExcelRow: number | null = null

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? []
    const excelRow = i + 1
    if (!row.some((c) => String(c ?? "").trim() !== "")) continue

    nonEmptyDataRowCount++
    const bodyNumber = strVal(pick(row, colToField, "bodyNumber"))
    const precinctNumber = strVal(pick(row, colToField, "precinctNumber"))
    const first = strVal(pick(row, colToField, "firstName"))
    const middle = strVal(pick(row, colToField, "middleName"))
    const last = strVal(pick(row, colToField, "lastName"))
    const suffix = strVal(pick(row, colToField, "suffix"))
    const birthdayRaw = pick(row, colToField, "birthday")
    const province = strVal(pick(row, colToField, "province"))
    const city = strVal(pick(row, colToField, "city"))
    const barangay = strVal(pick(row, colToField, "barangay"))
    const line = strVal(pick(row, colToField, "addressLine"))
    const mobileRaw = pick(row, colToField, "mobile")
    const tinRaw = pick(row, colToField, "tin")

    const pushErr = (message: string) =>
      errors.push({ excelRow, message: `Row ${excelRow}: ${message}` })

    if (!bodyNumber) {
      pushErr("Body # is required.")
      continue
    }
    if (bodyNumber.toUpperCase().includes("SAMPLE-DELETE")) {
      if (firstSkippedSampleExcelRow === null) firstSkippedSampleExcelRow = excelRow
      skippedTemplateSampleRows++
      continue
    }
    const bodyFmt = getBodyNumberFormatError(bodyNumber)
    if (bodyFmt) {
      pushErr(bodyFmt)
      continue
    }
    const bodyNorm = normalizeBodyNumber(bodyNumber)
    const bodyNormKey = bodyNorm.toLowerCase()
    if (!memberBodies.has(bodyNormKey)) {
      pushErr(
        "Body # must match an existing member’s Body # (add the member first).",
      )
      continue
    }
    if (!precinctNumber) {
      pushErr("Precinct # is required.")
      continue
    }
    if (!first || !last) {
      pushErr("First and last name are required.")
      continue
    }
    const nameFmt = getMemberFullNameFormatError({
      first,
      middle,
      last,
      suffix,
    })
    if (nameFmt) {
      pushErr(nameFmt)
      continue
    }
    const fullNameNorm = {
      first: normalizeNamePart(first),
      middle: normalizeNamePart(middle),
      last: normalizeNamePart(last),
      suffix: normalizeNamePart(suffix),
    }
    const birthday = parseBirthday(birthdayRaw)
    if (!birthday) {
      pushErr("Birthday is missing or invalid (use YYYY-MM-DD or an Excel date).")
      continue
    }
    const age = computeAgeFromBirthDate(birthday)
    if (age === null || age < 0) {
      pushErr("Enter a valid birthday.")
      continue
    }
    if (!province || !city || !barangay || !line) {
      pushErr("Province, city, barangay, and street / address line are required.")
      continue
    }
    const mobile = normalizePhMobile10(mobileRaw)
    if (!isValidPhMobile10(mobile)) {
      pushErr("Mobile must be 10 digits starting with 9.")
      continue
    }
    const tin = normalizeTinDigits(tinRaw)
    if (!isValidTin12(tin)) {
      pushErr("TIN must be 12 digits.")
      continue
    }

    items.push({
      excelRow,
      payload: {
        bodyNumber: bodyNorm,
        precinctNumber,
        fullName: fullNameNorm,
        birthday,
        address: { province, city, barangay, line },
        contactMobile10: mobile,
        tinDigits: tin,
        profileImageSrc: DEFAULT_PROFILE_IMAGE,
      },
    })
  }

  if (items.length === 0 && errors.length === 0) {
    if (
      skippedTemplateSampleRows > 0 &&
      skippedTemplateSampleRows === nonEmptyDataRowCount
    ) {
      errors.push({
        excelRow: firstSkippedSampleExcelRow ?? 2,
        message: `Row ${firstSkippedSampleExcelRow ?? 2} is still the template sample (Body # contains SAMPLE-DELETE). Replace it with a real driver row or add more rows, then import again.`,
      })
    } else {
      errors.push({
        excelRow: 0,
        message:
          "No data rows found under the header row. Enter at least one driver starting on row 2.",
      })
    }
  }

  return { items, errors }
}
