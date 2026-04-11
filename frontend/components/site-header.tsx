"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { titleForPath } from "@/lib/app-nav"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader({ trailing }: { trailing?: ReactNode }) {
  const pathname = usePathname() ?? ""
  const title = titleForPath(pathname)

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator
          orientation="vertical"
          className="mx-2 shrink-0 data-[orientation=vertical]:h-4"
        />
        <h1 className="min-w-0 truncate text-base font-medium">{title}</h1>
        {trailing ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">{trailing}</div>
        ) : null}
      </div>
    </header>
  )
}
