"use client"

import * as React from "react"

import { useAppToast } from "@/components/app-toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  processingFeeVsAmountError,
  normalizeStoredProcessingFeeRate,
} from "@/lib/loan-processing-fee"
import {
  DIMINISHING_SCHEDULE_FACTOR,
  buildDiminishingSchedule,
  formatDateLong,
  toYmd,
  type AmortRow,
} from "@/lib/loan-schedule"
import { createLoan } from "@/lib/loans-api"
import { fetchMembers } from "@/lib/members-api"
import type { Member } from "@/lib/member-types"

type TermUnit = "months" | "years"

function toNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + years)
  return next
}

function cleanString(str: string): string {
  return str.replace(/,/g, "").trim()
}

function memberDisplayName(member: Member): string {
  const parts = [
    cleanString(member.fullName.first),
    cleanString(member.fullName.middle),
    cleanString(member.fullName.last),
    cleanString(member.fullName.suffix),
  ].filter(Boolean)
  return parts.join(" ")
}

function cleanBodyNumber(bodyNumber: string): string {
  return bodyNumber.replace(/,/g, "").trim()
}

export function AddRegularLoan({
  onSaved,
}: {
  onSaved?: () => void
}) {
  const { showToast } = useAppToast()

  const [memberId, setMemberId] = React.useState("")
  const [members, setMembers] = React.useState<Member[]>([])
  const [membersLoading, setMembersLoading] = React.useState(true)
  const [amountOfLoan, setAmountOfLoan] = React.useState("")
  const [termValue, setTermValue] = React.useState("")
  const [termUnit, setTermUnit] = React.useState<TermUnit>("months")
  const [processingFeeRate, setProcessingFeeRate] = React.useState("0")
  const [insurance, setInsurance] = React.useState("")
  const [dateReleased, setDateReleased] = React.useState("")
  const [savePending, setSavePending] = React.useState(false)

  const amount = toNumber(amountOfLoan)
  const terms = Math.max(0, Math.floor(toNumber(termValue)))
  const processingFeeRateNum = Math.max(
    0,
    normalizeStoredProcessingFeeRate(toNumber(processingFeeRate)),
  )
  const interestRate = 1.5
  const capitalBuildUp = amount * 0.02
  const processingFeeAmount = amount * (processingFeeRateNum / 100)
  const insuranceAmount = Math.max(0, toNumber(insurance))
  const amountRelease = Math.max(0, amount - capitalBuildUp - insuranceAmount)

  React.useEffect(() => {
    let cancelled = false
    setMembersLoading(true)
    fetchMembers()
      .then((list) => {
        if (cancelled) return
        setMembers(list)
        setMemberId((prev) => prev)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : "Failed to load members."
        showToast(msg, "error")
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showToast])

  React.useEffect(() => {
    if (!amount) {
      setProcessingFeeRate("0")
      return
    }
    setProcessingFeeRate(amount <= 30000 ? "3" : "6")
  }, [amount])

  const selectedMember = React.useMemo(
    () => members.find((item) => item.id === memberId) ?? null,
    [members, memberId]
  )

  const monthsCount =
    termUnit === "years" ? Math.max(0, terms * 12) : Math.max(0, terms)
  const monthlyRate = interestRate / 100

  const maturityDateValue = React.useMemo(() => {
    if (!dateReleased || !terms) return ""
    const base = new Date(dateReleased)
    if (Number.isNaN(base.getTime())) return ""
    const maturity =
      termUnit === "months" ? addMonths(base, terms) : addYears(base, terms)
    return toYmd(maturity)
  }, [dateReleased, termUnit, terms])

  const maturityDateDisplay = React.useMemo(() => {
    if (!maturityDateValue) return ""
    return formatDateLong(new Date(maturityDateValue))
  }, [maturityDateValue])

  const paymentRows = React.useMemo(() => {
    if (!dateReleased || !monthsCount || amount <= 0) return []
    const base = new Date(dateReleased)
    if (Number.isNaN(base.getTime())) return []
    return buildDiminishingSchedule(
      amount,
      monthsCount,
      monthlyRate,
      processingFeeAmount,
      base
    )
  }, [amount, dateReleased, monthsCount, monthlyRate, processingFeeAmount])

  const scheduleTotals = React.useMemo(() => {
    return paymentRows.reduce(
      (acc, row) => ({
        interest: acc.interest + row.interest,
        principal: acc.principal + row.principal,
        total: acc.total + row.total,
        processingFee: acc.processingFee + row.processingFee,
        payment: acc.payment + row.payment,
      }),
      { interest: 0, principal: 0, total: 0, processingFee: 0, payment: 0 }
    )
  }, [paymentRows])

  async function onSaveRegularLoan() {
    if (!selectedMember) return showToast("Member is required.", "error")
    if (amount <= 0) return showToast("Amount of loan is required.", "error")
    if (monthsCount <= 0) return showToast("Valid terms are required.", "error")
    if (!dateReleased) return showToast("Date released is required.", "error")
    if (!maturityDateValue) return showToast("Maturity is invalid.", "error")
    if (paymentRows.length === 0) {
      return showToast("Unable to generate payment schedule.", "error")
    }
    const feeRule = processingFeeVsAmountError(amount, processingFeeRateNum)
    if (feeRule) return showToast(feeRule, "error")

    setSavePending(true)
    try {
      await createLoan({
        memberId: selectedMember.id,
        bodyNumber: selectedMember.bodyNumber,
        memberName: memberDisplayName(selectedMember),
        loanType: "regular",
        amountOfLoan: amount,
        termValue: terms,
        termUnit,
        processingFeeRate: processingFeeRateNum,
        interestRate,
        insuranceAmount,
        capitalBuildUpAmount: capitalBuildUp,
        amountRelease,
        dateReleased,
        maturityDate: maturityDateValue,
        schedule: paymentRows.map((row: AmortRow) => ({
          dueDate: row.dueDate,
          interest: row.interest,
          principal: row.principal,
          total: row.total,
          balance: row.balance,
          processingFee: row.processingFee,
          payment: row.payment,
        })),
        paidDueDates: [],
      })
      showToast("Regular loan saved.", "success")
      onSaved?.()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save loan."
      showToast(msg, "error")
    } finally {
      setSavePending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="regular-loan-member">Member</Label>
          <SearchableSelect
            id="regular-loan-member"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            disabled={membersLoading || savePending}
          >
            <option value="">
              {membersLoading ? "Loading members..." : "Select Body # - Name"}
            </option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {`${cleanBodyNumber(member.bodyNumber)} - ${memberDisplayName(member)}`}
              </option>
            ))}
          </SearchableSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="regular-loan-amount">Amount of Loan</Label>
          <Input
            id="regular-loan-amount"
            type="number"
            min="0"
            step="0.01"
            value={amountOfLoan}
            onChange={(e) => setAmountOfLoan(e.target.value)}
            placeholder="Enter amount of loan"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="regular-loan-term">Terms</Label>
            <Input
              id="regular-loan-term"
              type="number"
              min="0"
              value={termValue}
              onChange={(e) => setTermValue(e.target.value)}
              placeholder="e.g. 2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="regular-loan-term-unit">Term Unit</Label>
            <SearchableSelect
              id="regular-loan-term-unit"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={termUnit}
              onChange={(e) => setTermUnit(e.target.value as TermUnit)}
              searchable={false}
            >
              <option value="months">Month/s</option>
              <option value="years">Year/s</option>
            </SearchableSelect>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="regular-loan-processing-fee">Processing Fee (%)</Label>
          <Input
            id="regular-loan-processing-fee"
            type="number"
            min="0"
            step="0.01"
            value={processingFeeRate}
            onChange={(e) => setProcessingFeeRate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Auto: 3% for 30,000 and below, 6% for 31,000 and above.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="regular-loan-interest">Interest (%)</Label>
          <Input
            id="regular-loan-interest"
            value={formatPercent(interestRate)}
            readOnly
          />
          <p className="text-xs text-muted-foreground">
            Diminishing: {formatPercent(interestRate)} per month on remaining
            balance. Total uses {formatPercent(DIMINISHING_SCHEDULE_FACTOR * 100)}.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="regular-loan-insurance">Insurance</Label>
          <Input
            id="regular-loan-insurance"
            type="number"
            min="0"
            step="0.01"
            value={insurance}
            onChange={(e) => setInsurance(e.target.value)}
            placeholder="Enter insurance amount"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="regular-loan-capital-build-up">Capital Build Up (2%)</Label>
          <Input
            id="regular-loan-capital-build-up"
            value={formatCurrency(capitalBuildUp)}
            readOnly
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="regular-loan-amount-release">Amount Release</Label>
          <Input
            id="regular-loan-amount-release"
            value={formatCurrency(amountRelease)}
            readOnly
          />
          <p className="text-xs text-muted-foreground">
            Amount of Loan - Capital Build Up (2%) - Insurance
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="regular-loan-date-released">Date Released</Label>
          <Input
            id="regular-loan-date-released"
            type="date"
            value={dateReleased}
            onChange={(e) => setDateReleased(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="regular-loan-maturity">Maturity</Label>
          <Input
            id="regular-loan-maturity"
            value={maturityDateDisplay}
            readOnly
            placeholder="Auto-computed from date released + terms"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Monthly Payment Preview</h3>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Due Date/Month</th>
                <th className="px-3 py-2 font-medium">Interest</th>
                <th className="px-3 py-2 font-medium">Principal</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Balance</th>
                <th className="px-3 py-2 font-medium">Processing Fee</th>
                <th className="px-3 py-2 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    Enter loan amount, terms, and date released to preview monthly
                    schedule.
                  </td>
                </tr>
              ) : (
                <>
                  <tr className="border-b bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">Start</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2 font-medium tabular-nums">
                      {formatCurrency(amount)}
                    </td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">—</td>
                  </tr>
                  {paymentRows.map((row, index) => (
                    <tr key={`${row.dueDate}-${index}`} className="border-b">
                      <td className="px-3 py-2">{row.dueLabel}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(row.interest)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(row.principal)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(row.total)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(row.balance)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(row.processingFee)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(row.payment)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-medium">
                    <td className="px-3 py-2">Totals</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatCurrency(scheduleTotals.interest)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatCurrency(scheduleTotals.principal)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatCurrency(scheduleTotals.total)}
                    </td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatCurrency(scheduleTotals.processingFee)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatCurrency(scheduleTotals.payment)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={onSaveRegularLoan}
          disabled={savePending}
          className="bg-black text-white hover:bg-black/90"
        >
          {savePending ? "Saving..." : "Save Regular Loan"}
        </Button>
      </div>
    </div>
  )
}
