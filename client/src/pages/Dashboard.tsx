import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
import { trpc } from "@/lib/trpc";
import { formatDate, formatTime, statusClass, statusLabel, type JobStatus } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  FolderOpen,
  MessageSquare,
  Phone,
  Plus,
  Users,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import JobFormModal from "@/components/JobFormModal";
import { toast } from "sonner";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showJobForm, setShowJobForm] = useState(false);
  const { data, isLoading } = trpc.dashboard.getData.useQuery();
  const utils = trpc.useUtils();

  const todayJobs = data?.todayJobs ?? [];
  const upcomingJobs = data?.upcomingJobs ?? [];
  const completedToday = todayJobs.filter((j) => j.status === "completed").length;
  const scheduledToday = todayJobs.filter((j) => j.status === "scheduled" || j.status === "in_progress").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Good {getGreeting()},{" "}
            <span className="gradient-text">{user?.name?.split(" ")[0] ?? "there"}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <Button onClick={() => setShowJobForm(true)} size="sm" className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          New Job
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Today's Jobs" value={isLoading ? null : todayJobs.length} icon={<Calendar className="h-4 w-4 text-primary" />} loading={isLoading} />
        <StatCard label="Remaining" value={isLoading ? null : scheduledToday} icon={<Clock className="h-4 w-4 text-amber-400" />} loading={isLoading} />
        <StatCard label="Completed" value={isLoading ? null : completedToday} icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} loading={isLoading} />
        <StatCard label="Active Clients" value={isLoading ? null : (data?.totalClients ?? 0)} icon={<Users className="h-4 w-4 text-violet-400" />} loading={isLoading} />
      </div>

      {/* Main 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Column 1 & 2: Schedule ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Schedule */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Today's Schedule</h2>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/calendar")} className="text-xs text-muted-foreground h-7 px-2">
                View calendar <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
            ) : todayJobs.length === 0 ? (
              <EmptyState icon={<Calendar className="h-8 w-8 text-muted-foreground/40" />} title="No jobs today" description="Your schedule is clear. Enjoy the day or add a new job." />
            ) : (
              <div className="space-y-2">
                {todayJobs.map((job) => (
                  <JobCard key={job.id} job={job} onClick={() => setLocation(`/jobs/${job.id}`)} />
                ))}
              </div>
            )}
          </section>

          {/* Projects Panel */}
          <ProjectsPanel />
        </div>

        {/* ── Column 3: Upcoming + Follow-Up ── */}
        <div className="space-y-6">
          {/* Upcoming Jobs */}
          <section className="space-y-3">
            <h2 className="font-semibold text-base">Upcoming</h2>
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : upcomingJobs.filter((j) => { const e = new Date(); e.setHours(23,59,59,999); return j.scheduledStart > e.getTime(); }).length === 0 ? (
              <EmptyState icon={<Clock className="h-6 w-6 text-muted-foreground/40" />} title="No upcoming jobs" description="Nothing scheduled beyond today." compact />
            ) : (
              <div className="space-y-2">
                {upcomingJobs
                  .filter((j) => { const e = new Date(); e.setHours(23,59,59,999); return j.scheduledStart > e.getTime(); })
                  .slice(0, 5)
                  .map((job) => (
                    <UpcomingJobRow key={job.id} job={job} onClick={() => setLocation(`/jobs/${job.id}`)} />
                  ))}
              </div>
            )}
          </section>

          {/* Follow-Up Panel */}
          <FollowUpPanel />
        </div>
      </div>

      {showJobForm && (
        <JobFormModal
          open={showJobForm}
          onClose={() => setShowJobForm(false)}
          onSuccess={() => { setShowJobForm(false); utils.dashboard.getData.invalidate(); }}
        />
      )}
    </div>
  );
}

// ─── Follow-Up Panel ──────────────────────────────────────────────────────────
function FollowUpPanel() {
  const utils = trpc.useUtils();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newType, setNewType] = useState<"call" | "text" | "manual">("manual");
  const [, setLocation] = useLocation();

  // Today only for the dashboard panel
  const todayRange = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }, []);

  const { data: followUps = [], isLoading } = trpc.followUps.list.useQuery(todayRange);

  const createFollowUp = trpc.followUps.create.useMutation({
    onSuccess: () => {
      utils.followUps.list.invalidate();
      setNewName(""); setNewPhone(""); setNewNote(""); setNewType("manual");
      setShowAddForm(false);
      toast.success("Follow-up added");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleFollowUp = trpc.followUps.toggle.useMutation({
    onMutate: async ({ id, isFollowedUp }) => {
      await utils.followUps.list.cancel();
      const prev = utils.followUps.list.getData(todayRange);
      utils.followUps.list.setData(todayRange, (old) =>
        old?.map((f) => f.id === id ? { ...f, isFollowedUp } : f)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) utils.followUps.list.setData(todayRange, ctx.prev); },
    onSettled: () => utils.followUps.list.invalidate(),
  });

  const deleteFollowUp = trpc.followUps.delete.useMutation({
    onSuccess: () => utils.followUps.list.invalidate(),
  });

  const pending = followUps.filter((f) => !f.isFollowedUp);
  const done = followUps.filter((f) => f.isFollowedUp);

  const TYPE_ICON: Record<string, React.ReactNode> = {
    call: <Phone className="h-3 w-3 text-blue-400" />,
    text: <MessageSquare className="h-3 w-3 text-emerald-400" />,
    manual: <Zap className="h-3 w-3 text-amber-400" />,
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Follow-Up
            {pending.length > 0 && (
              <Badge className="bg-amber-500/15 text-amber-500 text-[10px] h-4 px-1.5">{pending.length}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground px-2" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Quick add form */}
        {showAddForm && (
          <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
            <div className="grid grid-cols-2 gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className="h-7 text-xs" />
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone" className="h-7 text-xs" />
            </div>
            <Select value={newType} onValueChange={(v) => setNewType(v as any)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Incoming Call</SelectItem>
                <SelectItem value="text">Incoming Text</SelectItem>
                <SelectItem value="manual">Manual Note</SelectItem>
              </SelectContent>
            </Select>
            <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Note..." rows={2} className="text-xs resize-none" />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button size="sm" className="h-6 text-xs" onClick={() => createFollowUp.mutate({ contactName: newName || undefined, phone: newPhone || undefined, note: newNote || undefined, type: newType, contactedAt: Date.now() })} disabled={createFollowUp.isPending}>
                Save
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1,2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : followUps.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">No follow-ups logged today</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Pending first */}
            {pending.map((f) => (
              <div key={f.id} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors group">
                <Checkbox checked={false} onCheckedChange={() => toggleFollowUp.mutate({ id: f.id, isFollowedUp: true })} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium truncate">{f.contactName || "Unknown"}</span>
                    {TYPE_ICON[f.type]}
                    {f.phone && <span className="text-[10px] text-muted-foreground">{f.phone}</span>}
                  </div>
                  {f.note && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{f.note}</p>}
                </div>
                <button onClick={() => deleteFollowUp.mutate({ id: f.id })} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all text-xs">✕</button>
              </div>
            ))}
            {/* Done */}
            {done.slice(0, 3).map((f) => (
              <div key={f.id} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-card/50 opacity-50 group">
                <Checkbox checked={true} onCheckedChange={() => toggleFollowUp.mutate({ id: f.id, isFollowedUp: false })} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs line-through text-muted-foreground truncate block">{f.contactName || "Unknown"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Projects Panel ───────────────────────────────────────────────────────────
function ProjectsPanel() {
  const [, setLocation] = useLocation();
  const { data: projects = [], isLoading } = trpc.projects.list.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: dueReminders = [] } = trpc.projects.getDueReminders.useQuery();
  const utils = trpc.useUtils();

  const dismissReminder = trpc.projects.dismissReminder.useMutation({
    onSuccess: () => utils.projects.getDueReminders.invalidate(),
  });

  const active = projects.filter((p) => p.status === "active");
  const activeDueReminders = dueReminders.filter((r) => !r.isDismissed);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary" />
          Projects
          {activeDueReminders.length > 0 && (
            <Badge className="bg-amber-500/15 text-amber-500 text-[10px] h-4 px-1.5">
              <Bell className="h-2.5 w-2.5 mr-0.5" />{activeDueReminders.length}
            </Badge>
          )}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="text-xs text-muted-foreground h-7 px-2">
          All projects <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>

      {/* Due reminder banner */}
      {activeDueReminders.length > 0 && (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <Bell className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {activeDueReminders.length} reminder{activeDueReminders.length > 1 ? "s" : ""} due
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{activeDueReminders[0]?.message}</p>
          </div>
          <Button size="sm" variant="ghost" className="h-6 text-xs shrink-0" onClick={() => activeDueReminders[0] && dismissReminder.mutate({ id: activeDueReminders[0].id })}>
            Dismiss
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8 text-muted-foreground/40" />}
          title="No active projects"
          description="Head to Projects to create one."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {active.slice(0, 4).map((p) => {
            const clientName = clients.find((c) => c.id === p.clientId)?.name;
            const isOverdue = p.dueDate && p.dueDate < Date.now();
            return (
              <ProjectMiniCard
                key={p.id}
                project={p}
                clientName={clientName}
                isOverdue={!!isOverdue}
                onClick={() => setLocation("/projects")}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProjectMiniCard({
  project,
  clientName,
  isOverdue,
  onClick,
}: {
  project: { id: number; title: string; dueDate?: number | null; status: string };
  clientName?: string;
  isOverdue: boolean;
  onClick: () => void;
}) {
  const { data: detail } = trpc.projects.getById.useQuery({ id: project.id });
  const milestones = detail?.milestones ?? [];
  const completedCount = milestones.filter((m) => m.isComplete).length;
  const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-1 flex-1">{project.title}</p>
        {isOverdue && <Badge className="bg-destructive/15 text-destructive text-[10px] shrink-0">Overdue</Badge>}
      </div>
      {clientName && <p className="text-xs text-muted-foreground mb-2">{clientName}</p>}
      {milestones.length > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{completedCount}/{milestones.length} milestones</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1" />
        </div>
      )}
      {project.dueDate && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Calendar className="h-2.5 w-2.5" />
          Due {new Date(project.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
      )}
    </button>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────
function StatCard({ label, value, icon, loading }: { label: string; value: number | null; icon: React.ReactNode; loading: boolean }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          {icon}
        </div>
        {loading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-bold">{value}</p>}
      </CardContent>
    </Card>
  );
}

function JobCard({ job, onClick }: { job: { id: number; title: string; status: string; scheduledStart: number; scheduledEnd: number; address?: string | null }; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-card/80 transition-all group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{job.title}</p>
          {job.address && <p className="text-xs text-muted-foreground truncate mt-0.5">{job.address}</p>}
        </div>
        <Badge className={`${statusClass(job.status as JobStatus)} text-[10px] shrink-0 rounded-full`}>
          {statusLabel(job.status as JobStatus)}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{formatTime(job.scheduledStart)} – {formatTime(job.scheduledEnd)}</span>
      </div>
    </button>
  );
}

function UpcomingJobRow({ job, onClick }: { job: { id: number; title: string; status: string; scheduledStart: number }; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left bg-card border border-border rounded-lg px-3 py-2.5 hover:border-primary/40 transition-all group flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{job.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(job.scheduledStart)}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
    </button>
  );
}

function EmptyState({ icon, title, description, compact = false }: { icon: React.ReactNode; title: string; description: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center bg-card border border-border border-dashed rounded-xl ${compact ? "py-6 px-4" : "py-10 px-6"}`}>
      <div className="mb-3">{icon}</div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">{description}</p>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
