import { FinancialRecordsPage } from "@/components/financial-records-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Financial Records",
}

export default function Page() {
  return <FinancialRecordsPage />
}
