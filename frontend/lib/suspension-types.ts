export type SuspensionStatus = "active" | "cleared"

export type Suspension = {
  id: string
  driverId: string
  bodyNumber: string
  driverName: string
  startDate: string
  endDate: string
  status: SuspensionStatus
  createdAt: string
  updatedAt: string
}
