import * as XLSX from "xlsx"

import type { ButawRecordCreatePayload } from "@/lib/butaw-api"
import { BUTAW_MONTHLY_AMOUNT, isValidButawAmountPesos } from "@/lib/butaw-month"
import type { Member } from "@/lib/member-types"
import { triggerXlsxDownload } from "@/lib/csv-export"
import { getBodyNumberFormatError, normalizeBodyNumber } from "@/lib/member-utils"

export const BUTAW_IMPORT_SHEET = "Butaw"

export type ButawImportMemberRef = {
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

export function buildButawImportMemberRefMap(
  members: Member[],
): Map<string, ButawImportMemberRef> {
  const m = new Map<string, ButawImportMemberRef>()
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
  month: [
    "first month (yyyy-mm)",
    "first month",
    "month",
    "start month",
  ],
  amount: [
    `amount (multiple of ₱${BUTAW_MONTHLY_AMOUNT})`,
    "amount",
    "butaw amount",
    "payment amount",
  ],
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

function parseButawAmount(v: unknown): number | null {
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

export type ButawImportRowError = { excelRow: number; message: string }

export type ButawImportParsedRow = {
  excelRow: number
  payload: ButawRecordCreatePayload
}

export type ButawImportParseOptions = {
  memberRefByBodyNormLower: Map<string, ButawImportMemberRef>
}

export function buildButawImportTemplateBuffer(): ArrayBuffer {
  const headers = [
    "Body #",
    "Member name (must match member list)",
    "First month (YYYY-MM)",
    `Amount (multiple of ₱${BUTAW_MONTHLY_AMOUNT})`,
  ]
  const sampleRow = ["SAMPLE-DELETE-ME", "Sample Member Name", "2025-01", "1500"]
  const wb = XLSX.utils.book_new()
  const rows = [headers, sampleRow]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(48, Math.max(14, h.length + 4)),
  }))
  XLSX.utils.book_append_sheet(wb, ws, BUTAW_IMPORT_SHEET)
  return XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true })
}

export function downloadButawImportTemplate(): void {
  const buf = buildButawImportTemplateBuffer()
  triggerXlsxDownload("butaw-import-template", buf)
}

export function parseButawImportRows(
  arrayBuffer: ArrayBuffer,
  options: ButawImportParseOptions,
): {
  items: ButawImportParsedRow[]
  errors: ButawImportRowError[]
} {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true })
  const sheetName =
    wb.SheetNames.find(
      (n) => n.trim().toLowerCase() === BUTAW_IMPORT_SHEET.toLowerCase(),
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
  const requiredFields = ["bodyNumber", "memberName", "month", "amount"] as const
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
  const items: ButawImportParsedRow[] = []
  const errors: ButawImportRowError[] = []
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
    const monthRaw = strVal(pick(row, colToField, "month"))
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

    const month = monthRaw.replace(/\s+/g, "")
    if (!/^\d{4}-\d{2}$/.test(month)) {
      pushErr("First month must be YYYY-MM (e.g. 2025-01).")
      continue
    }

    const amount = parseButawAmount(amountRaw)
    if (amount === null) {
      pushErr("Amount must be a number greater than 0.")
      continue
    }
    if (!isValidButawAmountPesos(amount)) {
      pushErr(
        `Amount must be a positive multiple of ₱${BUTAW_MONTHLY_AMOUNT} (monthly butaw rate).`,
      )
      continue
    }

    items.push({
      excelRow,
      payload: {
        memberId: memberRef.id,
        bodyNumber: memberRef.bodyNumber,
        memberName: memberRef.memberName,
        month,
        amount,
        isAdvance: false,
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
