"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { adminNavActions, appNavItems } from "@/lib/app-nav"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const defaultUser = {
  name: "User",
  role: "staff",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [user, setUser] = React.useState(defaultUser)

  React.useEffect(() => {
    try {
      const rawUser = localStorage.getItem("auth_user")
      if (!rawUser) return

      const parsedUser = JSON.parse(rawUser) as {
        role?: string
        name?: string
        firstname?: string
        lastname?: string
        username?: string
      }
      const role = (parsedUser.role ?? "staff").toLowerCase()
      const fullName = [parsedUser.firstname, parsedUser.lastname]
        .filter(Boolean)
        .join(" ")
        .trim()
      setIsAdmin(role === "admin")
      setUser({
        name: fullName || parsedUser.name || parsedUser.username || defaultUser.name,
        role,
      })
    } catch {
      setIsAdmin(false)
      setUser(defaultUser)
    }
  }, [])

  const adminSectionItems = React.useMemo(() => {
    if (!isAdmin) return []
    const staff = appNavItems.find((item) => item.href === "/staff")
    return staff ? [staff, ...adminNavActions] : [...adminNavActions]
  }, [isAdmin])
  const mainNavItems = appNavItems.filter((item) => item.href !== "/staff")

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <Image src="/logo.png" alt="SPTC logo" width={32} height={32} className="rounded-sm" />
                <span className="text-base font-semibold">SPTC</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNavItems} />
        {adminSectionItems.length ? (
          <div className="mt-auto">
            <NavMain items={adminSectionItems} title="Admin Actions" />
          </div>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
