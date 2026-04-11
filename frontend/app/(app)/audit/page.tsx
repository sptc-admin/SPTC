import { AuditTrailPage } from "@/components/audit-trail-page"
import { SiteHeader } from "@/components/site-header"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Audit Trail",
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <AuditTrailPage />
      </div>
    </>
  )
}
