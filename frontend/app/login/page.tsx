import type { Metadata } from "next"
import { GuestOnlyRoute } from "@/components/auth-guards"
import { LoginForm } from "@/components/login-form"

export const metadata: Metadata = {
  title: "Login",
}

export default function LoginPage() {
  return (
    <GuestOnlyRoute>
      <div className="flex min-h-svh flex-col items-center justify-center bg-page p-6 md:p-10">
        <div className="w-full max-w-sm md:max-w-3xl">
          <LoginForm />
        </div>
      </div>
    </GuestOnlyRoute>
  )
}
