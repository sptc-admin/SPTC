import { MemberListPage } from "@/components/member-list-page"
import { SiteHeader } from "@/components/site-header"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Member Management",
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <MemberListPage />
      </div>
    </>
  )
}
