import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { getInitials } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { KeyRound, Loader2, MessageSquare, Plus, Shield, Trash2, Users2 } from "lucide-react";
import { toast } from "sonner";

type NewUserForm = {
  name: string;
  email: string;
  role: "user" | "admin" | "crew";
  password: string;
  phone: string;
  sendInviteSms: boolean;
};
const emptyForm: NewUserForm = { name: "", email: "", role: "user", password: "", phone: "", sendInviteSms: false };

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<NewUserForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [resetTarget, setResetTarget] = useState<{ id: number; openId: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: users, isLoading } = trpc.users.list.useQuery();

  const createUser = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setForm(emptyForm);
      setShowAddForm(false);
      toast.success("User added successfully.");
    },
    onError: (e) => toast.error(e.message || "Failed to add user."),
  });

  const setPasswordMutation = trpc.users.setPassword.useMutation({
    onSuccess: () => {
      setResetTarget(null);
      setNewPassword("");
      toast.success("Password updated.");
    },
    onError: (e) => toast.error(e.message || "Failed to update password."),
  });

  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("Role updated."); },
    onError: () => toast.error("Failed to update role."),
  });

  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); setDeleteConfirm(null); toast.success("User removed."); },
    onError: () => toast.error("Failed to remove user."),
  });

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Name is required."); return; }
    if (form.sendInviteSms && !form.phone.trim()) {
      toast.error("Phone number is required to send an invite SMS.");
      return;
    }
    createUser.mutate({
      name: form.name,
      email: form.email,
      role: form.role,
      password: form.password || undefined,
      phone: form.phone || undefined,
      sendInviteSms: form.sendInviteSms,
      appUrl: form.sendInviteSms ? window.location.origin : undefined,
    });
  };

  const handleResetPassword = () => {
    if (!resetTarget) return;
    if (!newPassword.trim() || newPassword.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setPasswordMutation.mutate({ openId: resetTarget.openId, newPassword });
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage team members and their access levels
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add User
        </Button>
      </div>

      {/* Role guide */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-400">Role Guide</p>
            <div className="text-muted-foreground space-y-0.5 mt-1 text-xs">
              <p><strong className="text-foreground">Admin</strong> — Full access: manage clients, jobs, crew, and users</p>
              <p><strong className="text-foreground">User</strong> — Can view clients and jobs, but cannot manage crew or users</p>
              <p><strong className="text-foreground">Crew</strong> — Can only view assigned jobs and submit field notes</p>
            </div>
          </div>
        </div>
      </div>

      {/* User list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (users ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No users yet</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add your first user
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {(users ?? []).map((u) => {
            const isSelf = u.id === currentUser?.id;
            const isManual = u.openId?.startsWith("manual-");
            return (
              <div
                key={u.id}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 group"
              >
                <Avatar className="h-9 w-9 border border-border shrink-0">
                  <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
                    {getInitials(u.name ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{u.name ?? "Unknown"}</p>
                    {isSelf && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">You</Badge>}
                    {isManual && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Manual</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email ?? (isManual ? "No email" : u.openId)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isSelf ? (
                    <Badge variant="secondary" className="capitalize">{u.role}</Badge>
                  ) : (
                    <Select
                      value={u.role}
                      onValueChange={(v) => updateRole.mutate({ userId: u.id, role: v as "user" | "admin" | "crew" })}
                      disabled={updateRole.isPending}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs bg-input border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="crew">Crew</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {/* Reset password button — visible on hover for all users */}
                  <button
                    onClick={() => { setResetTarget({ id: u.id, openId: u.openId, name: u.name ?? "User" }); setNewPassword(""); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-primary/10 transition-all"
                    title="Set / reset password"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                  </button>
                  {!isSelf && (
                    <button
                      onClick={() => setDeleteConfirm(u.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/15 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAddForm} onOpenChange={(v) => !v && setShowAddForm(false)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="John Smith"
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-muted-foreground text-xs">(used to log in)</span></Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="john@example.com"
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Set a login password"
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as "user" | "admin" | "crew", sendInviteSms: v === "crew" ? f.sendInviteSms : false }))}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — Full access</SelectItem>
                  <SelectItem value="user">User — View clients &amp; jobs</SelectItem>
                  <SelectItem value="crew">Crew — Assigned jobs only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Phone + SMS invite — only shown for crew role */}
            {form.role === "crew" && (
              <div className="space-y-3 border border-border rounded-xl p-3 bg-muted/20">
                <div className="space-y-1.5">
                  <Label>Phone Number <span className="text-muted-foreground text-xs">(for SMS invite)</span></Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="(904) 555-1234"
                    className="bg-input border-border"
                  />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.sendInviteSms}
                    onChange={(e) => setForm((f) => ({ ...f, sendInviteSms: e.target.checked }))}
                    className="h-4 w-4 rounded border-border accent-amber-500"
                  />
                  <span className="text-sm flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
                    Send invite SMS with login link &amp; password
                  </span>
                </label>
                {form.sendInviteSms && (
                  <p className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                    A text message will be sent to the crew member with the app URL, their username, and password.
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
              The crew member will log in with their email and this password. You can change their password anytime using the key icon on their row.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddForm(false)} disabled={createUser.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetTarget !== null} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Set Password — {resetTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Enter a new password for this user. They will use it to log in.
            </p>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="bg-input border-border"
                onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={setPasswordMutation.isPending}>
              {setPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Remove User?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove the user from the system. They can sign back in to create a new account.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteUser.mutate({ userId: deleteConfirm })}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
