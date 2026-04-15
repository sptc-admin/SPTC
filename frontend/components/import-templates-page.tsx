"use client"

import * as React from "react"
import { Download } from "lucide-react"

import { useAppToast } from "@/components/app-toast-provider"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { downloadDriverImportTemplate } from "@/lib/driver-import"
import { downloadMemberImportTemplate } from "@/lib/member-import"

type Row = { label: string; onDownload: () => void }

function TemplateRows({ rows }: { rows: Row[] }) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {rows.map((row) => (
        <li
          key={row.label}
          className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-sm font-medium">{row.label}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => {
              row.onDownload()
            }}
          >
            <Download className="size-4" />
            Download
          </Button>
        </li>
      ))}
    </ul>
  )
}

export function ImportTemplatesPage() {
  const { showToast } = useAppToast()

  const wrap = React.useCallback(
    (fn: () => void) => {
      fn()
      showToast("Template downloaded.", "success")
    },
    [showToast],
  )

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Import Excel templates</CardTitle>
            <CardDescription>
              Blank workbooks for bulk import. Fill a sheet and use Import on
              the matching module page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateRows
              rows={[
                {
                  label: "Members",
                  onDownload: () => wrap(downloadMemberImportTemplate),
                },
                {
                  label: "Drivers",
                  onDownload: () => wrap(downloadDriverImportTemplate),
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
