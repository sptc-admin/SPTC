 "use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAppToast } from "@/components/app-toast-provider"
import { PageLoader } from "@/components/page-loader"
import { getPublicApiUrl } from "@/lib/api-base"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const { showToast } = useAppToast()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`${getPublicApiUrl()}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      })

      if (!response.ok) {
        showToast("Invalid username or password", "error")
        return
      }

      const data = await response.json()
      localStorage.setItem("auth_user", JSON.stringify(data.user))
      showToast(data.message ?? "Login successful", "success")
      setTimeout(() => {
        router.push("/dashboard")
      }, 700)
    } catch {
      showToast("Unable to connect to server", "error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("relative flex flex-col gap-6", className)} {...props}>
      {isLoading ? (
        <PageLoader message="Signing in…" className="rounded-lg" />
      ) : null}
      <Card className="overflow-hidden border-0 bg-page shadow-sm">
        <CardContent className="grid p-0 md:grid-cols-2 md:min-h-[560px]">
          <form
            className="flex flex-col justify-center p-6 md:p-8 bg-white md:min-h-[560px]"
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-balance text-muted-foreground">
                  Login to your SPTC account
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="example"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setForgotPasswordOpen(true)}
                    className="cursor-pointer text-sm text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-black hover:bg-black/90 text-white"
              >
                Login
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account? Contact admin
              </div>
            </div>
          </form>
          <div className="hidden bg-page md:flex md:min-h-[560px] items-center justify-center p-8 text-center">
            <div className="flex flex-col items-center gap-6">
              <Image
                src="/logo.png"
                alt="SPTC Logo"
                width={160}
                height={160}
                className="h-40 w-40 object-contain"
                priority
              />
              <p className="max-w-sm text-4xl font-semibold leading-snug text-foreground">
                Sapang Palay Tricycle Service Cooperative (SPTC)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground">
        By logging in, you agree to our{" "}
        <Link
          href="/privacy-policy"
          className="cursor-pointer underline underline-offset-4 hover:text-primary"
        >
          Privacy Policy
        </Link>
        .
      </div>

      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forgot Password?</DialogTitle>
            <DialogDescription>
              To reset your password, please contact any administrator. They will assist you in resetting your account credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setForgotPasswordOpen(false)}
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
