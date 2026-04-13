import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDate, formatTime, statusClass, statusLabel, type JobStatus } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Users,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import JobFormModal from "@/components/JobFormModal";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showJobForm, setShowJobForm] = useState(false);
  const { data, isLoading } = trpc.dashboard.getData.useQuery();
  const utils = trpc.useUtils();

  const isAdmin = user?.role === "admin";

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
        {isAdmin && (
          <Button onClick={() => setShowJobForm(true)} size="sm" className="shrink-0">
            <Plus className="h-4 w-4 mr-1.5" />
            New Job
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Today's Jobs"
          value={isLoading ? null : todayJobs.length}
          icon={<Calendar className="h-4 w-4 text-primary" />}
          loading={isLoading}
        />
        <StatCard
          label="Remaining"
          value={isLoading ? null : scheduledToday}
          icon={<Clock className="h-4 w-4 text-amber-400" />}
          loading={isLoading}
        />
        <StatCard
          label="Completed"
          value={isLoading ? null : completedToday}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          loading={isLoading}
        />
        {isAdmin ? (
          <StatCard
            label="Active Clients"
            value={isLoading ? null : (data?.totalClients ?? 0)}
            icon={<Users className="h-4 w-4 text-violet-400" />}
            loading={isLoading}
          />
        ) : (
          <StatCard
            label="Upcoming"
            value={isLoading ? null : upcomingJobs.length}
            icon={<Zap className="h-4 w-4 text-violet-400" />}
            loading={isLoading}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's schedule */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Today's Schedule</h2>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/calendar")} className="text-xs text-muted-foreground h-7 px-2">
              View calendar <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : todayJobs.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-8 w-8 text-muted-foreground/40" />}
              title="No jobs today"
              description="Your schedule is clear. Enjoy the day or add a new job."
            />
          ) : (
            <div className="space-y-2">
              {todayJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => setLocation(`/jobs/${job.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming jobs */}
        <div className="space-y-3">
          <h2 className="font-semibold text-base">Upcoming</h2>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : upcomingJobs.filter((j) => {
            const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
            return j.scheduledStart > todayEnd.getTime();
          }).length === 0 ? (
            <EmptyState
              icon={<Clock className="h-6 w-6 text-muted-foreground/40" />}
              title="No upcoming jobs"
              description="Nothing scheduled beyond today."
              compact
            />
          ) : (
            <div className="space-y-2">
              {upcomingJobs
                .filter((j) => {
                  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
                  return j.scheduledStart > todayEnd.getTime();
                })
                .slice(0, 6)
                .map((job) => (
                  <UpcomingJobRow
                    key={job.id}
                    job={job}
                    onClick={() => setLocation(`/jobs/${job.id}`)}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

      {showJobForm && (
        <JobFormModal
          open={showJobForm}
          onClose={() => setShowJobForm(false)}
          onSuccess={() => {
            setShowJobForm(false);
            utils.dashboard.getData.invalidate();
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function JobCard({
  job,
  onClick,
}: {
  job: { id: number; title: string; status: string; scheduledStart: number; scheduledEnd: number; address?: string | null };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-card/80 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{job.title}</p>
          {job.address && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{job.address}</p>
          )}
        </div>
        <Badge className={`${statusClass(job.status as JobStatus)} text-[10px] shrink-0 rounded-full`}>
          {statusLabel(job.status as JobStatus)}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {formatTime(job.scheduledStart)} – {formatTime(job.scheduledEnd)}
        </span>
      </div>
    </button>
  );
}

function UpcomingJobRow({
  job,
  onClick,
}: {
  job: { id: number; title: string; status: string; scheduledStart: number };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-lg px-3 py-2.5 hover:border-primary/40 transition-all group flex items-center justify-between gap-2"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{job.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(job.scheduledStart)}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
    </button>
  );
}

function EmptyState({
  icon,
  title,
  description,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}) {
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
