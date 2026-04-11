import { DriverListPage } from "@/components/driver-list-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Driver Management",
}

export default function Page() {
  return <DriverListPage />
}
