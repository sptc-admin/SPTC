import * as XLSX from "xlsx"

import type { LoanCreatePayload } from "@/lib/loans-api"
import type { Member } from "@/lib/member-types"
import {
  buildDiminishingSchedule,
  toYmd,
  type AmortRow,
} from "@/lib/loan-schedule"
import { triggerXlsxDownload } from "@/lib/csv-export"
import {
  LOAN_PROCESSING_FEE_AMOUNT_THRESHOLD,
  normalizeStoredProcessingFeeRate,
} from "@/lib/loan-processing-fee"
import { getBodyNumberFormatError, normalizeBodyNumber } from "@/lib/member-utils"

export const REGULAR_LOAN_IMPORT_SHEET = "Regular loans"
export const EMERGENCY_LOAN_IMPORT_SHEET = "Emergency loans"

const INTEREST_RATE = 1.5

export type LoanImportMemberRef = {
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

export function buildLoanImportMemberRefMap(
  members: Member[],
): Map<string, LoanImportMemberRef> {
  const m = new Map<string, LoanImportMemberRef>()
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

const REGULAR_HEADER_SYNONYMS: Record<string, string[]> = {
  bodyNumber: ["body #", "body number", "prangkisa #", "prangkisa"],
  memberName: [
    "member name (must match member list)",
    "member name",
    "name of member",
    "pangalan ng member",
  ],
  amountOfLoan: ["amount of loan", "loan amount", "amount"],
  termValue: ["term value", "terms"],
  termUnit: ["term unit (months or years)", "term unit", "unit"],
  processingFeeRate: [
    "processing fee (3% or 6%)",
    "processing fee %",
    "processing fee",
  ],
  insuranceAmount: ["insurance amount (optional)", "insurance amount", "insurance"],
  dateReleased: [
    "date released (yyyy-mm-dd)",
    "date released",
    "release date",
  ],
  reason: ["reason (optional)", "reason"],
}

const EMERGENCY_HEADER_SYNONYMS: Record<string, string[]> = {
  bodyNumber: ["body #", "body number", "prangkisa #", "prangkisa"],
  memberName: [
    "member name (must match member list)",
    "member name",
    "name of member",
    "pangalan ng member",
  ],
  amountOfLoan: ["amount of loan", "loan amount", "amount"],
  dateReleased: [
    "date released (yyyy-mm-dd)",
    "date released",
    "release date",
  ],
  reason: ["reason (required)", "reason"],
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

function parseDecimal(v: unknown): number | null {
  if (v == null || v === "") return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  const s = String(v)
    .replace(/[₱Pp]/g, "")
    .replace(/,/g, "")
    .trim()
  const n = Number(s)
  return Number.isFinite(n) ? n : null
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

function parseTermUnit(raw: string): "months" | "years" | null {
  const n = raw.trim().toLowerCase()
  if (n === "month" || n === "months") return "months"
  if (n === "year" || n === "years") return "years"
  return null
}

function normNameForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "")
    .trim()
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + years)
  return next
}

function autoProcessingFeeRate(amount: number): number {
  return amount <= LOAN_PROCESSING_FEE_AMOUNT_THRESHOLD ? 3 : 6
}

export type LoanImportRowError = { excelRow: number; message: string }

export type LoanImportParsedRow = {
  excelRow: number
  payload: LoanCreatePayload
}

export type LoanImportParseOptions = {
  memberRefByBodyNormLower: Map<string, LoanImportMemberRef>
}

export function buildRegularLoanImportTemplateBuffer(): ArrayBuffer {
  const headers = [
    "Body #",
    "Member name (must match member list)",
    "Amount of loan",
    "Term value",
    "Term unit (months or years)",
    "Processing Fee (3% or 6%)",
    "Insurance amount (optional)",
    "Date released (YYYY-MM-DD)",
    "Reason (optional)",
  ]
  const sampleRow = [
    "SAMPLE-DELETE-ME",
    "Sample Member Name",
    "50000",
    "12",
    "months",
    "",
    "0",
    "2025-01-15",
    "",
  ]
  const wb = XLSX.utils.book_new()
  const rows = [headers, sampleRow]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(48, Math.max(14, h.length + 4)),
  }))
  XLSX.utils.book_append_sheet(wb, ws, REGULAR_LOAN_IMPORT_SHEET)
  return XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true })
}

export function downloadRegularLoanImportTemplate(): void {
  const buf = buildRegularLoanImportTemplateBuffer()
  triggerXlsxDownload("regular-loans-import-template", buf)
}

export function parseRegularLoanImportRows(
  arrayBuffer: ArrayBuffer,
  options: LoanImportParseOptions,
): {
  items: LoanImportParsedRow[]
  errors: LoanImportRowError[]
} {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true })
  const sheetName =
    wb.SheetNames.find(
      (n) => n.trim().toLowerCase() === REGULAR_LOAN_IMPORT_SHEET.toLowerCase(),
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
  const colToField = buildFieldMap(headerRow, REGULAR_HEADER_SYNONYMS)
  const requiredFields = [
    "bodyNumber",
    "memberName",
    "amountOfLoan",
    "termValue",
    "termUnit",
    "dateReleased",
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

  const memberMap = options.memberRefByBodyNormLower
  const items: LoanImportParsedRow[] = []
  const errors: LoanImportRowError[] = []
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
    const amountRaw = pick(row, colToField, "amountOfLoan")
    const termValRaw = pick(row, colToField, "termValue")
    const termUnitRaw = strVal(pick(row, colToField, "termUnit"))
    const procFeeStr = strVal(pick(row, colToField, "processingFeeRate"))
    const insStr = strVal(pick(row, colToField, "insuranceAmount"))
    const dateRelRaw = pick(row, colToField, "dateReleased")
    const reasonRaw = strVal(pick(row, colToField, "reason"))

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

    const amountOfLoan = parseDecimal(amountRaw)
    if (amountOfLoan === null || amountOfLoan <= 0) {
      pushErr("Amount of loan must be a number greater than 0.")
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

    const monthsCount =
      termUnit === "years" ? termValue * 12 : termValue
    if (monthsCount <= 0) {
      pushErr("Term must produce at least one payment month.")
      continue
    }

    const procParsed = procFeeStr === "" ? null : parseDecimal(procFeeStr)
    const processingFeeRate =
      procFeeStr === ""
        ? autoProcessingFeeRate(amountOfLoan)
        : procParsed !== null && procParsed >= 0
          ? procParsed
          : null
    if (processingFeeRate === null) {
      pushErr("Processing fee must be a number ≥ 0 or leave the cell blank.")
      continue
    }

    const processingFeeRateNorm = normalizeStoredProcessingFeeRate(processingFeeRate)

    const insParsed = insStr === "" ? 0 : parseDecimal(insStr)
    const insuranceAmount =
      insStr === ""
        ? 0
        : insParsed !== null && insParsed >= 0
          ? insParsed
          : null
    if (insuranceAmount === null) {
      pushErr("Insurance amount must be a number ≥ 0 or left blank for 0.")
      continue
    }

    const dateReleased = parseIsoDate(dateRelRaw)
    if (!dateReleased) {
      pushErr(
        "Date released is missing or invalid (use YYYY-MM-DD or an Excel date).",
      )
      continue
    }

    const base = new Date(dateReleased)
    if (Number.isNaN(base.getTime())) {
      pushErr("Date released is invalid.")
      continue
    }

    const maturityDate = toYmd(
      termUnit === "months"
        ? addMonths(base, termValue)
        : addYears(base, termValue),
    )

    const capitalBuildUpAmount = amountOfLoan * 0.02
    const amountRelease = Math.max(
      0,
      amountOfLoan - capitalBuildUpAmount - insuranceAmount,
    )

    const processingFeeAmount = amountOfLoan * (processingFeeRateNorm / 100)
    const monthlyRate = INTEREST_RATE / 100
    const paymentRows = buildDiminishingSchedule(
      amountOfLoan,
      monthsCount,
      monthlyRate,
      processingFeeAmount,
      base,
    )

    if (paymentRows.length === 0) {
      pushErr("Unable to build payment schedule for this row.")
      continue
    }

    const schedule = paymentRows.map((r: AmortRow) => ({
      dueDate: r.dueDate,
      interest: r.interest,
      principal: r.principal,
      total: r.total,
      balance: r.balance,
      processingFee: r.processingFee,
      payment: r.payment,
    }))

    const payload: LoanCreatePayload = {
      memberId: memberRef.id,
      bodyNumber: memberRef.bodyNumber,
      memberName: memberRef.memberName,
      loanType: "regular",
      amountOfLoan,
      termValue,
      termUnit,
      processingFeeRate: processingFeeRateNorm,
      interestRate: INTEREST_RATE,
      insuranceAmount,
      capitalBuildUpAmount,
      amountRelease,
      dateReleased,
      maturityDate,
      schedule,
      paidDueDates: [],
      payments: [],
    }
    if (reasonRaw) {
      payload.reason = reasonRaw
    }

    items.push({ excelRow, payload })
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

export function buildEmergencyLoanImportTemplateBuffer(): ArrayBuffer {
  const headers = [
    "Body #",
    "Member name (must match member list)",
    "Amount of loan",
    "Date released (YYYY-MM-DD)",
    "Reason (required)",
  ]
  const sampleRow = [
    "SAMPLE-DELETE-ME",
    "Sample Member Name",
    "10000",
    "2025-01-15",
    "Medical",
  ]
  const wb = XLSX.utils.book_new()
  const rows = [headers, sampleRow]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(48, Math.max(14, h.length + 4)),
  }))
  XLSX.utils.book_append_sheet(wb, ws, EMERGENCY_LOAN_IMPORT_SHEET)
  return XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true })
}

export function downloadEmergencyLoanImportTemplate(): void {
  const buf = buildEmergencyLoanImportTemplateBuffer()
  triggerXlsxDownload("emergency-loans-import-template", buf)
}

export function parseEmergencyLoanImportRows(
  arrayBuffer: ArrayBuffer,
  options: LoanImportParseOptions,
): {
  items: LoanImportParsedRow[]
  errors: LoanImportRowError[]
} {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true })
  const sheetName =
    wb.SheetNames.find(
      (n) => n.trim().toLowerCase() === EMERGENCY_LOAN_IMPORT_SHEET.toLowerCase(),
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
  const colToField = buildFieldMap(headerRow, EMERGENCY_HEADER_SYNONYMS)
  const requiredFields = [
    "bodyNumber",
    "memberName",
    "amountOfLoan",
    "dateReleased",
    "reason",
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

  const memberMap = options.memberRefByBodyNormLower
  const items: LoanImportParsedRow[] = []
  const errors: LoanImportRowError[] = []
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
    const amountRaw = pick(row, colToField, "amountOfLoan")
    const dateRelRaw = pick(row, colToField, "dateReleased")
    const reasonRaw = strVal(pick(row, colToField, "reason"))

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

    const amountOfLoan = parseDecimal(amountRaw)
    if (amountOfLoan === null || amountOfLoan <= 0) {
      pushErr("Amount of loan must be a number greater than 0.")
      continue
    }

    const dateReleased = parseIsoDate(dateRelRaw)
    if (!dateReleased) {
      pushErr(
        "Date released is missing or invalid (use YYYY-MM-DD or an Excel date).",
      )
      continue
    }

    if (!reasonRaw) {
      pushErr("Reason is required.")
      continue
    }

    const payload: LoanCreatePayload = {
      memberId: memberRef.id,
      bodyNumber: memberRef.bodyNumber,
      memberName: memberRef.memberName,
      loanType: "emergency",
      amountOfLoan,
      termValue: 0,
      termUnit: "months",
      processingFeeRate: 0,
      interestRate: INTEREST_RATE,
      insuranceAmount: 0,
      capitalBuildUpAmount: 0,
      amountRelease: amountOfLoan,
      dateReleased,
      maturityDate: dateReleased,
      reason: reasonRaw,
      schedule: [],
      paidDueDates: [],
      payments: [],
      emergencySettled: false,
      emergencyPaidOn: null,
      emergencyAmountPaid: null,
    }

    items.push({ excelRow, payload })
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
