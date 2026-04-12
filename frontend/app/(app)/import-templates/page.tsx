import { ProtectedRoute } from "@/components/auth-guards"
import { ImportTemplatesPage } from "@/components/import-templates-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Import Excel Template",
}

export default function Page() {
  return (
    <ProtectedRoute requiredRole="admin">
      <ImportTemplatesPage />
    </ProtectedRoute>
  )
}
