"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserX,
} from "lucide-react"

import { useAppToast } from "@/components/app-toast-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  PageDataExportButton,
  type CsvExportSection,
} from "@/components/page-data-export"
import { SiteHeader } from "@/components/site-header"
import { formatExportDateTime } from "@/lib/csv-export"
import { cn } from "@/lib/utils"
import type { StaffRole, StaffUser } from "@/lib/user-types"
import {
  createStaffUser,
  deleteStaffUser,
  fetchStaffUsers,
  setStaffUserEnabled,
  setStaffUserPassword,
  updateStaffUser,
} from "@/lib/users-api"

const selectClass = cn(
  "flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed"
)

function displayName(u: StaffUser): string {
  const a = u.firstname?.trim() ?? ""
  const b = u.lastname?.trim() ?? ""
  if (!a && !b) return "—"
  return `${b ? `${b}, ` : ""}${a}`.trim()
}

function authUserId(): number | null {
  try {
    const raw = localStorage.getItem("auth_user")
    if (!raw) return null
    const u = JSON.parse(raw) as { id?: number }
    return typeof u.id === "number" ? u.id : null
  } catch {
    return null
  }
}

export function StaffListPage() {
  const router = useRouter()
  const { showToast } = useAppToast()
  const [users, setUsers] = React.useState<StaffUser[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [savePending, setSavePending] = React.useState(false)

  const [role, setRole] = React.useState<StaffRole>("staff")
  const [firstname, setFirstname] = React.useState("")
  const [lastname, setLastname] = React.useState("")
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")

  const [pwdDialogOpen, setPwdDialogOpen] = React.useState(false)
  const [pwdTargetId, setPwdTargetId] = React.useState<number | null>(null)
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [pwdPending, setPwdPending] = React.useState(false)

  const [toggleTarget, setToggleTarget] = React.useState<StaffUser | null>(null)
  const [togglePending, setTogglePending] = React.useState(false)

  const [deleteTarget, setDeleteTarget] = React.useState<StaffUser | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10

  const paginatedUsers = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return users.slice(start, start + itemsPerPage)
  }, [users, currentPage])
  const totalPages = Math.max(1, Math.ceil(users.length / itemsPerPage))

  React.useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  const load = React.useCallback(() => {
    setLoading(true)
    setError(null)
    fetchStaffUsers()
      .then(setUsers)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Could not load users."
        setError(msg)
        showToast(msg, "error")
      })
      .finally(() => setLoading(false))
  }, [showToast])

  React.useEffect(() => {
    load()
  }, [load])

  const getStaffExportSections = React.useCallback((): CsvExportSection[] => {
    const rows = [...users]
      .sort((a, b) => a.id - b.id)
      .map((u) => [
        u.firstname ?? "",
        u.lastname ?? "",
        displayName(u),
        u.username,
        u.role,
        u.enabled ? "Active" : "Disabled",
      ])
    return [
      {
        title: "Staff — export summary",
        kind: "keyValues",
        pairs: [
          ["Exported at", formatExportDateTime()],
          ["Row count", String(rows.length)],
        ],
      },
      {
        title: "Staff & admins",
        kind: "table",
        headers: [
          "First name",
          "Last name",
          "Display name",
          "Username",
          "Role",
          "Status",
        ],
        rows,
      },
    ]
  }, [users])

  function resetForm() {
    setRole("staff")
    setFirstname("")
    setLastname("")
    setUsername("")
    setPassword("")
  }

  function openCreate() {
    setEditingId(null)
    resetForm()
    setSheetOpen(true)
  }

  function openEdit(u: StaffUser) {
    setEditingId(u.id)
    setRole(u.role)
    setFirstname(u.firstname)
    setLastname(u.lastname)
    setUsername(u.username)
    setPassword("")
    setSheetOpen(true)
  }

  function signOutIfSelf(id: number) {
    if (authUserId() !== id) return
    localStorage.removeItem("auth_user")
    router.replace("/login")
  }

  async function onSubmitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!firstname.trim() || !lastname.trim() || !username.trim()) {
      showToast("First name, last name, and username are required.", "error")
      return
    }
    if (!editingId && !password.trim()) {
      showToast("Password is required for new accounts.", "error")
      return
    }

    setSavePending(true)
    try {
      if (editingId !== null) {
        const updated = await updateStaffUser(editingId, {
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          username: username.trim(),
          role,
        })
        setUsers((prev) => prev.map((x) => (x.id === editingId ? updated : x)))
        showToast("User updated.", "success")
      } else {
        const created = await createStaffUser({
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          username: username.trim(),
          password,
          role,
        })
        setUsers((prev) => [...prev, created].sort((a, b) => a.id - b.id))
        showToast("User added.", "success")
      }
      setSheetOpen(false)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Save failed.", "error")
    } finally {
      setSavePending(false)
    }
  }

  function openChangePassword(id: number) {
    setPwdTargetId(id)
    setNewPassword("")
    setConfirmPassword("")
    setPwdDialogOpen(true)
  }

  async function submitPassword() {
    if (pwdTargetId === null) return
    if (!newPassword.trim()) {
      showToast("Enter a new password.", "error")
      return
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match.", "error")
      return
    }
    setPwdPending(true)
    try {
      await setStaffUserPassword(pwdTargetId, newPassword)
      showToast("Password updated.", "success")
      setPwdDialogOpen(false)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Update failed.", "error")
    } finally {
      setPwdPending(false)
    }
  }

  async function confirmToggleEnabled() {
    if (!toggleTarget) return
    const next = !toggleTarget.enabled
    setTogglePending(true)
    try {
      const updated = await setStaffUserEnabled(toggleTarget.id, next)
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      showToast(next ? "Account enabled." : "Account disabled.", "success")
      setToggleTarget(null)
      if (!next) signOutIfSelf(updated.id)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Update failed.", "error")
    } finally {
      setTogglePending(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeletePending(true)
    try {
      await deleteStaffUser(deleteTarget.id)
      setUsers((prev) => prev.filter((x) => x.id !== deleteTarget.id))
      showToast("User deleted.", "success")
      signOutIfSelf(deleteTarget.id)
      setDeleteTarget(null)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Delete failed.", "error")
    } finally {
      setDeletePending(false)
    }
  }

  const staffExportButton = (
    <PageDataExportButton
      fileBaseName="staff"
      moduleName="staff"
      disabled={loading || users.length === 0}
      getSections={getStaffExportSections}
    />
  )

  return (
    <>
      <SiteHeader trailing={staffExportButton} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Manage admin and staff accounts. Passwords are stored securely on the server.
        </p>
        <Button
          type="button"
          onClick={openCreate}
          className="shrink-0 gap-2 bg-black text-white hover:bg-black/90"
        >
          <Plus className="size-4" />
          Add user
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff &amp; admins</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-red-600">{error}</p>
            ) : users.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No users yet.
              </p>
            ) : (
              <>
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-3 font-medium">Name</th>
                    <th className="pb-3 pr-3 font-medium">Username</th>
                    <th className="pb-3 pr-3 font-medium">Role</th>
                    <th className="pb-3 pr-3 font-medium">Status</th>
                    <th className="pb-3 pl-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-3 pr-3">{displayName(u)}</td>
                      <td className="py-3 pr-3 font-mono text-xs">{u.username}</td>
                      <td className="py-3 pr-3 capitalize">{u.role}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            u.enabled
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-neutral-200 text-neutral-700"
                          )}
                        >
                          {u.enabled ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Actions"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => openEdit(u)}
                            >
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => openChangePassword(u.id)}
                            >
                              <KeyRound className="size-4" />
                              Change password
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => setToggleTarget(u)}
                            >
                              <UserX className="size-4" />
                              {u.enabled ? "Disable" : "Enable"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 text-red-600 focus:text-red-600"
                              onClick={() => setDeleteTarget(u)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="size-4" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages}
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex flex-col gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editingId !== null ? "Edit user" : "Add user"}
            </SheetTitle>
          </SheetHeader>
          <form
            onSubmit={onSubmitForm}
            className="mt-6 flex flex-1 flex-col gap-4 px-4 pb-6"
          >
            <div className="space-y-2">
              <Label htmlFor="staff-role">Role</Label>
              <SearchableSelect
                id="staff-role"
                className={selectClass}
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </SearchableSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-first">First name</Label>
              <Input
                id="staff-first"
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-last">Last name</Label>
              <Input
                id="staff-last"
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-user">Username</Label>
              <Input
                id="staff-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            {editingId === null ? (
              <div className="space-y-2">
                <Label htmlFor="staff-pass">Password</Label>
                <Input
                  id="staff-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            ) : null}
            <div className="mt-auto flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setSheetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-black text-white hover:bg-black/90"
                disabled={savePending}
              >
                {savePending ? "Saving…" : editingId !== null ? "Save" : "Add"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Set a new password for this account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-pwd">New password</Label>
              <Input
                id="new-pwd"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pwd">Confirm password</Label>
              <Input
                id="confirm-pwd"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPwdDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitPassword}
              disabled={pwdPending}
              className="bg-black text-white hover:bg-black/90"
            >
              {pwdPending ? "Saving…" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={toggleTarget !== null}
        onOpenChange={(o) => !o && setToggleTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleTarget?.enabled ? "Disable account?" : "Enable account?"}
            </DialogTitle>
            <DialogDescription>
              {toggleTarget?.enabled
                ? "They will not be able to sign in until the account is enabled again."
                : "They will be able to sign in again."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setToggleTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmToggleEnabled}
              disabled={togglePending}
              className="bg-black text-white hover:bg-black/90"
            >
              {togglePending ? "Updating…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              This removes{" "}
              <span className="font-medium text-foreground">
                {deleteTarget ? displayName(deleteTarget) : ""}
              </span>{" "}
              permanently. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deletePending}
            >
              {deletePending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}
