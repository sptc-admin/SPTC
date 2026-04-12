import * as XLSX from "xlsx"

import type { SavingsRecordCreatePayload } from "@/lib/savings-api"
import type { Member } from "@/lib/member-types"
import { triggerXlsxDownload } from "@/lib/csv-export"
import { getBodyNumberFormatError, normalizeBodyNumber } from "@/lib/member-utils"

export const SAVINGS_IMPORT_SHEET = "Savings"

export type SavingsImportMemberRef = {
  id: string
  bodyNumber: string
  memberName: string
}

function memberDisplayNameForImport(member: Member): string {
  const parts = [
    member.fullName.first,
    member.fullName.middle,
    member.fullName.last,
    member.fullName.suffix,
  ]
    .map((s) => String(s ?? "").replace(/,/g, "").trim())
    .filter(Boolean)
  return parts.join(" ")
}

export function buildSavingsImportMemberRefMap(
  members: Member[],
): Map<string, SavingsImportMemberRef> {
  const m = new Map<string, SavingsImportMemberRef>()
  for (const mem of members) {
    const k = normalizeBodyNumber(mem.bodyNumber).toLowerCase()
    if (!m.has(k)) {
      m.set(k, {
        id: mem.id,
        bodyNumber: mem.bodyNumber,
        memberName: memberDisplayNameForImport(mem),
      })
    }
  }
  return m
}

const HEADER_SYNONYMS: Record<string, string[]> = {
  bodyNumber: ["body #", "body number", "prangkisa #", "prangkisa"],
  memberName: [
    "member name (must match member list)",
    "member name",
    "name of member",
    "pangalan ng member",
  ],
  date: [
    "payment date (yyyy-mm-dd)",
    "payment date",
    "date",
    "savings date",
  ],
  amount: ["amount", "savings amount", "payment amount"],
}

function normHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .trim()
}

function buildFieldMap(
  headerRow: unknown[],
  synonyms: Record<string, string[]>,
): Map<string, string> {
  const labelToField = new Map<string, string>()
  for (const [field, labels] of Object.entries(synonyms)) {
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

function parseAmount(v: unknown): number | null {
  if (v == null || v === "") return null
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v
  const s = String(v)
    .replace(/[₱Pp]/g, "")
    .replace(/,/g, "")
    .trim()
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function normNameForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "")
    .trim()
}

export type SavingsImportRowError = { excelRow: number; message: string }

export type SavingsImportParsedRow = {
  excelRow: number
  payload: SavingsRecordCreatePayload
}

export type SavingsImportParseOptions = {
  memberRefByBodyNormLower: Map<string, SavingsImportMemberRef>
}

export function buildSavingsImportTemplateBuffer(): ArrayBuffer {
  const headers = [
    "Body #",
    "Member name (must match member list)",
    "Payment date (YYYY-MM-DD)",
    "Amount",
  ]
  const sampleRow = ["SAMPLE-DELETE-ME", "Sample Member Name", "2025-01-15", "500"]
  const wb = XLSX.utils.book_new()
  const rows = [headers, sampleRow]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(48, Math.max(14, h.length + 4)),
  }))
  XLSX.utils.book_append_sheet(wb, ws, SAVINGS_IMPORT_SHEET)
  return XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true })
}

export function downloadSavingsImportTemplate(): void {
  const buf = buildSavingsImportTemplateBuffer()
  triggerXlsxDownload("savings-import-template", buf)
}

export function parseSavingsImportRows(
  arrayBuffer: ArrayBuffer,
  options: SavingsImportParseOptions,
): {
  items: SavingsImportParsedRow[]
  errors: SavingsImportRowError[]
} {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true })
  const sheetName =
    wb.SheetNames.find(
      (n) => n.trim().toLowerCase() === SAVINGS_IMPORT_SHEET.toLowerCase(),
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
  const colToField = buildFieldMap(headerRow, HEADER_SYNONYMS)
  const requiredFields = ["bodyNumber", "memberName", "date", "amount"] as const
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

  const memberMap = options.memberRefByBodyNormLower
  const items: SavingsImportParsedRow[] = []
  const errors: SavingsImportRowError[] = []
  let nonEmptyDataRowCount = 0
  let skippedTemplateSampleRows = 0
  let firstSkippedSampleExcelRow: number | null = null

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? []
    const excelRow = i + 1
    if (!row.some((c) => String(c ?? "").trim() !== "")) continue

    nonEmptyDataRowCount++
    const bodyNumber = strVal(pick(row, colToField, "bodyNumber"))
    const memberNameFromFile = strVal(pick(row, colToField, "memberName"))
    const dateRaw = pick(row, colToField, "date")
    const amountRaw = pick(row, colToField, "amount")

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
    const memberRef = memberMap.get(bodyNormKey)
    if (!memberRef) {
      pushErr(
        "Body # must match an existing member’s Body # (add the member first).",
      )
      continue
    }

    if (!memberNameFromFile) {
      pushErr("Member name is required.")
      continue
    }
    if (
      normNameForCompare(memberNameFromFile) !==
      normNameForCompare(memberRef.memberName)
    ) {
      pushErr(
        `Member name must match the member for this Body # (expected: "${memberRef.memberName}").`,
      )
      continue
    }

    const date = parseIsoDate(dateRaw)
    if (!date) {
      pushErr(
        "Payment date is missing or invalid (use YYYY-MM-DD or an Excel date).",
      )
      continue
    }

    const amount = parseAmount(amountRaw)
    if (amount === null) {
      pushErr("Amount must be a number greater than 0.")
      continue
    }

    items.push({
      excelRow,
      payload: {
        memberId: memberRef.id,
        bodyNumber: memberRef.bodyNumber,
        memberName: memberRef.memberName,
        date,
        amount,
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
