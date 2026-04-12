import * as XLSX from "xlsx"

import type { SuspensionCreatePayload } from "@/lib/suspensions-api"
import type { SuspensionStatus } from "@/lib/suspension-types"
import { triggerXlsxDownload } from "@/lib/csv-export"
import { getBodyNumberFormatError, normalizeBodyNumber } from "@/lib/member-utils"

export const SUSPENSION_IMPORT_SHEET = "Suspensions"

export type SuspensionImportDriverRef = {
  id: string
  bodyNumber: string
  driverName: string
}

const HEADER_SYNONYMS: Record<string, string[]> = {
  bodyNumber: ["body #", "body number", "prangkisa #", "prangkisa"],
  driverName: [
    "driver name (must match driver list)",
    "driver name",
    "name of driver",
    "driver",
    "operator name",
    "full name",
    "pangalan ng driver",
  ],
  startDate: ["start date (yyyy-mm-dd)", "start date", "start"],
  endDate: ["end date (yyyy-mm-dd)", "end date", "end"],
  status: [
    "status (active or cleared)",
    "status",
    "suspension status",
  ],
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

function parseSuspensionStatus(raw: string): SuspensionStatus | null {
  const n = raw.trim().toLowerCase()
  if (n === "cleared" || n === "clear") return "cleared"
  if (n === "active" || n === "suspended" || n === "suspend") return "active"
  return null
}

function normDriverNameForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "")
    .trim()
}

export type SuspensionImportRowError = { excelRow: number; message: string }

export type SuspensionImportParsedRow = {
  excelRow: number
  payload: SuspensionCreatePayload
}

export type SuspensionImportParseOptions = {
  driverRefByBodyNormLower: Map<string, SuspensionImportDriverRef>
}

export function buildSuspensionImportTemplateBuffer(): ArrayBuffer {
  const headers = [
    "Body #",
    "Driver name (must match driver list)",
    "Start date (YYYY-MM-DD)",
    "End date (YYYY-MM-DD)",
    "Status (active or cleared)",
  ]
  const sampleRow = [
    "SAMPLE-DELETE-ME",
    "Sample Driver Name",
    "2025-01-01",
    "2025-02-01",
    "active",
  ]
  const wb = XLSX.utils.book_new()
  const rows = [headers, sampleRow]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(48, Math.max(14, h.length + 4)),
  }))
  XLSX.utils.book_append_sheet(wb, ws, SUSPENSION_IMPORT_SHEET)
  return XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true })
}

export function downloadSuspensionImportTemplate(): void {
  const buf = buildSuspensionImportTemplateBuffer()
  triggerXlsxDownload("suspensions-import-template", buf)
}

export function parseSuspensionImportRows(
  arrayBuffer: ArrayBuffer,
  options: SuspensionImportParseOptions,
): {
  items: SuspensionImportParsedRow[]
  errors: SuspensionImportRowError[]
} {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true })
  const sheetName =
    wb.SheetNames.find(
      (n) => n.trim().toLowerCase() === SUSPENSION_IMPORT_SHEET.toLowerCase(),
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
    "driverName",
    "startDate",
    "endDate",
    "status",
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

  const driverMap = options.driverRefByBodyNormLower
  const items: SuspensionImportParsedRow[] = []
  const errors: SuspensionImportRowError[] = []
  let nonEmptyDataRowCount = 0
  let skippedTemplateSampleRows = 0
  let firstSkippedSampleExcelRow: number | null = null

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? []
    const excelRow = i + 1
    if (!row.some((c) => String(c ?? "").trim() !== "")) continue

    nonEmptyDataRowCount++
    const bodyNumber = strVal(pick(row, colToField, "bodyNumber"))
    const driverNameFromFile = strVal(pick(row, colToField, "driverName"))
    const startRaw = pick(row, colToField, "startDate")
    const endRaw = pick(row, colToField, "endDate")
    const statusRaw = strVal(pick(row, colToField, "status"))

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
    const driverRef = driverMap.get(bodyNormKey)
    if (!driverRef) {
      pushErr(
        "Body # must match an existing driver’s Body # (add the driver first).",
      )
      continue
    }

    if (!driverNameFromFile) {
      pushErr("Driver name is required.")
      continue
    }
    if (
      normDriverNameForCompare(driverNameFromFile) !==
      normDriverNameForCompare(driverRef.driverName)
    ) {
      pushErr(
        `Driver name must match the driver for this Body # (expected: "${driverRef.driverName}").`,
      )
      continue
    }

    const startDate = parseIsoDate(startRaw)
    if (!startDate) {
      pushErr("Start date is missing or invalid (use YYYY-MM-DD or an Excel date).")
      continue
    }
    const endDate = parseIsoDate(endRaw)
    if (!endDate) {
      pushErr("End date is missing or invalid (use YYYY-MM-DD or an Excel date).")
      continue
    }
    if (endDate < startDate) {
      pushErr("End date cannot be earlier than start date.")
      continue
    }

    const status = parseSuspensionStatus(statusRaw)
    if (!status) {
      pushErr('Status must be "active" (suspended) or "cleared".')
      continue
    }

    items.push({
      excelRow,
      payload: {
        driverId: driverRef.id,
        bodyNumber: driverRef.bodyNumber,
        driverName: driverRef.driverName,
        startDate,
        endDate,
        status,
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
