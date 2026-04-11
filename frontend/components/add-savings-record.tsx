"use client"

import * as React from "react"

import { useAppToast } from "@/components/app-toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { createSavingsRecord } from "@/lib/savings-api"
import { fetchMembers } from "@/lib/members-api"
import type { Member } from "@/lib/member-types"

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

function toNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function AddSavingsRecord({ onSaved }: { onSaved?: () => void }) {
  const { showToast } = useAppToast()
  const [members, setMembers] = React.useState<Member[]>([])
  const [membersLoading, setMembersLoading] = React.useState(true)
  const [memberId, setMemberId] = React.useState("")
  const [date, setDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [amount, setAmount] = React.useState("")
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
    () => members.find((m) => m.id === memberId) ?? null,
    [members, memberId]
  )

  async function onSave() {
    if (!selectedMember) return showToast("Member is required.", "error")
    if (!date) return showToast("Date is required.", "error")
    if (amountNum <= 0) return showToast("Amount is required.", "error")
    setSavePending(true)
    try {
      await createSavingsRecord({
        memberId: selectedMember.id,
        bodyNumber: selectedMember.bodyNumber,
        memberName: memberDisplayName(selectedMember),
        date,
        amount: amountNum,
      })
      showToast("Savings recorded.", "success")
      setAmount("")
      setDate(new Date().toISOString().slice(0, 10))
      onSaved?.()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save."
      showToast(msg, "error")
    } finally {
      setSavePending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="add-savings-member">Member</Label>
          <SearchableSelect
            id="add-savings-member"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            disabled={membersLoading || savePending}
          >
            <option value="">
              {membersLoading ? "Loading members…" : "Select Body # — Name"}
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {`${cleanBodyNumber(m.bodyNumber)} — ${memberDisplayName(m)}`}
              </option>
            ))}
          </SearchableSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-savings-date">Date</Label>
          <Input
            id="add-savings-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={savePending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-savings-amount">Amount</Label>
          <Input
            id="add-savings-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={savePending}
          />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={onSave}
          disabled={savePending}
          className="bg-black text-white hover:bg-black/90"
        >
          {savePending ? "Saving…" : "Save savings"}
        </Button>
      </div>
    </div>
  )
}
