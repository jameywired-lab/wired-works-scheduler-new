import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, Users, Clock, ChevronRight, Calendar } from "lucide-react";

// Day band colors — cycles through these for visual separation
const DAY_COLORS = [
  "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
  "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
  "border-violet-500 bg-violet-50 dark:bg-violet-950/30",
  "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
  "border-rose-500 bg-rose-50 dark:bg-rose-950/30",
  "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30",
  "border-orange-500 bg-orange-50 dark:bg-orange-950/30",
];

const DAY_HEADER_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
];

function formatDate(ts: number | null | undefined) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatTime(ts: number | null | undefined) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getDateKey(ts: number | null | undefined) {
  if (!ts) return "unscheduled";
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isToday(ts: number | null | undefined) {
  if (!ts) return false;
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isFuture(ts: number | null | undefined) {
  if (!ts) return true;
  return new Date(ts) >= new Date();
}

type ScheduleJob = {
  id: number;
  title: string;
  description: string | null;
  status: string | null;
  scheduledStart: number | Date | null;
  scheduledEnd: number | Date | null;
  address: string | null;
  clientName: string | null;
  clientPhone: string | null;
  assignmentId: number;
  visitStartedAt: number | null;
  visitCompletedAt: number | null;
  visitNotes: string | null;
  teamMembers: { crewMemberId: number | null; name: string }[];
};

export default function CrewSchedulePage() {
  const [, navigate] = useLocation();
  const [showPast, setShowPast] = useState(false);

  const { data: schedule = [], isLoading } = trpc.crewSchedule.mySchedule.useQuery();

  // Convert Date objects to timestamps and sort chronologically
  const jobs: ScheduleJob[] = useMemo(() => {
    return (schedule as unknown as ScheduleJob[]).sort((a, b) => {
      const aTs = a.scheduledStart ? new Date(a.scheduledStart).getTime() : Infinity;
      const bTs = b.scheduledStart ? new Date(b.scheduledStart).getTime() : Infinity;
      return aTs - bTs;
    });
  }, [schedule]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, { dateKey: string; ts: number; jobs: ScheduleJob[] }>();
    for (const job of jobs) {
      const ts = job.scheduledStart ? new Date(job.scheduledStart).getTime() : 0;
      const key = getDateKey(ts);
      if (!map.has(key)) map.set(key, { dateKey: key, ts, jobs: [] });
      map.get(key)!.jobs.push(job);
    }
    return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
  }, [jobs]);

  const visibleGroups = useMemo(() => {
    if (showPast) return grouped;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return grouped.filter((g) => g.ts === 0 || new Date(g.ts) >= today);
  }, [grouped, showPast]);

  const pastCount = grouped.length - visibleGroups.length;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <CalendarDays className="w-16 h-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold text-muted-foreground">No jobs scheduled</h2>
        <p className="text-sm text-muted-foreground">Your upcoming jobs will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">My Schedule</h1>
          <p className="text-xs text-muted-foreground">{jobs.length} job{jobs.length !== 1 ? "s" : ""} assigned</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/crew-calendar")} className="gap-1.5">
          <Calendar className="w-4 h-4" />
          Calendar
        </Button>
      </div>

      {/* Past jobs toggle */}
      {pastCount > 0 && !showPast && (
        <button
          onClick={() => setShowPast(true)}
          className="mx-4 mt-3 text-xs text-muted-foreground underline underline-offset-2 text-left"
        >
          Show {pastCount} past day{pastCount !== 1 ? "s" : ""}
        </button>
      )}

      {/* Day groups */}
      <div className="flex flex-col gap-0 mt-3">
        {visibleGroups.map((group, groupIdx) => {
          const colorIdx = groupIdx % DAY_COLORS.length;
          const today = group.ts > 0 && isToday(group.ts);
          const dateLabel = group.ts > 0 ? formatDate(group.ts) : "Unscheduled";

          return (
            <div key={group.dateKey} className="mb-4">
              {/* Day header */}
              <div className={`mx-4 rounded-t-xl px-4 py-2 flex items-center gap-2 ${DAY_HEADER_COLORS[colorIdx]}`}>
                <CalendarDays className="w-4 h-4 text-white flex-shrink-0" />
                <span className="text-white font-semibold text-sm">{dateLabel}</span>
                {today && (
                  <Badge className="ml-auto bg-white/20 text-white border-0 text-xs">Today</Badge>
                )}
              </div>

              {/* Jobs in this day */}
              <div className={`mx-4 rounded-b-xl border-2 ${DAY_COLORS[colorIdx]} divide-y divide-border/50`}>
                {group.jobs.map((job) => {
                  const startTs = job.scheduledStart ? new Date(job.scheduledStart).getTime() : null;
                  const endTs = job.scheduledEnd ? new Date(job.scheduledEnd).getTime() : null;
                  const isStarted = !!job.visitStartedAt;
                  const isCompleted = !!job.visitCompletedAt;

                  return (
                    <button
                      key={job.id}
                      onClick={() => navigate(`/crew-job/${job.id}`)}
                      className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      {/* Status dot */}
                      <div className="mt-1 flex-shrink-0">
                        {isCompleted ? (
                          <div className="w-3 h-3 rounded-full bg-emerald-500" title="Completed" />
                        ) : isStarted ? (
                          <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" title="In progress" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" title="Not started" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm truncate">{job.title}</p>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>

                        {job.clientName && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{job.clientName}</p>
                        )}

                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {(startTs || endTs) && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {startTs ? formatTime(startTs) : ""}
                              {startTs && endTs ? " – " : ""}
                              {endTs ? formatTime(endTs) : ""}
                            </span>
                          )}
                          {job.address && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{job.address}</span>
                            </span>
                          )}
                        </div>

                        {job.teamMembers.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Users className="w-3 h-3" />
                            {job.teamMembers.map((m) => m.name).join(", ")}
                          </span>
                        )}

                        {isCompleted && (
                          <Badge variant="outline" className="mt-1 text-xs border-emerald-500 text-emerald-600">
                            Visit complete
                          </Badge>
                        )}
                        {isStarted && !isCompleted && (
                          <Badge variant="outline" className="mt-1 text-xs border-amber-500 text-amber-600">
                            In progress
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
