import { SuspensionListPage } from "@/components/suspension-list-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Suspension Module",
}

export default function Page() {
  return <SuspensionListPage />
}
