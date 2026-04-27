"use client"

import * as React from "react"

import { useAppToast } from "@/components/app-toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  EMERGENCY_REFERENCE_MONTHS,
  emergencyInterest,
  emergencyTotalPayment,
} from "@/lib/emergency-loan"
import { createLoan } from "@/lib/loans-api"
import { fetchMembers } from "@/lib/members-api"
import type { Member } from "@/lib/member-types"

const PREVIEW_MONTHS = 3

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

export function AddEmergencyLoan({ onSaved }: { onSaved?: () => void }) {
  const { showToast } = useAppToast()

  const [memberId, setMemberId] = React.useState("")
  const [members, setMembers] = React.useState<Member[]>([])
  const [membersLoading, setMembersLoading] = React.useState(true)
  const [dateReleased, setDateReleased] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [savePending, setSavePending] = React.useState(false)

  const amountNum = Math.max(0, toNumber(amount))

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

  const selectedMember = React.useMemo(
    () => members.find((item) => item.id === memberId) ?? null,
    [members, memberId]
  )

  async function onSaveEmergencyLoan() {
    if (!selectedMember) return showToast("Member is required.", "error")
    if (!dateReleased) return showToast("Date released is required.", "error")
    if (amountNum <= 0) return showToast("Amount is required.", "error")
    if (!reason.trim()) return showToast("Reason is required.", "error")

    setSavePending(true)
    try {
      await createLoan({
        memberId: selectedMember.id,
        bodyNumber: selectedMember.bodyNumber,
        memberName: memberDisplayName(selectedMember),
        loanType: "emergency",
        amountOfLoan: amountNum,
        termValue: 0,
        termUnit: "months",
        processingFeeRate: 0,
        interestRate: 1.5,
        insuranceAmount: 0,
        capitalBuildUpAmount: 0,
        amountRelease: amountNum,
        dateReleased,
        maturityDate: dateReleased,
        reason: reason.trim(),
        schedule: [],
        paidDueDates: [],
        payments: [],
        emergencySettled: false,
        emergencyPaidOn: null,
        emergencyAmountPaid: null,
      })
      showToast("Emergency loan saved.", "success")
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
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="emergency-loan-member">Member</Label>
          <SearchableSelect
            id="emergency-loan-member"
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
          <Label htmlFor="emergency-loan-date-released">Date Released</Label>
          <Input
            id="emergency-loan-date-released"
            type="date"
            value={dateReleased}
            onChange={(e) => setDateReleased(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergency-loan-amount">Amount</Label>
          <Input
            id="emergency-loan-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergency-loan-reason">Reason</Label>
          <Input
            id="emergency-loan-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason"
          />
        </div>

        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <p className="font-medium">Payment by month</p>
          <div className="mt-3 overflow-x-auto rounded border bg-background">
            <table className="w-full min-w-[360px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 font-medium">Interest</th>
                  <th className="px-3 py-2 font-medium">Total payment</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(
                  { length: EMERGENCY_REFERENCE_MONTHS },
                  (_, i) => i + 1
                ).map(
                  (n) => (
                    <tr key={n} className="border-b last:border-0">
                      <td className="px-3 py-2 tabular-nums">{n}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(emergencyInterest(amountNum, n))}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(emergencyTotalPayment(amountNum, n))}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={onSaveEmergencyLoan}
          disabled={savePending}
          className="bg-black text-white hover:bg-black/90"
        >
          {savePending ? "Saving..." : "Save Emergency Loan"}
        </Button>
      </div>
    </div>
  )
}
