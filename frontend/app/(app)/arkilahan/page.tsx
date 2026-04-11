import { ArkilahanListPage } from "@/components/arkilahan-list-page"
import { SiteHeader } from "@/components/site-header"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Arkilahan",
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <ArkilahanListPage />
      </div>
    </>
  )
}
