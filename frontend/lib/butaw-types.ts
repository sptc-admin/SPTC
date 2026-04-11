export type ButawRecord = {
  id: string
  memberId: string
  bodyNumber: string
  memberName: string
  month: string
  monthEnd?: string | null
  amount: number
  isAdvance?: boolean
  createdAt: string
  updatedAt: string
}
