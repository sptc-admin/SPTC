import { AppSidebar } from "@/components/app-sidebar"
import { ProtectedRoute } from "@/components/auth-guards"
import { SessionIdleGuard } from "@/components/session-idle-guard"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <SessionIdleGuard>
        <SidebarProvider>
          <AppSidebar variant="inset" />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </SessionIdleGuard>
    </ProtectedRoute>
  )
}
