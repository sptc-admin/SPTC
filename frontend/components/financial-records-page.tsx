"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { AddEmergencyLoan } from "@/components/add-emergency-loan"
import { AddRegularLoan } from "@/components/add-regular-loan"
import { LoansListTable } from "@/components/loans-list-table"
import { ButawRecordsSection } from "@/components/butaw-records-section"
import { SavingsRecordsSection } from "@/components/savings-records-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type MainTab = "loan" | "savings" | "butaw"
type LoanType = "regular" | "emergency"

const loanTypePillClass =
  "rounded-md border px-3 py-2 text-sm font-medium transition-colors"

export function FinancialRecordsPage() {
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const requestedLoanType = searchParams.get("loanType")
  const targetLoanId = searchParams.get("loanId")
  const defaultTab: MainTab =
    requestedTab === "savings" || requestedTab === "butaw" ? requestedTab : "loan"
  const defaultLoanType: LoanType =
    requestedLoanType === "emergency" ? "emergency" : "regular"

  const [mainTab, setMainTab] = React.useState<MainTab>(defaultTab)
  const [loanType, setLoanType] = React.useState<LoanType>(defaultLoanType)
  const [addLoanOpen, setAddLoanOpen] = React.useState(false)
  const [addLoanKey, setAddLoanKey] = React.useState(0)
  const [addEmergencyOpen, setAddEmergencyOpen] = React.useState(false)
  const [addEmergencyKey, setAddEmergencyKey] = React.useState(0)
  const [loansRefreshKey, setLoansRefreshKey] = React.useState(0)

  React.useEffect(() => {
    setMainTab(defaultTab)
  }, [defaultTab])

  React.useEffect(() => {
    setLoanType(defaultLoanType)
  }, [defaultLoanType])

  function openAddLoan() {
    setAddLoanKey((k) => k + 1)
    setAddLoanOpen(true)
  }

  function onLoanSaved() {
    setLoansRefreshKey((k) => k + 1)
    setAddLoanOpen(false)
  }

  function openAddEmergencyLoan() {
    setAddEmergencyKey((k) => k + 1)
    setAddEmergencyOpen(true)
  }

  function onEmergencyLoanSaved() {
    setLoansRefreshKey((k) => k + 1)
    setAddEmergencyOpen(false)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Financial Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className="inline-flex w-full max-w-xl flex-col gap-1 rounded-xl border border-border bg-muted/40 p-1.5 sm:flex-row sm:items-stretch"
            role="tablist"
            aria-label="Financial records sections"
          >
            {(
              [
                ["loan", "Loan"] as const,
                ["savings", "Savings"] as const,
                ["butaw", "Butaw"] as const,
              ] satisfies [MainTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mainTab === id}
                onClick={() => setMainTab(id)}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all sm:py-3",
                  mainTab === id
                    ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mainTab === "loan" ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Loan type">
                <button
                  type="button"
                  role="tab"
                  aria-selected={loanType === "regular"}
                  onClick={() => setLoanType("regular")}
                  className={cn(
                    loanTypePillClass,
                    loanType === "regular"
                      ? "border-black bg-black text-white"
                      : "border-input bg-white"
                  )}
                >
                  Regular Loan
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={loanType === "emergency"}
                  onClick={() => setLoanType("emergency")}
                  className={cn(
                    loanTypePillClass,
                    loanType === "emergency"
                      ? "border-black bg-black text-white"
                      : "border-input bg-white"
                  )}
                >
                  Emergency Loan
                </button>
              </div>

              {loanType === "regular" ? (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Regular loans for members. Add a loan to enter details and
                      preview amortization.
                    </p>
                    <Button
                      type="button"
                      onClick={openAddLoan}
                      className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
                    >
                      <Plus className="size-4" />
                      Add regular loan
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Loan list</h3>
                    <LoansListTable
                      refreshKey={loansRefreshKey}
                      loanType="regular"
                      initialViewLoanId={
                        mainTab === "loan" && loanType === "regular"
                          ? targetLoanId
                          : null
                      }
                      onLoanUpdated={() =>
                        setLoansRefreshKey((k) => k + 1)
                      }
                    />
                  </div>

                  <Sheet
                    open={addLoanOpen}
                    onOpenChange={(open) => {
                      setAddLoanOpen(open)
                    }}
                  >
                    <SheetContent
                      side="right"
                      className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-4xl"
                    >
                      <SheetHeader className="pb-4">
                        <SheetTitle>Add regular loan</SheetTitle>
                      </SheetHeader>
                      <AddRegularLoan key={addLoanKey} onSaved={onLoanSaved} />
                    </SheetContent>
                  </Sheet>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Emergency loans have no fixed monthly due date. Use the
                      reference table as a guide to amounts by months from the
                      release date.
                    </p>
                    <Button
                      type="button"
                      onClick={openAddEmergencyLoan}
                      className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
                    >
                      <Plus className="size-4" />
                      Add emergency loan
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Emergency loan list</h3>
                    <LoansListTable
                      refreshKey={loansRefreshKey}
                      loanType="emergency"
                      initialViewLoanId={
                        mainTab === "loan" && loanType === "emergency"
                          ? targetLoanId
                          : null
                      }
                      onLoanUpdated={() =>
                        setLoansRefreshKey((k) => k + 1)
                      }
                    />
                  </div>

                  <Sheet
                    open={addEmergencyOpen}
                    onOpenChange={(open) => {
                      setAddEmergencyOpen(open)
                    }}
                  >
                    <SheetContent
                      side="right"
                      className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl"
                    >
                      <SheetHeader className="pb-4">
                        <SheetTitle>Add emergency loan</SheetTitle>
                      </SheetHeader>
                      <AddEmergencyLoan
                        key={addEmergencyKey}
                        onSaved={onEmergencyLoanSaved}
                      />
                    </SheetContent>
                  </Sheet>
                </div>
              )}
            </div>
          ) : mainTab === "savings" ? (
            <SavingsRecordsSection />
          ) : (
            <ButawRecordsSection />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
