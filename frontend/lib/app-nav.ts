import type { LucideIcon } from "lucide-react"
import {
  BanIcon,
  CarIcon,
  ClipboardListIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  RepeatIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react"

export const appNavItems: {
  title: string
  href: string
  icon: LucideIcon
}[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Member Management", href: "/member", icon: UsersIcon },
  { title: "Driver Management", href: "/driver", icon: CarIcon },
  { title: "Financial Records", href: "/financial-records", icon: LandmarkIcon },
  { title: "Arkilahan", href: "/arkilahan", icon: ClipboardListIcon },
  { title: "Lipatan", href: "/lipatan", icon: RepeatIcon },
  { title: "Staff Management", href: "/staff", icon: UsersIcon },
  { title: "Suspension Module", href: "/suspension", icon: BanIcon },
  { title: "Operations Module", href: "/operations", icon: WrenchIcon },
  { title: "Audit Trail", href: "/audit", icon: ShieldCheckIcon },
]

export const pageTitles: Record<string, string> = Object.fromEntries([
  ...appNavItems.map((i) => [i.href, i.title] as const),
  ["/account", "Account"] as const,
])

export function titleForPath(pathname: string): string {
  return pageTitles[pathname] ?? "SPTC"
}
