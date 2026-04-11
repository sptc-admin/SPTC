import { ProtectedRoute } from "@/components/auth-guards"
import { SiteHeader } from "@/components/site-header"
import { StaffListPage } from "@/components/staff-list-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Staff Management",
}

export default function Page() {
  return (
    <ProtectedRoute requiredRole="admin">
      <>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <StaffListPage />
        </div>
      </>
    </ProtectedRoute>
  )
}
