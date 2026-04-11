export type ArkilahanTermUnit = "months" | "years"

export type Arkilahan = {
  id: string
  date: string
  bodyNumber: string
  name: string
  fee: number
  dueDate: string
  termValue: number
  termUnit: ArkilahanTermUnit
  documentUrl?: string
  createdAt: string
  updatedAt: string
}
