import * as XLSX from "xlsx"

export type CsvExportSection =
  | { title: string; kind: "keyValues"; pairs: [string, string | number][] }
  | {
      title: string
      kind: "table"
      headers: string[]
      rows: (string | number | null | undefined)[][]
    }

export function escapeCsvCell(value: unknown): string {
  if (value == null) return ""
  const s = String(value)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function csvRow(values: unknown[]): string {
  return values.map(escapeCsvCell).join(",")
}

export function buildCsvFromSections(sections: CsvExportSection[]): string {
  const out: string[] = []
  for (const s of sections) {
    out.push(csvRow([s.title]))
    if (s.kind === "keyValues") {
      for (const [k, v] of s.pairs) {
        out.push(csvRow([k, v]))
      }
    } else {
      out.push(csvRow(s.headers))
      for (const r of s.rows) {
        out.push(csvRow(r))
      }
    }
    out.push("")
  }
  return out.join("\r\n").replace(/\r\n$/, "")
}

export function triggerCsvDownload(fileBaseName: string, csvBody: string): void {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
  const name = `${fileBaseName}-${stamp}.csv`
  const blob = new Blob(["\uFEFF" + csvBody], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function sectionsToRows(sections: CsvExportSection[]): (string | number)[][] {
  const rows: (string | number)[][] = []
  for (const s of sections) {
    rows.push([s.title])
    if (s.kind === "keyValues") {
      for (const [k, v] of s.pairs) {
        rows.push([k, v])
      }
    } else {
      rows.push(s.headers.map((h) => String(h)))
      for (const r of s.rows) {
        rows.push(r.map((c) => (c == null ? "" : c)))
      }
    }
    rows.push([])
  }
  return rows
}

function columnWidthsForRows(rows: (string | number)[][]): XLSX.ColInfo[] {
  let maxCol = 0
  for (const r of rows) {
    maxCol = Math.max(maxCol, r.length - 1)
  }
  if (maxCol < 0) maxCol = 0

  const widths: XLSX.ColInfo[] = []
  for (let c = 0; c <= maxCol; c++) {
    let maxLen = 8
    for (const r of rows) {
      const cell = r[c]
      if (cell != null && cell !== "") {
        maxLen = Math.max(maxLen, String(cell).length)
      }
    }
    const wch = Math.min(100, Math.max(12, maxLen + 3))
    widths.push({ wch })
  }
  return widths
}

export function buildXlsxArrayBufferFromSections(
  sections: CsvExportSection[]
): ArrayBuffer {
  const rows = sectionsToRows(sections)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = columnWidthsForRows(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Export")
  return XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true })
}

export function triggerXlsxDownload(
  fileBaseName: string,
  workbookBuffer: ArrayBuffer
): void {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
  const name = `${fileBaseName}-${stamp}.xlsx`
  const blob = new Blob([workbookBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
