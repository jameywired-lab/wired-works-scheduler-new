/**
 * CrewHomePage — the daily feed for crew members.
 *
 * Shows:
 *  1. A greeting with today's date
 *  2. Today's assigned tasks (from owner) — each with a "Mark Done" button
 *  3. Today's scheduled jobs — with time, client, address, directions, expand for details
 *  4. Upcoming jobs (next 7 days, not today)
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  MapPin,
  Navigation,
  Phone,
  Briefcase,
  Calendar,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isTomorrow, addDays, startOfDay, endOfDay } from "date-fns";

function statusColor(status: string) {
  switch (status) {
    case "scheduled": return "bg-blue-100 text-blue-700 border-blue-200";
    case "in_progress": return "bg-amber-100 text-amber-700 border-amber-200";
    case "completed": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "cancelled": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-gray-100 text-gray-600";
  }
}

function jobTypeLabel(type: string) {
  switch (type) {
    case "service_call": return "Service Call";
    case "sales_call": return "Sales Call";
    case "project_job": return "Project Job";
    default: return type ?? "Job";
  }
}

function dayLabel(dateMs: number) {
  const d = new Date(dateMs);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMM d");
}

export default function CrewHomePage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Resolve the crew member record for this user
  const { data: crewMember } = trpc.crewTasks.getMyCrewMember.useQuery(
    { userId: user?.id ?? 0 },
    { enabled: !!user?.id }
  );

  // Tasks assigned to this crew member
  const { data: tasks = [] } = trpc.crewTasks.listForMember.useQuery(
    { crewMemberId: crewMember?.id ?? 0 },
    { enabled: !!crewMember?.id, refetchInterval: 60_000 }
  );

  // All jobs (we filter client-side for today/upcoming)
  const { data: jobs = [], isLoading: jobsLoading } = trpc.jobs.list.useQuery(
    undefined,
    { refetchInterval: 60_000 }
  );

  const completeTask = trpc.crewTasks.complete.useMutation({
    onSuccess: () => {
      utils.crewTasks.listForMember.invalidate();
      toast.success("Task marked as done!");
    },
  });

  const [expandedJob, setExpandedJob] = useState<number | null>(null);

  // Date buckets
  const todayStart = startOfDay(new Date()).getTime();
  const todayEnd = endOfDay(new Date()).getTime();
  const weekEnd = endOfDay(addDays(new Date(), 7)).getTime();

  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status !== "cancelled"),
    [jobs]
  );

  const todayJobs = useMemo(
    () =>
      activeJobs.filter((j) => {
        if (!j.scheduledStart) return false;
        return j.scheduledStart >= todayStart && j.scheduledStart <= todayEnd;
      }).sort((a, b) => (a.scheduledStart ?? 0) - (b.scheduledStart ?? 0)),
    [activeJobs, todayStart, todayEnd]
  );

  const upcomingJobs = useMemo(
    () =>
      activeJobs.filter((j) => {
        if (!j.scheduledStart) return false;
        return j.scheduledStart > todayEnd && j.scheduledStart <= weekEnd;
      }).sort((a, b) => (a.scheduledStart ?? 0) - (b.scheduledStart ?? 0)),
    [activeJobs, todayEnd, weekEnd]
  );

  const todayCompleted = todayJobs.filter((j) => j.status === "completed").length;
  const todayRemaining = todayJobs.filter((j) => j.status !== "completed").length;

  // Task buckets
  const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < todayStart);
  const todayTasks = tasks.filter((t) => !t.dueDate || (t.dueDate >= todayStart && t.dueDate <= todayEnd));
  const futureTasks = tasks.filter((t) => t.dueDate && t.dueDate > todayEnd);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {greeting()}{crewMember?.name ? `, ${crewMember.name.split(" ")[0]}` : ""}!
        </h1>
        <p className="text-sm text-gray-500">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      {/* Day summary bar */}
      {(todayJobs.length > 0 || tasks.length > 0) && (
        <div className="flex gap-3 flex-wrap">
          {todayJobs.length > 0 && (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700">
              <Briefcase className="w-4 h-4" />
              {todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""} today
            </div>
          )}
          {todayRemaining > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-sm font-medium text-amber-700">
              <Clock className="w-4 h-4" />
              {todayRemaining} remaining
            </div>
          )}
          {todayCompleted > 0 && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700">
              <CheckCheck className="w-4 h-4" />
              {todayCompleted} completed
            </div>
          )}
          {tasks.length > 0 && (
            <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 text-sm font-medium text-purple-700">
              <ClipboardList className="w-4 h-4" />
              {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* ── Tasks Section ─────────────────────────────────────────── */}
      {tasks.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Tasks from Jamey
          </h2>

          {overdueTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-red-500 font-medium">Overdue</p>
              {overdueTasks.map((task) => (
                <TaskCard key={task.id} task={task} onComplete={() => completeTask.mutate({ id: task.id })} overdue />
              ))}
            </div>
          )}

          {todayTasks.length > 0 && (
            <div className="space-y-2">
              {overdueTasks.length > 0 && <p className="text-xs text-gray-400 font-medium">Today</p>}
              {todayTasks.map((task) => (
                <TaskCard key={task.id} task={task} onComplete={() => completeTask.mutate({ id: task.id })} />
              ))}
            </div>
          )}

          {futureTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 font-medium">Upcoming</p>
              {futureTasks.map((task) => (
                <TaskCard key={task.id} task={task} onComplete={() => completeTask.mutate({ id: task.id })} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Today's Schedule ──────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Today's Schedule
        </h2>

        {jobsLoading && (
          <p className="text-sm text-gray-400">Loading jobs...</p>
        )}

        {!jobsLoading && todayJobs.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-gray-400 text-sm">
              No jobs scheduled for today.
            </CardContent>
          </Card>
        )}

        {todayJobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            expanded={expandedJob === job.id}
            onToggle={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
          />
        ))}
      </section>

      {/* ── Upcoming Jobs ─────────────────────────────────────────── */}
      {upcomingJobs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Coming Up
          </h2>
          {upcomingJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              expanded={expandedJob === job.id}
              onToggle={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
              compact
            />
          ))}
        </section>
      )}
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  onComplete,
  overdue = false,
}: {
  task: { id: number; title: string; description?: string | null; dueDate?: number | null; createdBy?: string | null };
  onComplete: () => void;
  overdue?: boolean;
}) {
  return (
    <Card className={`border ${overdue ? "border-red-200 bg-red-50" : "border-purple-200 bg-purple-50"}`}>
      <CardContent className="p-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${overdue ? "text-red-800" : "text-purple-900"}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.dueDate && (
              <span className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-gray-500"}`}>
                {overdue ? "⚠ Due " : "Due "}{format(new Date(task.dueDate), "MMM d, h:mm a")}
              </span>
            )}
            {task.createdBy && (
              <span className="text-xs text-gray-400">from {task.createdBy}</span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-purple-300 text-purple-700 hover:bg-purple-100 text-xs"
          onClick={onComplete}
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Done
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({
  job,
  expanded,
  onToggle,
  compact = false,
}: {
  job: {
    id: number;
    title: string;
    status: string;
    scheduledStart?: number | null;
    scheduledEnd?: number | null;
    address?: string | null;
    description?: string | null;
    ownerInstructions?: string | null;
    jobType?: string | null;
    clientName?: string | null;
    clientPhone?: string | null;
  };
  expanded: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const isCompleted = job.status === "completed";

  return (
    <Card className={`border transition-all ${isCompleted ? "opacity-60 border-gray-200" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"}`}>
      <CardContent className="p-0">
        {/* Main row */}
        <button
          className="w-full text-left p-3 flex items-start gap-3"
          onClick={onToggle}
        >
          {/* Time column */}
          <div className="shrink-0 w-16 text-right">
            {job.scheduledStart ? (
              <div>
                <p className="text-xs font-semibold text-gray-700">{format(new Date(job.scheduledStart), "h:mm a")}</p>
                {!compact && job.scheduledEnd && (
                  <p className="text-xs text-gray-400">{format(new Date(job.scheduledEnd), "h:mm a")}</p>
                )}
                {compact && (
                  <p className="text-xs text-gray-400">{dayLabel(job.scheduledStart)}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No time</p>
            )}
          </div>

          {/* Left border accent */}
          <div className={`w-1 self-stretch rounded-full shrink-0 ${isCompleted ? "bg-emerald-400" : "bg-[#1e3a5f]"}`} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`font-semibold text-sm ${isCompleted ? "line-through text-gray-400" : "text-gray-900"}`}>
                {job.title}
              </p>
              <Badge variant="outline" className={`text-xs ${statusColor(job.status)}`}>
                {job.status.replace("_", " ")}
              </Badge>
            </div>
            {job.clientName && (
              <p className="text-xs text-gray-600 mt-0.5">{job.clientName}</p>
            )}
            {job.address && (
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{job.address}</span>
              </p>
            )}
          </div>

          <div className="shrink-0 text-gray-400">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-gray-100 mt-0">
            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap pt-2">
              {job.address && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(job.address!)}`, "_blank")}
                >
                  <Navigation className="w-3.5 h-3.5 mr-1" />
                  Directions
                </Button>
              )}
              {job.clientPhone && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-green-200 text-green-700 hover:bg-green-50"
                  onClick={() => window.open(`tel:${job.clientPhone}`, "_self")}
                >
                  <Phone className="w-3.5 h-3.5 mr-1" />
                  Call Client
                </Button>
              )}
            </div>

            {/* Job type */}
            {job.jobType && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Type</p>
                <p className="text-sm text-gray-700">{jobTypeLabel(job.jobType)}</p>
              </div>
            )}

            {/* Description */}
            {job.description && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Description</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
              </div>
            )}

            {/* Owner instructions */}
            {job.ownerInstructions && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">Instructions from Jamey</p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">{job.ownerInstructions}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
