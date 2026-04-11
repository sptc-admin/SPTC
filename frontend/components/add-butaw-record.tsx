"use client"

import * as React from "react"

import { useAppToast } from "@/components/app-toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { createButawRecord } from "@/lib/butaw-api"
import {
  BUTAW_MONTHLY_AMOUNT,
  addMonthsYm,
  defaultStartMonthForMember,
  formatButawMonthRange,
  isValidButawAmountPesos,
} from "@/lib/butaw-month"
import { butawSplit } from "@/lib/butaw-split"
import { fetchMembers } from "@/lib/members-api"
import type { ButawRecord } from "@/lib/butaw-types"
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value)
}

type PrefillMember = {
  memberId: string
  bodyNumber: string
  memberName: string
}

export function AddButawRecord({
  onSaved,
  prefillMember = null,
  allRecords = [],
}: {
  onSaved?: () => void
  prefillMember?: PrefillMember | null
  allRecords?: ButawRecord[]
}) {
  const { showToast } = useAppToast()
  const [members, setMembers] = React.useState<Member[]>([])
  const [membersLoading, setMembersLoading] = React.useState(true)
  const [memberId, setMemberId] = React.useState("")
  const [month, setMonth] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [savePending, setSavePending] = React.useState(false)

  const amountNum = Math.max(0, toNumber(amount))
  const preview = amountNum > 0 ? butawSplit(amountNum) : null

  const effectiveMemberId = prefillMember?.memberId ?? memberId

  const populatedMonthStart = React.useMemo(
    () => defaultStartMonthForMember(allRecords, effectiveMemberId),
    [allRecords, effectiveMemberId]
  )

  React.useEffect(() => {
    setMonth(populatedMonthStart)
  }, [populatedMonthStart])

  const monthTrim = month.trim()
  const monthYmOk = /^\d{4}-\d{2}$/.test(monthTrim)
  const monthsInPayment = isValidButawAmountPesos(amountNum)
    ? Math.round((amountNum * 100) / (BUTAW_MONTHLY_AMOUNT * 100))
    : 0
  const coverageEnd =
    monthYmOk && monthsInPayment >= 1
      ? addMonthsYm(monthTrim, monthsInPayment - 1)
      : null

  React.useEffect(() => {
    if (prefillMember?.memberId) setMemberId(prefillMember.memberId)
  }, [prefillMember?.memberId])

  React.useEffect(() => {
    let cancelled = false
    setMembersLoading(true)
    fetchMembers()
      .then((list) => {
        if (cancelled) return
        setMembers(list)
        setMemberId((prev) => {
          if (prefillMember?.memberId) return prefillMember.memberId
          return prev
        })
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
  }, [showToast, prefillMember?.memberId])

  const selectedMember = React.useMemo(
    () => members.find((m) => m.id === memberId) ?? null,
    [members, memberId]
  )

  async function onSave() {
    const resolvedId = prefillMember?.memberId ?? selectedMember?.id ?? ""
    const resolvedBody =
      prefillMember?.bodyNumber ?? selectedMember?.bodyNumber ?? ""
    const resolvedName = prefillMember
      ? prefillMember.memberName
      : selectedMember
        ? memberDisplayName(selectedMember)
        : ""
    if (!resolvedId || !resolvedBody) {
      return showToast("Member is required.", "error")
    }
    if (!isValidButawAmountPesos(amountNum)) {
      return showToast(
        `Amount must be a multiple of ${formatCurrency(BUTAW_MONTHLY_AMOUNT)}.`,
        "error"
      )
    }
    if (!monthYmOk) {
      return showToast("Choose a valid first month.", "error")
    }
    setSavePending(true)
    try {
      await createButawRecord({
        memberId: resolvedId,
        bodyNumber: resolvedBody,
        memberName: resolvedName,
        amount: amountNum,
        month: monthTrim,
        isAdvance: false,
      })
      showToast("Butaw recorded.", "success")
      setAmount("")
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
          <Label htmlFor="add-butaw-member">Member</Label>
          {prefillMember ? (
            <div
              id="add-butaw-member"
              className="flex h-9 items-center rounded-md border border-input bg-muted/30 px-3 text-sm tabular-nums"
            >
              <span className="font-medium">{prefillMember.bodyNumber}</span>
              <span className="mx-2 text-muted-foreground">—</span>
              <span>{prefillMember.memberName}</span>
            </div>
          ) : (
            <SearchableSelect
              id="add-butaw-member"
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
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-butaw-month">First month covered</Label>
          <Input
            id="add-butaw-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            disabled={savePending || !effectiveMemberId}
          />
          <p className="text-xs text-muted-foreground">
            Pre-filled as the next month after this member&apos;s latest covered
            period; you can change it if needed.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-butaw-amount">Amount paid</Label>
          <Input
            id="add-butaw-amount"
            type="number"
            min={BUTAW_MONTHLY_AMOUNT}
            step={BUTAW_MONTHLY_AMOUNT}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(BUTAW_MONTHLY_AMOUNT)}
            disabled={savePending}
          />
          <p className="text-xs text-muted-foreground">
            Each {formatCurrency(BUTAW_MONTHLY_AMOUNT)} covers one month. Amount
            must be a multiple of {formatCurrency(BUTAW_MONTHLY_AMOUNT)}.
          </p>
        </div>
        {effectiveMemberId && monthYmOk && coverageEnd ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Covers</p>
            <p className="mt-1 text-foreground">
              {formatButawMonthRange(monthTrim, coverageEnd)}
            </p>
            {monthsInPayment > 1 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {monthsInPayment} months ×{" "}
                {formatCurrency(BUTAW_MONTHLY_AMOUNT)}
              </p>
            ) : null}
          </div>
        ) : effectiveMemberId && amountNum > 0 && !isValidButawAmountPesos(amountNum) ? (
          <p className="text-xs text-amber-800">
            Enter a multiple of {formatCurrency(BUTAW_MONTHLY_AMOUNT)} to see the
            full range.
          </p>
        ) : null}
        {preview ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Split for this amount</p>
            <ul className="mt-2 grid gap-1 text-muted-foreground">
              <li className="flex justify-between gap-2">
                <span>Share capital</span>
                <span className="tabular-nums text-foreground">
                  {formatCurrency(preview.shareCapital)}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Monthly dues</span>
                <span className="tabular-nums text-foreground">
                  {formatCurrency(preview.monthlyDues)}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Member benefits</span>
                <span className="tabular-nums text-foreground">
                  {formatCurrency(preview.memberBenefits)}
                </span>
              </li>
            </ul>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Split: ₱30 share capital, ₱90 monthly dues, ₱30 member benefits per
          ₱150.
        </p>
      </div>
      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={onSave}
          disabled={savePending}
          className="bg-black text-white hover:bg-black/90"
        >
          {savePending ? "Saving…" : "Save payment"}
        </Button>
      </div>
    </div>
  )
}
