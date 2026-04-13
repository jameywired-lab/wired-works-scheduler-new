import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Loader2, Shield, Users2 } from "lucide-react";
import { toast } from "sonner";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.users.list.useQuery();
  const updateRole = trpc.users.updateRole.useMutation();

  const handleRoleChange = async (userId: number, role: "user" | "admin" | "crew") => {
    try {
      await updateRole.mutateAsync({ userId, role });
      utils.users.list.invalidate();
      toast.success("Role updated.");
    } catch {
      toast.error("Failed to update role.");
    }
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage user roles and access levels
        </p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-400">Role Guide</p>
            <ul className="text-muted-foreground space-y-0.5 mt-1 text-xs">
              <li><strong className="text-foreground">Admin</strong> — Full access: manage clients, jobs, crew, and users</li>
              <li><strong className="text-foreground">User</strong> — Can view clients and jobs, but cannot manage crew or users</li>
              <li><strong className="text-foreground">Crew</strong> — Can only view assigned jobs and submit field notes</li>
            </ul>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (users ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No users found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(users ?? []).map((u) => {
            const isSelf = u.id === currentUser?.id;
            return (
              <div
                key={u.id}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
              >
                <Avatar className="h-9 w-9 border border-border shrink-0">
                  <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
                    {getInitials(u.name ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{u.name ?? "Unknown"}</p>
                    {isSelf && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">You</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email ?? u.openId}</p>
                </div>
                <div className="shrink-0">
                  {isSelf ? (
                    <Badge variant="secondary" className="capitalize">{u.role}</Badge>
                  ) : (
                    <Select
                      value={u.role}
                      onValueChange={(v) => handleRoleChange(u.id, v as "user" | "admin" | "crew")}
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
