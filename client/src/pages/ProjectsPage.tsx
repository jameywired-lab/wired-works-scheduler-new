import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FolderOpen,
  KeyRound,
  MoreVertical,
  Plus,
  Trash2,
  User,
} from "lucide-react";

type ProjectStatus = "active" | "on_hold" | "completed" | "cancelled";

const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  on_hold: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  completed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  cancelled: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatDate(ms: number | null | undefined) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(ms: number | null | undefined) {
  if (!ms) return false;
  return ms < Date.now();
}

// ─── Credentials Section ─────────────────────────────────────────────────────
function CredentialsSection({ projectId }: { projectId: number }) {
  const utils = trpc.useUtils();
  const { data: creds = [], isLoading } = trpc.projectCredentials.list.useQuery({ projectId });
  const seedMutation = trpc.projectCredentials.seed.useMutation({
    onSuccess: () => utils.projectCredentials.list.invalidate({ projectId }),
  });
  const upsertMutation = trpc.projectCredentials.upsert.useMutation({
    onSuccess: () => {
      utils.projectCredentials.list.invalidate({ projectId });
      toast.success("Credential saved");
    },
    onError: (e) => toast.error(e.message),
  });

  // Seed defaults on first load if empty
  useEffect(() => {
    if (!isLoading && creds.length === 0) {
      seedMutation.mutate({ projectId });
    }
  }, [isLoading, creds.length, projectId]);

  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const getValue = (key: string, currentValue: string | null) =>
    editValues[key] !== undefined ? editValues[key] : (currentValue ?? "");

  const handleSave = async (key: string, label: string) => {
    const val = editValues[key] ?? "";
    setSavingKey(key);
    await upsertMutation.mutateAsync({ projectId, key, label, value: val });
    setSavingKey(null);
  };

  const allFilled = creds.filter(c => c.key !== "other_notes").every(c => {
    const v = getValue(c.key, c.value);
    return v.trim().length > 0;
  });

  const toggleVisible = (key: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const isSensitive = (key: string) =>
    ["wifi_password", "sonos_password", "ring_password", "smart_hub_pin", "gate_code", "alarm_code"].includes(key);

  if (isLoading) return <div className="py-4 text-sm text-muted-foreground">Loading credentials...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          Client Credentials
        </h3>
        {allFilled && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> All collected
          </span>
        )}
      </div>
      <div className="space-y-3">
        {creds.map((cred) => {
          const val = getValue(cred.key, cred.value);
          const sensitive = isSensitive(cred.key);
          const visible = visibleKeys.has(cred.key);
          const hasValue = (cred.value ?? "").trim().length > 0;
          return (
            <div key={cred.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">{cred.label}</label>
                {hasValue && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ Saved</span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={sensitive && !visible ? "password" : "text"}
                    value={val}
                    onChange={(e) => setEditValues(prev => ({ ...prev, [cred.key]: e.target.value }))}
                    placeholder={`Enter ${cred.label.toLowerCase()}...`}
                    className="h-8 text-sm pr-8"
                    onKeyDown={(e) => e.key === "Enter" && handleSave(cred.key, cred.label)}
                  />
                  {sensitive && (
                    <button
                      type="button"
                      onClick={() => toggleVisible(cred.key)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => handleSave(cred.key, cred.label)}
                  disabled={savingKey === cred.key || val === (cred.value ?? "")}
                >
                  {savingKey === cred.key ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Project Form Modal ───────────────────────────────────────────────────────
function ProjectFormModal({
  open,
  onClose,
  editProject,
}: {
  open: boolean;
  onClose: () => void;
  editProject?: { id: number; title: string; description?: string | null; clientId?: number | null; status: ProjectStatus; startDate?: number | null; dueDate?: number | null };
}) {
  const utils = trpc.useUtils();
  const { data: clients } = trpc.clients.list.useQuery();

  const [title, setTitle] = useState(editProject?.title ?? "");
  const [description, setDescription] = useState(editProject?.description ?? "");
  const [clientId, setClientId] = useState<string>(editProject?.clientId ? String(editProject.clientId) : "none");
  const [status, setStatus] = useState<ProjectStatus>(editProject?.status ?? "active");
  const [startDate, setStartDate] = useState(
    editProject?.startDate ? new Date(editProject.startDate).toISOString().split("T")[0] : ""
  );
  const [dueDate, setDueDate] = useState(
    editProject?.dueDate ? new Date(editProject.dueDate).toISOString().split("T")[0] : ""
  );

  const createProject = trpc.projects.create.useMutation({
    onSuccess: () => { utils.projects.list.invalidate(); toast.success("Project created"); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => { utils.projects.list.invalidate(); toast.success("Project updated"); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      clientId: clientId && clientId !== "none" ? Number(clientId) : undefined,
      status,
      startDate: startDate ? new Date(startDate).getTime() : undefined,
      dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
    };
    if (editProject) {
      updateProject.mutate({ id: editProject.id, ...payload });
    } else {
      createProject.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editProject ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Project Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kitchen Renovation" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Project overview, scope of work..." rows={3} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Client</label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select client (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No client</SelectItem>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Due Date</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createProject.isPending || updateProject.isPending}>
            {editProject ? "Save Changes" : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Milestone Row ────────────────────────────────────────────────────────────
function MilestoneRow({
  milestone,
  projectId,
}: {
  milestone: { id: number; title: string; isComplete: boolean; dueDate?: number | null };
  projectId: number;
}) {
  const utils = trpc.useUtils();
  const toggle = trpc.projects.toggleMilestone.useMutation({
    onSuccess: () => utils.projects.getById.invalidate({ id: projectId }),
  });
  const deleteMilestone = trpc.projects.deleteMilestone.useMutation({
    onSuccess: () => utils.projects.getById.invalidate({ id: projectId }),
  });

  return (
    <div className="flex items-center gap-3 py-2 group">
      <Checkbox
        checked={milestone.isComplete}
        onCheckedChange={(v) => toggle.mutate({ id: milestone.id, isComplete: !!v })}
      />
      <span className={`flex-1 text-sm ${milestone.isComplete ? "line-through text-muted-foreground" : ""}`}>
        {milestone.title}
      </span>
      {milestone.dueDate && (
        <span className={`text-xs ${isOverdue(milestone.dueDate) && !milestone.isComplete ? "text-destructive" : "text-muted-foreground"}`}>
          {formatDate(milestone.dueDate)}
        </span>
      )}
      <button
        onClick={() => deleteMilestone.mutate({ id: milestone.id })}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Project Detail Panel ─────────────────────────────────────────────────────
function ProjectDetailPanel({
  projectId,
  onClose,
}: {
  projectId: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: project, isLoading } = trpc.projects.getById.useQuery({ id: projectId });
  const { data: clients } = trpc.clients.list.useQuery();

  const [newMilestone, setNewMilestone] = useState("");
  const [newMilestoneDue, setNewMilestoneDue] = useState("");
  const [reminderMsg, setReminderMsg] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const addMilestone = trpc.projects.addMilestone.useMutation({
    onSuccess: () => {
      utils.projects.getById.invalidate({ id: projectId });
      setNewMilestone("");
      setNewMilestoneDue("");
    },
    onError: (e) => toast.error(e.message),
  });

  const addReminder = trpc.projects.addReminder.useMutation({
    onSuccess: () => {
      utils.projects.getById.invalidate({ id: projectId });
      setReminderMsg("");
      setReminderDate("");
      setShowReminderForm(false);
      toast.success("Reminder set");
    },
    onError: (e) => toast.error(e.message),
  });

  const dismissReminder = trpc.projects.dismissReminder.useMutation({
    onSuccess: () => utils.projects.getById.invalidate({ id: projectId }),
  });

  const deleteReminder = trpc.projects.deleteReminder.useMutation({
    onSuccess: () => utils.projects.getById.invalidate({ id: projectId }),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground text-sm">Loading...</div>;
  if (!project) return <div className="p-6 text-muted-foreground text-sm">Project not found.</div>;

  const milestones = project.milestones ?? [];
  const reminders = project.reminders ?? [];
  const completedCount = milestones.filter((m) => m.isComplete).length;
  const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;
  const clientName = clients?.find((c) => c.id === project.clientId)?.name;

  const handleAddMilestone = () => {
    if (!newMilestone.trim()) return;
    addMilestone.mutate({
      projectId,
      title: newMilestone.trim(),
      dueDate: newMilestoneDue ? new Date(newMilestoneDue).getTime() : undefined,
      sortOrder: milestones.length,
    });
  };

  const handleAddReminder = () => {
    if (!reminderMsg.trim() || !reminderDate) { toast.error("Message and date are required"); return; }
    addReminder.mutate({
      projectId,
      message: reminderMsg.trim(),
      remindAt: new Date(reminderDate).getTime(),
    });
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between p-6 border-b border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={STATUS_COLORS[project.status as ProjectStatus]}>
              {STATUS_LABELS[project.status as ProjectStatus]}
            </Badge>
            {isOverdue(project.dueDate) && project.status === "active" && (
              <Badge className="bg-destructive/15 text-destructive">Overdue</Badge>
            )}
          </div>
          <h2 className="text-xl font-semibold tracking-tight">{project.title}</h2>
          {clientName && (
            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {clientName}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
      </div>

      <div className="p-6 space-y-6 flex-1">
        {/* Description */}
        {project.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
        )}

        {/* Dates */}
        <div className="flex gap-6 text-sm">
          {project.startDate && (
            <div>
              <span className="text-muted-foreground">Start</span>
              <div className="font-medium mt-0.5">{formatDate(project.startDate)}</div>
            </div>
          )}
          {project.dueDate && (
            <div>
              <span className="text-muted-foreground">Due</span>
              <div className={`font-medium mt-0.5 ${isOverdue(project.dueDate) && project.status === "active" ? "text-destructive" : ""}`}>
                {formatDate(project.dueDate)}
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        {milestones.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">{completedCount}/{milestones.length} milestones</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">{progress}% complete</div>
          </div>
        )}

        {/* Milestones */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            Milestones
          </h3>
          <div className="divide-y divide-border rounded-lg border border-border px-3">
            {milestones.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground text-center">No milestones yet</p>
            )}
            {milestones.map((m) => (
              <MilestoneRow key={m.id} milestone={m} projectId={projectId} />
            ))}
          </div>
          {/* Add milestone */}
          <div className="flex gap-2 mt-3">
            <Input
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              placeholder="Add a milestone..."
              className="flex-1 h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleAddMilestone()}
            />
            <Input
              type="date"
              value={newMilestoneDue}
              onChange={(e) => setNewMilestoneDue(e.target.value)}
              className="w-36 h-8 text-sm"
            />
            <Button size="sm" variant="outline" onClick={handleAddMilestone} disabled={!newMilestone.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Credentials Checklist */}
        <div>
          <CredentialsSection projectId={projectId} />
        </div>

        {/* Reminders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Reminders
            </h3>
            <Button size="sm" variant="ghost" onClick={() => setShowReminderForm(!showReminderForm)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>

          {showReminderForm && (
            <div className="border border-border rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
              <Textarea
                value={reminderMsg}
                onChange={(e) => setReminderMsg(e.target.value)}
                placeholder="Reminder message..."
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="flex-1 h-8 text-sm"
                />
                <Button size="sm" onClick={handleAddReminder} disabled={addReminder.isPending}>Set</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowReminderForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {reminders.length === 0 && !showReminderForm && (
              <p className="text-sm text-muted-foreground">No reminders set</p>
            )}
            {reminders.map((r) => (
              <div
                key={r.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${r.isDismissed ? "opacity-50 border-border" : "border-amber-500/30 bg-amber-500/5"}`}
              >
                <Bell className={`h-4 w-4 mt-0.5 flex-shrink-0 ${r.isDismissed ? "text-muted-foreground" : "text-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{r.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(r.remindAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!r.isDismissed && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dismissReminder.mutate({ id: r.id })}>
                      Done
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => deleteReminder.mutate({ id: r.id })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editOpen && (
        <ProjectFormModal
          open={editOpen}
          onClose={() => { setEditOpen(false); utils.projects.getById.invalidate({ id: projectId }); }}
          editProject={project as any}
        />
      )}
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({
  project,
  clients,
  onSelect,
  onEdit,
  onDelete,
}: {
  project: { id: number; title: string; description?: string | null; clientId?: number | null; status: string; dueDate?: number | null; startDate?: number | null };
  clients: { id: number; name: string }[];
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: detail } = trpc.projects.getById.useQuery({ id: project.id });
  const milestones = detail?.milestones ?? [];
  const completedCount = milestones.filter((m) => m.isComplete).length;
  const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;
  const clientName = clients.find((c) => c.id === project.clientId)?.name;
  const status = project.status as ProjectStatus;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-border group"
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
              {isOverdue(project.dueDate) && status === "active" && (
                <Badge className="bg-destructive/15 text-destructive text-xs">Overdue</Badge>
              )}
            </div>
            <CardTitle className="text-base leading-tight">{project.title}</CardTitle>
            {clientName && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />{clientName}
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>Edit</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {project.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
        )}
        {milestones.length > 0 && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{completedCount}/{milestones.length} milestones</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
        {project.dueDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span className={isOverdue(project.dueDate) && status === "active" ? "text-destructive" : ""}>
              Due {formatDate(project.dueDate)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { data: projects = [], isLoading } = trpc.projects.list.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: dueReminders = [] } = trpc.projects.getDueReminders.useQuery();
  const utils = trpc.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      if (selectedProjectId === deleteId) setSelectedProjectId(null);
      setDeleteId(null);
      toast.success("Project deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const dismissReminder = trpc.projects.dismissReminder.useMutation({
    onSuccess: () => utils.projects.getDueReminders.invalidate(),
  });

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [projects, statusFilter, search]);

  const activeDueReminders = dueReminders.filter((r) => !r.isDismissed);

  return (
    <div className="flex h-full gap-0">
      {/* Left: project list */}
      <div className={`flex flex-col ${selectedProjectId ? "hidden md:flex md:w-96 border-r border-border" : "flex-1"}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{projects.length} total</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Project
          </Button>
        </div>

        {/* Due reminders banner */}
        {activeDueReminders.length > 0 && (
          <div className="mx-6 mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {activeDueReminders.length} reminder{activeDueReminders.length > 1 ? "s" : ""} due
              </span>
            </div>
            <div className="space-y-1">
              {activeDueReminders.slice(0, 3).map((r) => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate flex-1">{r.message}</span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs ml-2" onClick={() => dismissReminder.mutate({ id: r.id })}>
                    Dismiss
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="px-6 pb-4 flex gap-2">
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 h-8 text-sm"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Project grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading projects...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {search || statusFilter !== "all" ? "No projects match your filters" : "No projects yet. Create your first one."}
              </p>
            </div>
          ) : (
            <div className={`grid gap-4 ${selectedProjectId ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  clients={clients}
                  onSelect={() => setSelectedProjectId(project.id)}
                  onEdit={() => setEditProject(project)}
                  onDelete={() => setDeleteId(project.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      {selectedProjectId && (
        <div className="flex-1 overflow-hidden">
          <ProjectDetailPanel
            projectId={selectedProjectId}
            onClose={() => setSelectedProjectId(null)}
          />
        </div>
      )}

      {/* Modals */}
      <ProjectFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editProject && (
        <ProjectFormModal
          open={!!editProject}
          onClose={() => setEditProject(null)}
          editProject={editProject}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project, all its milestones, and reminders. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteProject.mutate({ id: deleteId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
