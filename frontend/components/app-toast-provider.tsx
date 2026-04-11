"use client"

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type ToastType = "success" | "error"

type ToastState = {
  message: string
  type: ToastType
  visible: boolean
}

type ToastContextValue = {
  showToast: (message: string, type: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function AppToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type, visible: true })
  }, [])

  useEffect(() => {
    if (!toast) return

    const fadeOutTimer = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: false } : null))
    }, 2500)
    const clearTimer = setTimeout(() => {
      setToast(null)
    }, 3000)

    return () => {
      clearTimeout(fadeOutTimer)
      clearTimeout(clearTimer)
    }
  }, [toast?.message, toast?.type])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Alert
          variant={toast.type === "error" ? "destructive" : "default"}
          className={`fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm border transition-opacity duration-500 ${
            toast.visible ? "opacity-100" : "opacity-0"
          } ${toast.type === "success" ? "border-green-200 bg-green-50 text-green-800" : ""}`}
        >
          {toast.type === "success" ? (
            <CheckCircle2Icon className="h-4 w-4" />
          ) : (
            <AlertCircleIcon className="h-4 w-4" />
          )}
          <AlertTitle>{toast.type === "success" ? "Success" : "Error"}</AlertTitle>
          <AlertDescription>{toast.message}</AlertDescription>
        </Alert>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useAppToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useAppToast must be used within AppToastProvider")
  }
  return context
}
