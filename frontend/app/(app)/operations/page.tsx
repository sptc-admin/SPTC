import { OperationsListPage } from "@/components/operations-list-page"
import { SiteHeader } from "@/components/site-header"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Operations Module",
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <OperationsListPage />
      </div>
    </>
  )
}
