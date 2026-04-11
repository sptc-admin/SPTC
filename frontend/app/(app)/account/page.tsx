import { AccountPage } from "@/components/account-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Account",
}

export default function Page() {
  return <AccountPage />
}
