import { LipatanPage } from "@/components/lipatan-page"
import { SiteHeader } from "@/components/site-header"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Lipatan",
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <LipatanPage />
      </div>
    </>
  )
}
