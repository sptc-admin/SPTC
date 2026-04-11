import { FinancialRecordsPage } from "@/components/financial-records-page"
import { SiteHeader } from "@/components/site-header"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Financial Records",
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <FinancialRecordsPage />
      </div>
    </>
  )
}
