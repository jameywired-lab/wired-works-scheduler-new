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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getInitials } from "@/lib/utils";
import {
  Loader2, Mail, Pencil, Phone, Plus, Trash2, UserCircle2,
  ClipboardList, Shield, ChevronDown, ChevronUp, Clock, X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

type CrewForm = {
  name: string;
  phone: string;
  email: string;
  role: string;
  isActive: boolean;
  colorHex: string;
};

const emptyForm: CrewForm = { name: "", phone: "", email: "", role: "", isActive: true, colorHex: "#6366f1" };

type TaskForm = {
  title: string;
  description: string;
  dueDate: string;
};

const emptyTaskForm: TaskForm = { title: "", description: "", dueDate: "" };

const PERMISSION_LABELS: { key: string; label: string; description: string }[] = [
  { key: "canViewCalendar", label: "View Calendar", description: "See the full job calendar" },
  { key: "canViewClients", label: "View Clients", description: "Browse client list and details" },
  { key: "canCloseOutJobs", label: "Close Out Jobs", description: "Mark jobs complete and add field notes" },
  { key: "canAddNotes", label: "Add Notes", description: "Add crew notes to jobs" },
  { key: "canAddPhotos", label: "Add Photos", description: "Upload job photos" },
  { key: "canViewProjects", label: "View Projects", description: "See active projects" },
  { key: "canViewVanInventory", label: "Van Inventory", description: "View and manage van inventory" },
];

export default function CrewPage() {
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CrewForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const [expandedMember, setExpandedMember] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"tasks" | "permissions">("tasks");
  const [showTaskForm, setShowTaskForm] = useState<number | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm);

  const { data: crew, isLoading } = trpc.crew.list.useQuery({});
  const { data: allTasks = [] } = trpc.crewTasks.listAll.useQuery();
  const { data: crewWithPerms = [] } = trpc.crewPermissions.listAll.useQuery();

  const createCrew = trpc.crew.create.useMutation();
  const updateCrew = trpc.crew.update.useMutation();
  const deleteCrew = trpc.crew.delete.useMutation();

  const createTask = trpc.crewTasks.create.useMutation({
    onSuccess: () => {
      utils.crewTasks.listAll.invalidate();
      setShowTaskForm(null);
      setTaskForm(emptyTaskForm);
      toast.success("Task assigned!");
    },
  });

  const deleteTask = trpc.crewTasks.delete.useMutation({
    onSuccess: () => utils.crewTasks.listAll.invalidate(),
  });

  const upsertPerms = trpc.crewPermissions.upsert.useMutation({
    onSuccess: () => {
      utils.crewPermissions.listAll.invalidate();
      toast.success("Permissions saved.");
    },
  });

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (member: NonNullable<typeof crew>[number]) => {
    setForm({
      name: member.name,
      phone: member.phone ?? "",
      email: member.email ?? "",
      role: member.role ?? "",
      isActive: member.isActive ?? true,
      colorHex: (member as any).colorHex ?? "#6366f1",
    });
    setEditingId(member.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required."); return; }
    try {
      if (editingId) {
        await updateCrew.mutateAsync({ id: editingId, ...form });
        toast.success("Crew member updated.");
      } else {
        await createCrew.mutateAsync(form);
        toast.success("Crew member added.");
      }
      utils.crew.list.invalidate();
      setShowForm(false);
    } catch {
      toast.error("Failed to save crew member.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCrew.mutateAsync({ id });
      toast.success("Crew member removed.");
      utils.crew.list.invalidate();
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to remove crew member.");
    }
  };

  const handleAssignTask = async () => {
    if (!taskForm.title.trim() || !showTaskForm) { toast.error("Title is required."); return; }
    const dueDate = taskForm.dueDate ? new Date(taskForm.dueDate).getTime() : undefined;
    await createTask.mutateAsync({
      assignedToCrewMemberId: showTaskForm,
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || undefined,
      dueDate,
      createdBy: "Jamey",
    });
  };

  const handlePermToggle = (crewMemberId: number, key: string, value: boolean) => {
    upsertPerms.mutate({ crewMemberId, [key]: value });
  };

  const isPending = createCrew.isPending || updateCrew.isPending;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Crew</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? "Loading…" : `${crew?.length ?? 0} crew members`}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Member
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (crew ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UserCircle2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No crew members yet</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Add your first crew member
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(crew ?? []).map((member) => {
            const memberTasks = allTasks.filter((t) => t.assignedToCrewMemberId === member.id && !t.isComplete);
            const memberPerms = crewWithPerms.find((m) => m.id === member.id)?.permissions;
            const isExpanded = expandedMember === member.id;

            return (
              <div key={member.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Main row */}
                <div className="p-4 flex items-start gap-3">
                  <Avatar className="h-10 w-10 border border-border shrink-0">
                    <AvatarFallback className={`text-sm font-semibold ${member.isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-semibold text-sm truncate">{member.name}</p>
                        {!member.isActive && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">Inactive</Badge>
                        )}
                        {memberTasks.length > 0 && (
                          <Badge className="text-[10px] px-1.5 py-0 shrink-0 bg-purple-100 text-purple-700 border border-purple-200">
                            {memberTasks.length} task{memberTasks.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setShowTaskForm(member.id); setTaskForm(emptyTaskForm); }}
                          className="p-1.5 rounded-lg hover:bg-purple-50 transition-colors text-purple-600"
                          title="Assign task"
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setExpandedMember(isExpanded ? null : member.id);
                            setActiveTab("tasks");
                          }}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                          title="Manage tasks & permissions"
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                        <button onClick={() => openEdit(member)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeleteConfirm(member.id)} className="p-1.5 rounded-lg hover:bg-destructive/15 transition-colors">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                    {member.role && (
                      <p className="text-xs text-muted-foreground mt-0.5">{member.role}</p>
                    )}
                    <div className="space-y-0.5 mt-1.5">
                      {member.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="flex border-b border-border">
                      <button
                        onClick={() => setActiveTab("tasks")}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "tasks" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Tasks
                        {memberTasks.length > 0 && (
                          <span className="bg-purple-100 text-purple-700 text-xs px-1.5 rounded-full">{memberTasks.length}</span>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTab("permissions")}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "permissions" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Permissions
                      </button>
                    </div>

                    {activeTab === "tasks" && (
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground">Pending tasks for {member.name.split(" ")[0]}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => { setShowTaskForm(member.id); setTaskForm(emptyTaskForm); }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Assign Task
                          </Button>
                        </div>
                        {memberTasks.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No pending tasks.</p>
                        ) : (
                          memberTasks.map((task) => (
                            <div key={task.id} className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg p-2.5">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-purple-900">{task.title}</p>
                                {task.description && (
                                  <p className="text-xs text-gray-600 mt-0.5">{task.description}</p>
                                )}
                                {task.dueDate && (
                                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(task.dueDate), "MMM d, h:mm a")}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => deleteTask.mutate({ id: task.id })}
                                className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {activeTab === "permissions" && (
                      <div className="p-4 space-y-3">
                        <p className="text-xs text-muted-foreground mb-1">
                          Control what {member.name.split(" ")[0]} can see and do in the app.
                        </p>
                        {PERMISSION_LABELS.map(({ key, label, description }) => {
                          const value = memberPerms
                            ? ((memberPerms as Record<string, unknown>)[key] as boolean) ?? true
                            : true;
                          return (
                            <div key={key} className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">{label}</p>
                                <p className="text-xs text-muted-foreground">{description}</p>
                              </div>
                              <Switch
                                checked={value}
                                onCheckedChange={(v) => handlePermToggle(member.id, key, v)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Task Dialog */}
      <Dialog open={showTaskForm !== null} onOpenChange={(v) => !v && setShowTaskForm(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              Assign Task to {crew?.find((m) => m.id === showTaskForm)?.name ?? "Crew Member"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Task Title *</Label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Stop by Home Depot for wire nuts"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Details (optional)</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Any additional instructions..."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date / Time (optional)</Label>
              <Input
                type="datetime-local"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskForm(null)} disabled={createTask.isPending}>Cancel</Button>
            <Button onClick={handleAssignTask} disabled={createTask.isPending}>
              {createTask.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Crew Member Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Crew Member" : "Add Crew Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Role / Title</Label>
              <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Electrician, Foreman, etc." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="john@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Calendar Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.colorHex}
                  onChange={(e) => setForm((f) => ({ ...f, colorHex: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <div className="flex gap-2 flex-wrap">
                  {["#22c55e","#ec4899","#60a5fa","#f59e0b","#8b5cf6","#ef4444","#000000"].map(c => (
                    <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, colorHex: c }))}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: form.colorHex === c ? "white" : "transparent", outline: form.colorHex === c ? `2px solid ${c}` : "none" }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Shows on calendar events — green=Jason, pink=Warren, blue=Jamey</p>
            </div>
            {editingId && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Inactive members won't appear in job assignments</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Remove Crew Member?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently remove the crew member.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={deleteCrew.isPending}>
              {deleteCrew.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
