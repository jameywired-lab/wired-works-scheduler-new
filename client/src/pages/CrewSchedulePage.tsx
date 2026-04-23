import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, MapPin, Users, Clock, ChevronRight, Calendar, CheckCircle2 } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(ts: number | null | undefined) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function nameToInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type TeamMember = { crewMemberId: number | null; name: string; colorHex?: string | null };

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
  teamMembers: TeamMember[];
};

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({
  job,
  myColor,
  onClick,
}: {
  job: ScheduleJob;
  myColor: string;
  onClick: () => void;
}) {
  const startTs = job.scheduledStart ? new Date(job.scheduledStart).getTime() : null;
  const endTs = job.scheduledEnd ? new Date(job.scheduledEnd).getTime() : null;
  const isStarted = !!job.visitStartedAt;
  const isCompleted = !!job.visitCompletedAt;

  // Determine left-border color:
  // - If only me → my color
  // - If mixed crew → black
  // - Completed → muted
  const allColors = Array.from(new Set([myColor, ...job.teamMembers.map((m) => m.colorHex ?? myColor)]));
  const borderColor = isCompleted
    ? "#6b7280"
    : allColors.length > 1
    ? "#111827"
    : myColor;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-xl overflow-hidden flex hover:shadow-md transition-shadow active:scale-[0.99]"
      style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
    >
      <div className="flex-1 px-4 py-3 min-w-0">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-sm truncate">{job.title}</p>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </div>

        {/* Client */}
        {job.clientName && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{job.clientName}</p>
        )}

        {/* Time + address */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
          {(startTs || endTs) && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {startTs ? formatTime(startTs) : ""}
              {startTs && endTs ? " – " : ""}
              {endTs ? formatTime(endTs) : ""}
            </span>
          )}
          {job.address && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[200px]">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{job.address}</span>
            </span>
          )}
        </div>

        {/* Team members */}
        {job.teamMembers.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Users className="w-3 h-3 text-muted-foreground" />
            <div className="flex items-center gap-1">
              {job.teamMembers.map((m, i) => {
                const color = m.colorHex ?? "#6366f1";
                return (
                  <span
                    key={i}
                    title={m.name}
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 18, height: 18, borderRadius: "50%", backgroundColor: color,
                      color: "#fff", fontSize: 7, fontWeight: 700, flexShrink: 0,
                      border: "1px solid rgba(255,255,255,0.3)",
                    }}
                  >
                    {nameToInitials(m.name)}
                  </span>
                );
              })}
              <span className="text-xs text-muted-foreground ml-1">
                {job.teamMembers.map((m) => m.name).join(", ")}
              </span>
            </div>
          </div>
        )}

        {/* Status badges */}
        <div className="flex gap-1.5 mt-1.5">
          {isCompleted && (
            <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-600 gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Visit complete
            </Badge>
          )}
          {isStarted && !isCompleted && (
            <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
              In progress
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CrewSchedulePage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [showPast, setShowPast] = useState(false);

  const { data: myProfile } = trpc.crewSchedule.myProfile.useQuery();
  const { data: schedule = [], isLoading } = trpc.crewSchedule.mySchedule.useQuery();

  const myColor = (myProfile as any)?.colorHex ?? "#6366f1";
  const firstName = user?.name?.split(" ")[0] ?? "there";

  // Convert Date objects to timestamps and sort chronologically
  const jobs: ScheduleJob[] = useMemo(() => {
    return (schedule as unknown as ScheduleJob[]).sort((a, b) => {
      const aTs = a.scheduledStart ? new Date(a.scheduledStart).getTime() : Infinity;
      const bTs = b.scheduledStart ? new Date(b.scheduledStart).getTime() : Infinity;
      return aTs - bTs;
    });
  }, [schedule]);

  // Today's jobs for the hero section
  const todayJobs = useMemo(() => jobs.filter((j) => j.scheduledStart && isToday(new Date(j.scheduledStart).getTime())), [jobs]);
  const completedToday = todayJobs.filter((j) => !!j.visitCompletedAt).length;

  // Group upcoming + past
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
        <div className="h-32 rounded-2xl bg-muted animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-24 min-h-screen bg-background">
      {/* ── Hero greeting banner ── */}
      <div
        className="px-5 pt-8 pb-6 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${myColor}22 0%, ${myColor}08 100%)` }}
      >
        {/* Decorative circle */}
        <div
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10"
          style={{ backgroundColor: myColor }}
        />
        <p className="text-sm font-medium text-muted-foreground mb-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: myColor }}>
          {getGreeting()}, {firstName}
        </h1>
        {todayJobs.length > 0 ? (
          <p className="text-sm text-muted-foreground mt-1">
            {todayJobs.length} visit{todayJobs.length !== 1 ? "s" : ""} today
            {completedToday > 0 && ` · ${completedToday} complete`}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">No visits scheduled today</p>
        )}
      </div>

      {/* ── Today's jobs — horizontal swipeable strip ── */}
      {todayJobs.length > 0 && (
        <div className="px-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Today's Visits</h2>
            <span className="text-xs text-muted-foreground">{completedToday}/{todayJobs.length} done</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
            {todayJobs.map((job) => {
              const startTs = job.scheduledStart ? new Date(job.scheduledStart).getTime() : null;
              const endTs = job.scheduledEnd ? new Date(job.scheduledEnd).getTime() : null;
              const isCompleted = !!job.visitCompletedAt;
              const isStarted = !!job.visitStartedAt;
              const allColors = Array.from(new Set([myColor, ...job.teamMembers.map((m) => m.colorHex ?? myColor)]));
              const cardColor = isCompleted ? "#6b7280" : allColors.length > 1 ? "#111827" : myColor;
              return (
                <button
                  key={job.id}
                  onClick={() => navigate(`/crew-job/${job.id}`)}
                  className="snap-start flex-shrink-0 w-64 rounded-2xl p-4 text-left transition-transform active:scale-[0.97] shadow-sm"
                  style={{ backgroundColor: cardColor + "18", border: `2px solid ${cardColor}40` }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-bold text-sm leading-tight truncate flex-1">{job.title}</p>
                    {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                    {isStarted && !isCompleted && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0 mt-1" />
                    )}
                  </div>
                  {job.clientName && (
                    <p className="text-xs text-muted-foreground truncate mb-1">{job.clientName}</p>
                  )}
                  {(startTs || endTs) && (
                    <p className="text-xs font-medium" style={{ color: cardColor }}>
                      {startTs ? formatTime(startTs) : ""}
                      {startTs && endTs ? " – " : ""}
                      {endTs ? formatTime(endTs) : ""}
                    </p>
                  )}
                  {job.address && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {job.address}
                    </p>
                  )}
                  {job.teamMembers.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      {job.teamMembers.map((m, i) => {
                        const c = m.colorHex ?? "#6366f1";
                        return (
                          <span
                            key={i}
                            title={m.name}
                            style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: 16, height: 16, borderRadius: "50%", backgroundColor: c,
                              color: "#fff", fontSize: 7, fontWeight: 700,
                            }}
                          >
                            {nameToInitials(m.name)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Full schedule list ── */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Full Schedule</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/crew-calendar")} className="gap-1 text-xs h-7">
            <Calendar className="w-3.5 h-3.5" />
            Calendar
          </Button>
        </div>

        {pastCount > 0 && !showPast && (
          <button
            onClick={() => setShowPast(true)}
            className="text-xs text-muted-foreground underline underline-offset-2 mb-3"
          >
            Show {pastCount} past day{pastCount !== 1 ? "s" : ""}
          </button>
        )}

        {visibleGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <CalendarDays className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No upcoming jobs scheduled</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {visibleGroups.map((group) => {
            const today = group.ts > 0 && isToday(group.ts);
            const dateLabel = group.ts > 0 ? formatDate(group.ts) : "Unscheduled";
            return (
              <div key={group.dateKey}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {dateLabel}
                  </span>
                  {today && (
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: myColor }}
                    >
                      Today
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {group.jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      myColor={myColor}
                      onClick={() => navigate(`/crew-job/${job.id}`)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
