import { SiteHeader } from "@/components/site-header"
import { SuspensionListPage } from "@/components/suspension-list-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Suspension Module",
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <SuspensionListPage />
      </div>
    </>
  )
}
