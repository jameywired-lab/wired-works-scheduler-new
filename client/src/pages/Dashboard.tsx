import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Phone,
  Plus,
  MessageSquare,
  Users,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import JobFormModal from "@/components/JobFormModal";
import { toast } from "sonner";

// ─── Dashboard ────────────────────────────────────────────────────────────────
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
    <div className="space-y-6 max-w-6xl mx-auto">
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

      {/* Tabs */}
      <Tabs defaultValue="schedule" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="followup">Follow-Up</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        {/* ── Schedule Tab ── */}
        <TabsContent value="schedule">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
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
            </div>
            <div className="space-y-3">
              <h2 className="font-semibold text-base">Upcoming</h2>
              {isLoading ? (
                <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
              ) : upcomingJobs.filter((j) => { const e = new Date(); e.setHours(23,59,59,999); return j.scheduledStart > e.getTime(); }).length === 0 ? (
                <EmptyState icon={<Clock className="h-6 w-6 text-muted-foreground/40" />} title="No upcoming jobs" description="Nothing scheduled beyond today." compact />
              ) : (
                <div className="space-y-2">
                  {upcomingJobs
                    .filter((j) => { const e = new Date(); e.setHours(23,59,59,999); return j.scheduledStart > e.getTime(); })
                    .slice(0, 6)
                    .map((job) => (
                      <UpcomingJobRow key={job.id} job={job} onClick={() => setLocation(`/jobs/${job.id}`)} />
                    ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Follow-Up Tab ── */}
        <TabsContent value="followup">
          <FollowUpTab />
        </TabsContent>

        {/* ── Projects Tab ── */}
        <TabsContent value="projects">
          <ProjectsOverviewTab />
        </TabsContent>
      </Tabs>

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

// ─── Follow-Up Tab ────────────────────────────────────────────────────────────
function FollowUpTab() {
  const utils = trpc.useUtils();
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "all">("today");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newType, setNewType] = useState<"call" | "text" | "manual">("manual");

  const dateRange = useMemo(() => {
    const now = Date.now();
    if (dateFilter === "today") {
      const start = new Date(); start.setHours(0,0,0,0);
      const end = new Date(); end.setHours(23,59,59,999);
      return { startMs: start.getTime(), endMs: end.getTime() };
    }
    if (dateFilter === "week") {
      const start = new Date(); start.setDate(start.getDate() - 7); start.setHours(0,0,0,0);
      return { startMs: start.getTime(), endMs: now };
    }
    return {};
  }, [dateFilter]);

  const { data: followUps = [], isLoading } = trpc.followUps.list.useQuery(dateRange);

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
      const prev = utils.followUps.list.getData(dateRange);
      utils.followUps.list.setData(dateRange, (old) =>
        old?.map((f) => f.id === id ? { ...f, isFollowedUp } : f)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) utils.followUps.list.setData(dateRange, ctx.prev); },
    onSettled: () => utils.followUps.list.invalidate(),
  });

  const deleteFollowUp = trpc.followUps.delete.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); toast.success("Removed"); },
  });

  const pending = followUps.filter((f) => !f.isFollowedUp);
  const done = followUps.filter((f) => f.isFollowedUp);

  const TYPE_ICON = {
    call: <Phone className="h-3.5 w-3.5 text-blue-400" />,
    text: <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />,
    manual: <Zap className="h-3.5 w-3.5 text-amber-400" />,
  };

  const TYPE_LABEL = { call: "Call", text: "Text", manual: "Note" };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1">
          {(["today", "week", "all"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={dateFilter === f ? "default" : "outline"}
              className="h-7 text-xs capitalize"
              onClick={() => setDateFilter(f)}
            >
              {f === "today" ? "Today" : f === "week" ? "This Week" : "All Time"}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Entry
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Name</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Contact name" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Phone</label>
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(xxx) xxx-xxxx" className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Type</label>
              <Select value={newType} onValueChange={(v) => setNewType(v as any)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Incoming Call</SelectItem>
                  <SelectItem value="text">Incoming Text</SelectItem>
                  <SelectItem value="manual">Manual Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Note</label>
              <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="What did they need? Any context..." rows={2} className="text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button size="sm" onClick={() => createFollowUp.mutate({ contactName: newName || undefined, phone: newPhone || undefined, note: newNote || undefined, type: newType, contactedAt: Date.now() })} disabled={createFollowUp.isPending}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : followUps.length === 0 ? (
        <EmptyState
          icon={<Phone className="h-8 w-8 text-muted-foreground/40" />}
          title="No follow-ups"
          description={dateFilter === "today" ? "No calls or texts logged today." : "Nothing to follow up on."}
        />
      ) : (
        <div className="space-y-6">
          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Needs Follow-Up ({pending.length})
              </h3>
              <div className="space-y-2">
                {pending.map((f) => (
                  <FollowUpRow key={f.id} followUp={f} typeIcon={TYPE_ICON[f.type]} typeLabel={TYPE_LABEL[f.type]} onToggle={(v) => toggleFollowUp.mutate({ id: f.id, isFollowedUp: v })} onDelete={() => deleteFollowUp.mutate({ id: f.id })} />
                ))}
              </div>
            </div>
          )}
          {/* Done */}
          {done.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Followed Up ({done.length})
              </h3>
              <div className="space-y-2 opacity-60">
                {done.map((f) => (
                  <FollowUpRow key={f.id} followUp={f} typeIcon={TYPE_ICON[f.type]} typeLabel={TYPE_LABEL[f.type]} onToggle={(v) => toggleFollowUp.mutate({ id: f.id, isFollowedUp: v })} onDelete={() => deleteFollowUp.mutate({ id: f.id })} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FollowUpRow({
  followUp,
  typeIcon,
  typeLabel,
  onToggle,
  onDelete,
}: {
  followUp: { id: number; contactName?: string | null; phone?: string | null; note?: string | null; type: string; isFollowedUp: boolean; createdAt: Date };
  typeIcon: React.ReactNode;
  typeLabel: string;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${followUp.isFollowedUp ? "border-border bg-card/50" : "border-border bg-card hover:border-primary/30"}`}>
      <Checkbox
        checked={followUp.isFollowedUp}
        onCheckedChange={(v) => onToggle(!!v)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium text-sm ${followUp.isFollowedUp ? "line-through text-muted-foreground" : ""}`}>
            {followUp.contactName || "Unknown"}
          </span>
          {followUp.phone && (
            <span className="text-xs text-muted-foreground">{followUp.phone}</span>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {typeIcon}
            <span>{typeLabel}</span>
          </div>
        </div>
        {followUp.note && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{followUp.note}</p>
        )}
        <p className="text-xs text-muted-foreground/60 mt-1">
          {new Date(followUp.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors mt-0.5">
        <span className="text-xs">✕</span>
      </button>
    </div>
  );
}

// ─── Projects Overview Tab ────────────────────────────────────────────────────
function ProjectsOverviewTab() {
  const [, setLocation] = useLocation();
  const { data: projects = [], isLoading } = trpc.projects.list.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: dueReminders = [] } = trpc.projects.getDueReminders.useQuery();

  const active = projects.filter((p) => p.status === "active");
  const activeDueReminders = dueReminders.filter((r) => !r.isDismissed);

  return (
    <div className="space-y-4">
      {activeDueReminders.length > 0 && (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <Bell className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {activeDueReminders.length} project reminder{activeDueReminders.length > 1 ? "s" : ""} due
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{activeDueReminders[0]?.message}</p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLocation("/projects")}>
            View
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{active.length} active project{active.length !== 1 ? "s" : ""}</p>
        <Button size="sm" variant="outline" onClick={() => setLocation("/projects")}>
          <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> All Projects
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : active.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8 text-muted-foreground/40" />}
          title="No active projects"
          description="Head to the Projects page to create one."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {active.slice(0, 6).map((p) => {
            const clientName = clients.find((c) => c.id === p.clientId)?.name;
            const isOverdue = p.dueDate && p.dueDate < Date.now();
            return (
              <button
                key={p.id}
                onClick={() => setLocation("/projects")}
                className="text-left p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-1">{p.title}</p>
                  {isOverdue && <Badge className="bg-destructive/15 text-destructive text-[10px] shrink-0">Overdue</Badge>}
                </div>
                {clientName && <p className="text-xs text-muted-foreground mb-2">{clientName}</p>}
                {p.dueDate && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Due {new Date(p.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
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
