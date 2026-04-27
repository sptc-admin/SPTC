export type LoanScheduleRow = {
  dueDate: string
  interest: number
  principal: number
  total: number
  balance: number
  processingFee: number
  payment: number
}

export type LoanPaymentRecord = {
  dueDate: string
  amount: number
}

export type Loan = {
  id: string
  memberId: string
  bodyNumber: string
  memberName: string
  loanType: string
  amountOfLoan: number
  termValue: number
  termUnit: "months" | "years"
  processingFeeRate: number
  interestRate: number
  insuranceAmount: number
  capitalBuildUpAmount: number
  amountRelease: number
  dateReleased: string
  maturityDate: string
  reason?: string | null
  schedule: LoanScheduleRow[]
  paidDueDates?: string[] | null
  payments?: LoanPaymentRecord[] | null
  emergencySettled?: boolean
  emergencyPaidOn?: string | null
  emergencyAmountPaid?: number | null
  createdAt: string
  updatedAt: string
}
