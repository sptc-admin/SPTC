import { DashboardPage } from "@/components/dashboard-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
}

export default function Page() {
  return <DashboardPage />
}
