import { OperationsListPage } from "@/components/operations-list-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Operations Module",
}

export default function Page() {
  return <OperationsListPage />
}
