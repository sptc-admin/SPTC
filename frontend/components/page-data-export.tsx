"use client"

import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  buildXlsxArrayBufferFromSections,
  triggerXlsxDownload,
  type CsvExportSection,
} from "@/lib/csv-export"
import { createAuditLogEvent } from "@/lib/audit-logs-api"
import { formatAuthActorLabel } from "@/lib/auth-actor"
import { cn } from "@/lib/utils"

export type { CsvExportSection }

type PageDataExportButtonProps = {
  fileBaseName: string
  moduleName: string
  getSections: () => CsvExportSection[]
  label?: string
  disabled?: boolean
  className?: string
}

export function PageDataExportButton({
  fileBaseName,
  moduleName,
  getSections,
  label = "Export",
  disabled,
  className,
}: PageDataExportButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(className)}
      disabled={disabled}
      onClick={() => {
        const buf = buildXlsxArrayBufferFromSections(getSections())
        triggerXlsxDownload(fileBaseName, buf)
        void createAuditLogEvent({
          module: moduleName,
          action: "export",
          message: `${formatAuthActorLabel()} exported ${moduleName} data to Excel.`,
          method: "EXPORT",
          path: `/${moduleName}/export`,
        }).catch(() => {})
      }}
    >
      <Download className="size-4" aria-hidden />
      {label}
    </Button>
  )
}
