export type StaffRole = "admin" | "staff"

export type StaffUser = {
  id: number
  username: string
  firstname: string
  lastname: string
  role: StaffRole
  enabled: boolean
}
