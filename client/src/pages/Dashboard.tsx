import { useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
  ArrowRight,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  FolderOpen,
  MessageSquare,
  Phone,
  Plus,
  Users,
  Wrench,
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

  // Job-type breakdown (all upcoming + today)
  const allJobs = [...todayJobs, ...upcomingJobs];
  const serviceCallsToday = todayJobs.filter((j) => j.jobType === "service_call" || !j.jobType).length;
  const projectJobsActive = allJobs.filter((j) => j.jobType === "project_job").length;
  const salesCallsToday = todayJobs.filter((j) => j.jobType === "sales_call").length;

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

      {/* Stats row — primary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Today's Jobs" value={isLoading ? null : todayJobs.length} icon={<Calendar className="h-4 w-4 text-primary" />} loading={isLoading} />
        <StatCard label="Remaining" value={isLoading ? null : scheduledToday} icon={<Clock className="h-4 w-4 text-amber-400" />} loading={isLoading} />
        <StatCard label="Completed" value={isLoading ? null : completedToday} icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} loading={isLoading} />
        <StatCard label="Active Clients" value={isLoading ? null : (data?.totalClients ?? 0)} icon={<Users className="h-4 w-4 text-violet-400" />} loading={isLoading} />
      </div>

      {/* Job-type breakdown row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Service Calls Today"
          value={isLoading ? null : serviceCallsToday}
          icon={<Wrench className="h-4 w-4 text-blue-400" />}
          loading={isLoading}
        />
        <StatCard
          label="Active Projects"
          value={isLoading ? null : projectJobsActive}
          icon={<Briefcase className="h-4 w-4 text-violet-400" />}
          loading={isLoading}
        />
        <StatCard
          label="Sales Calls Today"
          value={isLoading ? null : salesCallsToday}
          icon={<Phone className="h-4 w-4 text-emerald-400" />}
          loading={isLoading}
        />
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
  const [, setLocation] = useLocation();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newType, setNewType] = useState<"call" | "text" | "manual">("manual");
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [acceptTitle, setAcceptTitle] = useState("");

  // All active (not followed-up) follow-ups
  const { data: allFollowUps = [], isLoading } = trpc.followUps.list.useQuery();

  const createFollowUp = trpc.followUps.create.useMutation({
    onSuccess: () => {
      utils.followUps.list.invalidate();
      setNewName(""); setNewPhone(""); setNewNote(""); setNewType("manual");
      setShowAddForm(false);
      toast.success("Follow-up added");
    },
    onError: (e) => toast.error(e.message),
  });

  const completeTask = trpc.followUps.completeTask.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); toast.success("Task completed!"); },
    onError: (e) => toast.error(e.message),
  });

  const sendProposal = trpc.followUps.sendProposal.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); toast.success("Proposal marked as sent — follow-up in 24h"); },
    onError: (e) => toast.error(e.message),
  });

  const resolveProposal = trpc.followUps.resolveProposal.useMutation({
    onSuccess: (data) => {
      utils.followUps.list.invalidate();
      utils.projects.list.invalidate();
      setAcceptingId(null);
      setAcceptTitle("");
      if (data.outcome === "accepted") toast.success("Project created! Client moved to Projects.");
      else if (data.outcome === "declined") toast.success("Follow-up removed — client declined.");
      else toast.success("Follow-up updated — client not ready yet.");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteFollowUp = trpc.followUps.delete.useMutation({
    onSuccess: () => utils.followUps.list.invalidate(),
  });

  const markUrgent = trpc.followUps.markUrgent.useMutation({
    onSuccess: () => utils.followUps.list.invalidate(),
  });

  const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;

  const now2 = Date.now();
  const pending = allFollowUps
    .filter((f) => !f.isFollowedUp && (!(f as any).remindAt || (f as any).remindAt <= now2))
    .sort((a, b) => {
      if ((a as any).clientContacted && !(b as any).clientContacted) return -1;
      if (!(a as any).clientContacted && (b as any).clientContacted) return 1;
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  const done = allFollowUps.filter((f) => f.isFollowedUp);

  // Auto-mark urgent if proposal sent > 24h ago (in effect to avoid render-phase side-effects)
  useEffect(() => {
    const now = Date.now();
    pending.forEach((f) => {
      if (
        f.type === "proposal" &&
        f.proposalStatus === "pending" &&
        f.proposalSentAt &&
        now - f.proposalSentAt > TWENTY_FOUR_H &&
        !f.isUrgent
      ) {
        markUrgent.mutate({ id: f.id });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFollowUps]);

  const TYPE_ICON: Record<string, React.ReactNode> = {
    call: <Phone className="h-3 w-3 text-blue-400" />,
    text: <MessageSquare className="h-3 w-3 text-emerald-400" />,
    manual: <Zap className="h-3 w-3 text-amber-400" />,
    closeout: <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
    proposal: <Briefcase className="h-3 w-3 text-violet-400" />,
  };

  const urgentCount = pending.filter((f) => f.isUrgent).length;

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
            {urgentCount > 0 && (
              <Badge className="bg-destructive/20 text-destructive text-[10px] h-4 px-1.5 flex items-center gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />{urgentCount} urgent
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground px-2" onClick={() => setLocation("/follow-ups")}>
              View All
            </Button>
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

        {/* Accept project dialog */}
        {acceptingId !== null && (
          <div className="border border-emerald-500/30 rounded-lg p-3 space-y-2 bg-emerald-500/5">
            <p className="text-xs font-semibold text-emerald-400">Create Project for Accepted Client</p>
            <Input
              value={acceptTitle}
              onChange={(e) => setAcceptTitle(e.target.value)}
              placeholder="Project title…"
              className="h-7 text-xs"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setAcceptingId(null); setAcceptTitle(""); }}>Cancel</Button>
              <Button
                size="sm"
                className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700"
                disabled={!acceptTitle.trim() || resolveProposal.isPending}
                onClick={() => resolveProposal.mutate({
                  id: acceptingId,
                  outcome: "accepted",
                  projectTitle: acceptTitle.trim(),
                  projectClientId: allFollowUps.find((f) => f.id === acceptingId)?.clientId ?? undefined,
                })}
              >
                Create Project
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1,2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : pending.length === 0 && done.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">No follow-ups</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Pending follow-ups — urgent first */}
            {[...pending].sort((a, b) => (b.isUrgent ? 1 : 0) - (a.isUrgent ? 1 : 0)).map((f) => {
              const isUrgent = f.isUrgent;
              const isProposal = f.type === "proposal";
              const proposalPending = isProposal && f.proposalStatus === "pending";
              const proposalUnsent = isProposal && (f.proposalStatus === "none" || f.proposalStatus === "not_ready");

              return (
                <div
                  key={f.id}
                  className={`rounded-lg border p-3 transition-all group ${
                    isUrgent
                      ? "border-destructive/50 bg-destructive/5 ring-1 ring-destructive/20"
                      : isProposal
                      ? "border-violet-500/30 bg-violet-500/5"
                      : "border-border bg-card"
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isUrgent && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                        <span className={`text-xs font-semibold truncate ${isUrgent ? "text-destructive" : ""}`}>
                          {f.contactName || "Unknown"}
                        </span>
                        {TYPE_ICON[f.type]}
                        {f.phone && <span className="text-[10px] text-muted-foreground">{f.phone}</span>}
                        {isUrgent && (
                          <Badge className="bg-destructive/15 text-destructive text-[10px] h-4 px-1.5">URGENT</Badge>
                        )}
                        {proposalPending && (
                          <Badge className="bg-violet-500/15 text-violet-400 text-[10px] h-4 px-1.5">Proposal Sent</Badge>
                        )}
                      </div>
                      {f.note && (
                        <p className={`text-[10px] mt-0.5 line-clamp-2 ${
                          isUrgent ? "text-destructive/80" : "text-muted-foreground"
                        }`}>{f.note}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteFollowUp.mutate({ id: f.id })}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all text-xs shrink-0 mt-0.5"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {/* Complete Task — always available */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      disabled={completeTask.isPending}
                      onClick={() => completeTask.mutate({ id: f.id })}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400" />
                      Complete Task
                    </Button>

                    {/* Proposal: unsent → show Send Proposal button */}
                    {proposalUnsent && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
                        disabled={sendProposal.isPending}
                        onClick={() => sendProposal.mutate({ id: f.id })}
                      >
                        <Briefcase className="h-3 w-3 mr-1" />
                        Proposal Sent — Follow Up in 24h
                      </Button>
                    )}

                    {/* Proposal: pending → show outcome buttons */}
                    {proposalPending && (
                      <>
                        <Button
                          size="sm"
                          className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={resolveProposal.isPending}
                          onClick={() => setAcceptingId(f.id)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Client Accepted
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                          disabled={resolveProposal.isPending}
                          onClick={() => resolveProposal.mutate({ id: f.id, outcome: "declined" })}
                        >
                          Client Declined
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          disabled={resolveProposal.isPending}
                          onClick={() => resolveProposal.mutate({ id: f.id, outcome: "not_ready" })}
                        >
                          Not Ready Yet
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Done — compact */}
            {done.slice(0, 3).map((f) => (
              <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card/50 opacity-50">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-xs line-through text-muted-foreground truncate flex-1">{f.contactName || "Unknown"}</span>
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
function StatCard({ label, value, icon, loading, accent }: { label: string; value: number | null; icon: React.ReactNode; loading: boolean; accent?: string }) {
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
