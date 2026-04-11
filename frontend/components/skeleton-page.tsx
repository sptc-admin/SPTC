import type { ReactNode } from "react"

import { SiteHeader } from "@/components/site-header"

export function SkeletonPage({
  children,
  headerTrailing,
}: {
  children: ReactNode
  headerTrailing?: ReactNode
}) {
  return (
    <>
      <SiteHeader trailing={headerTrailing} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          {children}
        </div>
      </div>
    </>
  )
}
