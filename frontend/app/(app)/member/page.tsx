import { MemberListPage } from "@/components/member-list-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Member Management",
}

export default function Page() {
  return <MemberListPage />
}
