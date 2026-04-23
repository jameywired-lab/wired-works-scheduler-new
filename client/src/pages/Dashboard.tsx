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
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  FolderOpen,
  MessageSquare,
  Phone,
  Plus,
  Users,
  Wrench,
  Zap,
  Camera,
  CheckCheck,
  Timer,
} from "lucide-react";
import { useLocation } from "wouter";
import JobFormModal from "@/components/JobFormModal";
import { toast } from "sonner";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showJobForm, setShowJobForm] = useState(false);
  const [showCompletedJobs, setShowCompletedJobs] = useState(false);
  const { data, isLoading } = trpc.dashboard.getData.useQuery();
  const utils = trpc.useUtils();

  const todayJobs = data?.todayJobs ?? [];
  const upcomingJobs = data?.upcomingJobs ?? [];
  const completedToday = todayJobs.filter((j) => j.status === "completed").length;
  const scheduledToday = todayJobs.filter((j) => j.status === "scheduled" || j.status === "in_progress").length;
  const serviceCallsToday = todayJobs.filter((j) => j.jobType === "service_call" || !j.jobType).length;
  const projectJobsToday = todayJobs.filter((j) => j.jobType === "project_job").length;
  // Use real project count from dashboard data
  const projectJobsActive = data?.activeProjectCount ?? 0;
  const totalJobTotal = data?.totalJobTotal ?? 0;

  return (
    <div className="relative space-y-6 max-w-7xl mx-auto">
      {/* Logo watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 flex items-center justify-center z-0"
        style={{ opacity: 0.04 }}
      >
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663534371359/gYJ9uUE9i5ygur2GefRATd/wired-works-logo_8018c711.png"
          alt=""
          className="w-[600px] max-w-[70vw] select-none"
          style={{ filter: "grayscale(100%) brightness(3)" }}
        />
      </div>
      {/* Header Banner */}
      <div
        className="-mx-4 md:-mx-6 lg:-mx-8 px-6 py-5 flex items-center justify-between gap-4 rounded-xl"
        style={{ background: "linear-gradient(135deg, #0f1f3d 0%, #1a3460 60%, #1e3f7a 100%)" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Good {getGreeting()},{" "}
            <span style={{ color: "#e8ff00", textShadow: "0 0 20px rgba(232,255,0,0.4)" }}>
              {user?.name?.split(" ")[0] ?? "there"}
            </span>
          </h1>
          <p className="text-blue-200/70 text-sm mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <Button
          onClick={() => setShowJobForm(true)}
          size="sm"
          className="shrink-0 bg-[#e8ff00] hover:bg-[#d4eb00] text-[#0f1f3d] font-semibold border-0"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Job
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Today's Jobs"
          value={isLoading ? null : todayJobs.length}
          sublabel={isLoading ? undefined : `${serviceCallsToday} service · ${projectJobsToday} project`}
          icon={<Calendar className="h-4 w-4 text-cyan-400" />}
          iconBg="bg-cyan-500/15"
          accent="border-l-cyan-500"
          loading={isLoading}
          onClick={() => setLocation("/calendar")}
        />
        <StatCard
          label="Active Projects"
          value={isLoading ? null : projectJobsActive}
          icon={<Briefcase className="h-4 w-4 text-orange-400" />}
          iconBg="bg-orange-500/15"
          accent="border-l-orange-500"
          loading={isLoading}
          onClick={() => setLocation("/projects")}
        />
        <StatCard label="Active Clients" value={isLoading ? null : (data?.totalClients ?? 0)} icon={<Users className="h-4 w-4 text-blue-400" />} iconBg="bg-blue-500/15" accent="border-l-blue-500" loading={isLoading} onClick={() => setLocation("/clients")} />
        <StatCard
          label="Completed This Month"
          value={isLoading ? null : (data?.completedThisMonth ?? 0)}
          sublabel={isLoading ? undefined : new Date().toLocaleString("en-US", { month: "long" })}
          icon={<CheckCheck className="h-4 w-4 text-emerald-400" />}
          iconBg="bg-emerald-500/15"
          accent="border-l-emerald-500"
          loading={isLoading}
          onClick={() => setShowCompletedJobs(true)}
        />
      </div>

      {/* Dashboard Calendar — between stats and main content */}
      <DashboardCalendar onNavigateToJob={(jobId) => setLocation(`/jobs/${jobId}`)} />

      {/* Main 3-column layout: Follow-Up (big left) + Today's Schedule (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Column 1 & 2: Follow-Up Panel (big) ── */}
        <div className="lg:col-span-2 space-y-6">
          <FollowUpPanel />
          {/* Projects Panel */}
          <ProjectsPanel />
        </div>

        {/* ── Column 3: Today's Schedule + Upcoming ── */}
        <div className="space-y-6">
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
        </div>
      </div>

      {/* Completed Visits Panel — full width below main grid */}
      <CompletedVisitsPanel />

      {showJobForm && (
        <JobFormModal
          open={showJobForm}
          onClose={() => setShowJobForm(false)}
          onSuccess={() => { setShowJobForm(false); utils.dashboard.getData.invalidate(); }}
        />
      )}
      <CompletedJobsModal open={showCompletedJobs} onClose={() => setShowCompletedJobs(false)} />
    </div>
  );
}

// ─── Dashboard Calendar ───────────────────────────────────────────────────────
// Status color mapping for job dots
const JOB_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-400",
  in_progress: "bg-amber-400",
  completed: "bg-emerald-400",
  cancelled: "bg-red-400/60",
};

function DashboardCalendar({ onNavigateToJob }: { onNavigateToJob: (jobId: number) => void }) {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Compute month range for query
  const monthStart = useMemo(() => new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getTime(), [viewDate]);
  const monthEnd = useMemo(() => new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime(), [viewDate]);

  const { data: monthJobs = [], isLoading } = trpc.jobs.listByDateRange.useQuery(
    { startMs: monthStart, endMs: monthEnd } as { startMs: number; endMs: number },
    { staleTime: 60_000 }
  );

  // Build a map: "YYYY-MM-DD" -> jobs[]
  type MonthJob = (typeof monthJobs)[number];
  const jobsByDay = useMemo(() => {
    const map: Record<string, MonthJob[]> = {};
    for (const job of monthJobs) {
      const key = new Date(job.scheduledStart).toLocaleDateString("en-CA"); // YYYY-MM-DD
      if (!map[key]) map[key] = [];
      map[key].push(job);
    }
    return map;
  }, [monthJobs]);

  // Jobs for the selected day (or today if nothing selected)
  const activeDateKey = selectedDate ?? today.toLocaleDateString("en-CA");
  const selectedJobs: MonthJob[] = jobsByDay[activeDateKey] ?? [];

  // Calendar grid helpers
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = today.toLocaleDateString("en-CA");

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  }

  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Build grid cells: leading empty cells + day cells
  const cells: Array<{ day: number | null; key: string | null }> = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ day: null, key: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Calendar header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">
            {viewDate.toLocaleString("en-US", { month: "long", year: "numeric" })}
          </h2>
          {isLoading && <span className="text-[10px] text-muted-foreground animate-pulse">Loading…</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(null); }}
            className="text-xs px-2 py-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground font-medium"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* Month grid */}
        <div className="p-3">
          {/* Day-of-week labels */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, idx) => {
              if (!cell.day || !cell.key) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }
              const dayJobs = jobsByDay[cell.key] ?? [];
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === activeDateKey;
              const hasJobs = dayJobs.length > 0;

              return (
                <button
                  key={cell.key}
                  onClick={() => setSelectedDate(cell.key === activeDateKey ? null : cell.key!)}
                  className={`
                    relative flex flex-col items-center justify-start pt-1 pb-1 rounded-lg aspect-square transition-all text-xs font-medium
                    ${isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isToday
                      ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                      : "hover:bg-accent text-foreground"
                    }
                  `}
                >
                  <span className="leading-none">{cell.day}</span>
                  {/* Job dots */}
                  {hasJobs && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-full px-0.5">
                      {dayJobs.slice(0, 3).map((job, i) => (
                        <span
                          key={i}
                          className={`w-1 h-1 rounded-full ${isSelected ? "bg-primary-foreground/70" : JOB_STATUS_COLORS[job.status] ?? "bg-muted-foreground/40"}`}
                        />
                      ))}
                      {dayJobs.length > 3 && (
                        <span className={`text-[8px] leading-none ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          +{dayJobs.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/50 flex-wrap">
            {[
              { label: "Scheduled", color: "bg-blue-400" },
              { label: "In Progress", color: "bg-amber-400" },
              { label: "Completed", color: "bg-emerald-400" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Day detail panel */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {activeDateKey === todayKey
                ? "Today"
                : new Date(activeDateKey + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </p>
            <span className="text-xs text-muted-foreground">
              {selectedJobs.length} job{selectedJobs.length !== 1 ? "s" : ""}
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : selectedJobs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <Calendar className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No jobs scheduled</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-64">
              {selectedJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => onNavigateToJob(job.id)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/30 transition-all group"
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${JOB_STATUS_COLORS[job.status] ?? "bg-muted-foreground/40"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{job.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatTime(job.scheduledStart)} – {formatTime(job.scheduledEnd)}
                      </p>
                      {job.address && (
                        <p className="text-[10px] text-muted-foreground truncate">{job.address}</p>
                      )}
                    </div>
                    <Badge className={`${statusClass(job.status as JobStatus)} text-[9px] shrink-0 rounded-full`}>
                      {statusLabel(job.status as JobStatus)}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Follow-Up Panel ──────────────────────────────────────────────────────────
function FollowUpPanel() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newType, setNewType] = useState<"call" | "text" | "manual">("call");
  const [activeNextSteps, setActiveNextSteps] = useState<number | null>(null);
  const [nextStepsText, setNextStepsText] = useState("");

  const { data: followUps = [], isLoading: fuLoading } = trpc.followUps.list.useQuery(undefined);

  const toggleFollowUp = trpc.followUps.toggle.useMutation({
    onMutate: async ({ id, isFollowedUp }) => {
      await utils.followUps.list.cancel();
      const prev = utils.followUps.list.getData(undefined);
      utils.followUps.list.setData(undefined, (old) =>
        old?.map((f) => f.id === id ? { ...f, isFollowedUp: !isFollowedUp } : f)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.followUps.list.setData(undefined, ctx.prev);
    },
    onSettled: () => utils.followUps.list.invalidate(),
  });

  const createFollowUp = trpc.followUps.create.useMutation({
    onSuccess: () => {
      utils.followUps.list.invalidate();
      setAddOpen(false);
      setNewName(""); setNewPhone(""); setNewNote(""); setNewType("call");
    },
  });

  const saveNextSteps = trpc.followUps.saveNextSteps.useMutation({
    onSuccess: () => {
      utils.followUps.list.invalidate();
      setActiveNextSteps(null);
      setNextStepsText("");
      toast.success("Next steps saved");
    },
  });

  const remindAfternoon = trpc.followUps.remindThisAfternoon.useMutation({
    onSuccess: () => { toast.success("Reminder set for 4 PM"); setActiveNextSteps(null); },
  });
  const remindTomorrow = trpc.followUps.remindTomorrow.useMutation({
    onSuccess: () => { toast.success("Reminder set for tomorrow morning"); setActiveNextSteps(null); },
  });

  const pending = followUps.filter((f) => !f.isFollowedUp);
  const done = followUps.filter((f) => f.isFollowedUp);

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span>🤙</span>
            Follow-Up
            {pending.length > 0 && (
              <Badge className="bg-amber-500/15 text-amber-500 text-[10px] h-5 px-1.5 rounded-full font-semibold">
                {pending.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/follow-ups")} className="text-xs text-muted-foreground h-7 px-2">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddOpen(true)}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Add form */}
        {addOpen && (
          <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Contact name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-xs" />
              <Input placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="h-8 text-xs" />
            </div>
            <Input placeholder="Note" value={newNote} onChange={(e) => setNewNote(e.target.value)} className="h-8 text-xs" />
            <div className="flex items-center gap-2">
              <Select value={newType} onValueChange={(v) => setNewType(v as "call" | "text" | "manual")}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-xs" onClick={() => createFollowUp.mutate({ contactName: newName, phone: newPhone, note: newNote, type: newType })} disabled={!newName.trim() || createFollowUp.isPending}>
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddOpen(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {fuLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        ) : followUps.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />} title="All clear for today" description="No follow-ups pending. Add one or check the Follow-Ups page." />
        ) : (
          <div className="space-y-2">
            {pending.map((f) => {
              const isNextStepsOpen = activeNextSteps === f.id;
              return (
                <div key={f.id} className="rounded-xl border border-border bg-background/50 p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={f.isFollowedUp}
                      onCheckedChange={() => toggleFollowUp.mutate({ id: f.id, isFollowedUp: f.isFollowedUp })}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{f.contactName}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">{f.type === "closeout" ? "Close-Out" : f.type}</Badge>
                        {f.phone && <span className="text-xs text-muted-foreground">{f.phone}</span>}
                        {f.createdAt && (
                          <span className="text-[10px] text-muted-foreground/60 ml-auto">
                            {new Date(f.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      {f.note && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{f.note}</p>}
                    </div>
                    <button
                      onClick={() => {
                        if (isNextStepsOpen) { setActiveNextSteps(null); setNextStepsText(""); }
                        else { setActiveNextSteps(f.id); setNextStepsText((f as any).nextStepsNote ?? ""); }

                      }}
                      className="shrink-0 text-[10px] text-amber-500 hover:text-amber-400 font-medium border border-amber-500/30 rounded px-1.5 py-0.5 transition-colors"
                    >
                      ✏️ Next Steps
                    </button>
                  </div>
                  {/* Next Steps panel */}
                  {isNextStepsOpen && (
                    <div className="ml-7 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
                      <Textarea
                        placeholder="What are the next steps for this follow-up?"
                        value={nextStepsText}
                        onChange={(e) => setNextStepsText(e.target.value)}
                        className="text-xs min-h-[60px] resize-none bg-background/80"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" className="h-7 text-xs" onClick={() => saveNextSteps.mutate({ id: f.id, nextStepsNote: nextStepsText })} disabled={saveNextSteps.isPending}>
                          Save Note
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => remindAfternoon.mutate({ id: f.id })} disabled={remindAfternoon.isPending}>
                          ⏰ Remind me this afternoon
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => remindTomorrow.mutate({ id: f.id })} disabled={remindTomorrow.isPending}>
                          🌅 Remind me tomorrow
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* Action buttons */}
                  <div className="ml-7 flex items-center gap-2 flex-wrap">
                    {f.phone && (
                      <>
                        {(f.type === "call" || f.type === "closeout") && (
                          <a href={`tel:${f.phone}`} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 border border-blue-400/30 rounded px-2 py-0.5 transition-colors">
                            <Phone className="h-2.5 w-2.5" /> Call
                          </a>
                        )}
                        {(f.type === "text" || f.type === "closeout") && (
                          <a href={`sms:${f.phone}`} className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 border border-emerald-400/30 rounded px-2 py-0.5 transition-colors">
                            <MessageSquare className="h-2.5 w-2.5" /> Reply via Text
                          </a>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => toggleFollowUp.mutate({ id: f.id, isFollowedUp: f.isFollowedUp })}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" /> Complete Task
                    </button>
                    {f.clientId && (
                      <button
                        onClick={() => setLocation(`/clients/${f.clientId}`)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowRight className="h-2.5 w-2.5" /> View client details
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Completed follow-ups are intentionally hidden from the dashboard panel — view them on the Follow-Ups page */}
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
function RevenueCard({ loading, totalJobTotal, onClick }: { loading: boolean; totalJobTotal: number; onClick?: () => void }) {
  const formatted = totalJobTotal > 0
    ? `$${totalJobTotal.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : "$0";
  const inner = (
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-muted-foreground font-semibold tracking-wide uppercase">Total Revenue</p>
        <div className="p-1.5 rounded-lg bg-emerald-500/15"><DollarSign className="h-4 w-4 text-emerald-400" /></div>
      </div>
      {loading ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-bold">{formatted}</p>}
    </CardContent>
  );
  if (onClick) {
    return (
      <Card className="bg-card cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all border-l-[3px] border-l-emerald-500" onClick={onClick}>
        {inner}
      </Card>
    );
  }
  return <Card className="bg-card border-l-[3px] border-l-emerald-500">{inner}</Card>;
}

function StatCard({ label, value, sublabel, icon, loading, accent, iconBg, onClick }: { label: string; value: number | null; sublabel?: string; icon: React.ReactNode; loading: boolean; accent?: string; iconBg?: string; onClick?: () => void }) {
  const inner = (
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-muted-foreground font-semibold tracking-wide uppercase">{label}</p>
        <div className={`p-1.5 rounded-lg ${iconBg ?? "bg-muted/50"}`}>{icon}</div>
      </div>
      {loading ? <Skeleton className="h-8 w-12" /> : <p className="text-3xl font-bold">{value}</p>}
      {!loading && sublabel && <p className="text-[11px] text-muted-foreground mt-1">{sublabel}</p>}
    </CardContent>
  );
  const borderClass = accent ? `border-l-[3px] ${accent}` : "";
  if (onClick) {
    return (
      <Card className={`bg-card cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all ${borderClass}`} onClick={onClick}>
        {inner}
      </Card>
    );
  }
  return <Card className={`bg-card ${borderClass}`}>{inner}</Card>;
}

function JobCard({ job, onClick }: { job: { id: number; title: string; status: string; scheduledStart: number; scheduledEnd: number; address?: string | null }; onClick: () => void }) {
  const isCompleted = job.status === "completed";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 transition-all group border ${
        isCompleted
          ? "bg-emerald-500/8 border-emerald-500/30 hover:border-emerald-500/50"
          : "bg-card border-border hover:border-primary/40 hover:bg-card/80"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-medium text-sm truncate transition-colors ${
            isCompleted ? "text-emerald-400 line-through decoration-emerald-400/50" : "group-hover:text-primary"
          }`}>{job.title}</p>
          {job.address && <p className="text-xs text-muted-foreground truncate mt-0.5">{job.address}</p>}
        </div>
        <Badge className={`${statusClass(job.status as JobStatus)} text-[10px] shrink-0 rounded-full`}>
          {statusLabel(job.status as JobStatus)}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <Clock className={`h-3 w-3 ${isCompleted ? "text-emerald-400/60" : "text-muted-foreground"}`} />
        <span className={`text-xs ${isCompleted ? "text-emerald-400/70" : "text-muted-foreground"}`}>
          {formatTime(job.scheduledStart)} – {formatTime(job.scheduledEnd)}
        </span>
        {isCompleted && (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </span>
        )}
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

// ─── Completed Visits Panel ─────────────────────────────────────────────────
function CompletedVisitsPanel() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<"today" | "week" | "all">("today");
  const { data: visits = [], isLoading } = trpc.dashboard.completedVisits.useQuery({ filter });
  function formatDuration(startMs: number | null, endMs: number | null): string {
    if (!startMs || !endMs) return "";
    const diffMs = endMs - startMs;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m onsite`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m onsite` : `${h}h onsite`;
  }
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CheckCheck className="h-4 w-4 text-emerald-400" />
          <h2 className="font-semibold text-base">Completed Visits</h2>
          {visits.length > 0 && (
            <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-medium">{visits.length}</span>
          )}
        </div>
        <div className="flex gap-1">
          {(["today", "week", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                filter === f
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {f === "today" ? "Today" : f === "week" ? "This Week" : "All"}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : visits.length === 0 ? (
        <EmptyState
          icon={<CheckCheck className="h-8 w-8 text-muted-foreground/40" />}
          title={filter === "today" ? "No visits completed today" : filter === "week" ? "No visits completed this week" : "No completed visits yet"}
          description="Completed visits will appear here with notes and photos."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visits.map((v) => (
            <button
              key={v.assignmentId}
              onClick={() => setLocation(`/jobs/${v.jobId}`)}
              className="text-left rounded-xl border border-border/50 bg-card hover:bg-accent/30 transition-colors p-4 space-y-2 w-full"
            >
              <div className="flex items-start gap-3">
                {v.firstPhotoUrl ? (
                  <img
                    src={v.firstPhotoUrl}
                    alt="Visit photo"
                    className="w-14 h-14 rounded-lg object-cover shrink-0 border border-border/40"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                    <Camera className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{v.jobTitle ?? "Job"}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.clientName ?? ""}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {v.crewMemberName && (
                      <span className="text-xs bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-medium">{v.crewMemberName}</span>
                    )}
                    {v.visitCompletedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.visitCompletedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {formatDuration(v.visitStartedAt, v.visitCompletedAt) && (
                      <span className="flex items-center gap-0.5 text-xs text-emerald-400">
                        <Timer className="h-3 w-3" />
                        {formatDuration(v.visitStartedAt, v.visitCompletedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {v.visitNotes && (
                <p className="text-xs text-muted-foreground line-clamp-2 border-t border-border/30 pt-2">
                  {v.visitNotes}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CompletedJobsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const { data: jobs, isLoading } = trpc.dashboard.completedJobsThisMonth.useQuery(undefined, { enabled: open });
  const monthName = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCheck className="h-5 w-5 text-emerald-500" />
            Completed Jobs — {monthName}
          </DialogTitle>
          <DialogDescription>
            {isLoading ? "Loading..." : `${jobs?.length ?? 0} job${(jobs?.length ?? 0) !== 1 ? "s" : ""} completed this month`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {isLoading && Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
          {!isLoading && (!jobs || jobs.length === 0) && (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No completed jobs this month yet.</p>
            </div>
          )}
          {!isLoading && jobs?.map((job) => (
            <button
              key={job.id}
              className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
              onClick={() => { onClose(); setLocation(`/jobs/${job.id}`); }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{job.title}</p>
                  {job.address && <p className="text-xs text-muted-foreground truncate">{job.address}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">Completed</Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(job.scheduledStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-border">
          <Button variant="outline" size="sm" className="w-full" onClick={() => { onClose(); setLocation("/calendar?status=completed"); }}>
            View all completed jobs
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
