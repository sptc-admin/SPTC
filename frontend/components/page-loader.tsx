"use client"

import { cn } from "@/lib/utils"
import Image from "next/image"

export function PageLoader({
  className,
  fullscreen = true,
  message,
}: {
  className?: string
  fullscreen?: boolean
  message?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        fullscreen && "fixed inset-0 z-50 bg-background/85 backdrop-blur-sm",
        !fullscreen && "min-h-[200px] w-full p-8",
        className,
      )}
    >
      <div className="relative flex size-32 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border-2 border-muted border-t-foreground/40 opacity-70 animate-[sptc-spin_1.35s_linear_infinite]"
          aria-hidden
        />
        <Image
          src="/icon.png"
          alt=""
          width={112}
          height={112}
          className="relative z-10 size-[5.5rem] object-contain animate-[sptc-breathe_2.2s_ease-in-out_infinite]"
          priority
        />
      </div>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  )
}
