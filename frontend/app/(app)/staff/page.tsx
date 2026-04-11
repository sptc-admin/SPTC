import { ProtectedRoute } from "@/components/auth-guards"
import { StaffListPage } from "@/components/staff-list-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Staff Management",
}

export default function Page() {
  return (
    <ProtectedRoute requiredRole="admin">
      <StaffListPage />
    </ProtectedRoute>
  )
}
