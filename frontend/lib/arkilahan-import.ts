import * as XLSX from "xlsx"

import type { ArkilahanCreatePayload } from "@/lib/arkilahan-api"
import type { ArkilahanTermUnit } from "@/lib/arkilahan-types"
import { triggerXlsxDownload } from "@/lib/csv-export"
import {
  getBodyNumberFormatError,
  getMemberFullNameFormatError,
  normalizeBodyNumber,
  normalizeNamePart,
} from "@/lib/member-utils"

export const ARKILAHAN_IMPORT_SHEET = "Arkilahan"

const HEADER_SYNONYMS: Record<string, string[]> = {
  date: ["record date (yyyy-mm-dd)", "record date", "date"],
  bodyNumber: ["body #", "body number", "prangkisa #", "prangkisa"],
  firstName: ["first name", "given name"],
  middleName: ["middle name", "middle initial", "middle"],
  lastName: ["last name", "surname", "family name"],
  suffix: ["suffix"],
  fee: ["fee", "amount"],
  dueDate: ["due date (yyyy-mm-dd)", "due date", "due"],
  termValue: ["term value", "terms value"],
  termUnit: ["term unit (months or years)", "term unit", "unit"],
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

function parseIsoDate(value: unknown): string | null {
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

function parseFee(v: unknown): number | null {
  if (v == null || v === "") return null
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v
  const s = String(v)
    .replace(/[₱Pp]/g, "")
    .replace(/,/g, "")
    .trim()
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseTermValue(v: unknown): number | null {
  if (v == null || v === "") return null
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.round(v)
    return n > 0 ? n : null
  }
  const s = String(v).trim()
  const n = parseInt(s, 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

function parseTermUnit(raw: string): ArkilahanTermUnit | null {
  const n = raw.trim().toLowerCase()
  if (n === "month" || n === "months") return "months"
  if (n === "year" || n === "years") return "years"
  return null
}

export type ArkilahanImportRowError = { excelRow: number; message: string }

export type ArkilahanImportParsedRow = {
  excelRow: number
  payload: ArkilahanCreatePayload
}

export type ArkilahanImportParseOptions = {
  memberBodyNormLower: Set<string>
}

export function buildArkilahanImportTemplateBuffer(): ArrayBuffer {
  const headers = [
    "Record date (YYYY-MM-DD)",
    "Body #",
    "First name",
    "Middle name",
    "Last name",
    "Suffix",
    "Fee",
    "Due date (YYYY-MM-DD)",
    "Term value",
    "Term unit (months or years)",
  ]
  const sampleRow = [
    "2025-01-01",
    "SAMPLE-DELETE-ME",
    "Juan",
    "",
    "Dela Cruz",
    "",
    "1500",
    "2026-01-01",
    "12",
    "months",
  ]
  const wb = XLSX.utils.book_new()
  const rows = [headers, sampleRow]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(48, Math.max(14, h.length + 4)),
  }))
  XLSX.utils.book_append_sheet(wb, ws, ARKILAHAN_IMPORT_SHEET)
  return XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true })
}

export function downloadArkilahanImportTemplate(): void {
  const buf = buildArkilahanImportTemplateBuffer()
  triggerXlsxDownload("arkilahan-import-template", buf)
}

export function parseArkilahanImportRows(
  arrayBuffer: ArrayBuffer,
  options: ArkilahanImportParseOptions,
): {
  items: ArkilahanImportParsedRow[]
  errors: ArkilahanImportRowError[]
} {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true })
  const sheetName =
    wb.SheetNames.find(
      (n) => n.trim().toLowerCase() === ARKILAHAN_IMPORT_SHEET.toLowerCase(),
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
    "date",
    "bodyNumber",
    "firstName",
    "lastName",
    "fee",
    "dueDate",
    "termValue",
    "termUnit",
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
  const items: ArkilahanImportParsedRow[] = []
  const errors: ArkilahanImportRowError[] = []
  let nonEmptyDataRowCount = 0
  let skippedTemplateSampleRows = 0
  let firstSkippedSampleExcelRow: number | null = null

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? []
    const excelRow = i + 1
    if (!row.some((c) => String(c ?? "").trim() !== "")) continue

    nonEmptyDataRowCount++
    const dateRaw = pick(row, colToField, "date")
    const bodyNumber = strVal(pick(row, colToField, "bodyNumber"))
    const first = strVal(pick(row, colToField, "firstName"))
    const middle = strVal(pick(row, colToField, "middleName"))
    const last = strVal(pick(row, colToField, "lastName"))
    const suffix = strVal(pick(row, colToField, "suffix"))
    const feeRaw = pick(row, colToField, "fee")
    const dueRaw = pick(row, colToField, "dueDate")
    const termValRaw = pick(row, colToField, "termValue")
    const termUnitRaw = strVal(pick(row, colToField, "termUnit"))

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

    const recordDate = parseIsoDate(dateRaw)
    if (!recordDate) {
      pushErr("Record date is missing or invalid (use YYYY-MM-DD or an Excel date).")
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
    const fn = normalizeNamePart(first)
    const mn = normalizeNamePart(middle)
    const ln = normalizeNamePart(last)
    const suf = normalizeNamePart(suffix)
    const name = [fn, mn, ln, suf].filter(Boolean).join(" ")

    const fee = parseFee(feeRaw)
    if (fee === null) {
      pushErr("Fee must be a number greater than 0.")
      continue
    }

    const dueDate = parseIsoDate(dueRaw)
    if (!dueDate) {
      pushErr("Due date is missing or invalid (use YYYY-MM-DD or an Excel date).")
      continue
    }

    const termValue = parseTermValue(termValRaw)
    if (termValue === null) {
      pushErr("Term value must be a whole number of at least 1.")
      continue
    }

    const termUnit = parseTermUnit(termUnitRaw)
    if (!termUnit) {
      pushErr('Term unit must be "months" or "years".')
      continue
    }

    items.push({
      excelRow,
      payload: {
        date: recordDate,
        bodyNumber: bodyNorm,
        name,
        fee,
        dueDate,
        termValue,
        termUnit,
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
        message: `Row ${firstSkippedSampleExcelRow ?? 2} is still the template sample (Body # contains SAMPLE-DELETE). Replace it with a real row or add more rows, then import again.`,
      })
    } else {
      errors.push({
        excelRow: 0,
        message:
          "No data rows found under the header row. Enter at least one record starting on row 2.",
      })
    }
  }

  return { items, errors }
}
