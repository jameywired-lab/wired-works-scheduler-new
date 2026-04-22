import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";

type ViewMode = "week" | "month";

type ScheduleJob = {
  id: number;
  title: string;
  clientName: string | null;
  scheduledStart: number | Date | null;
  scheduledEnd: number | Date | null;
  visitCompletedAt: number | null;
  visitStartedAt: number | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function getWeekStart(d: Date) {
  const c = startOfDay(d);
  c.setDate(c.getDate() - c.getDay()); // Sunday
  return c;
}

function getMonthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getMonthEnd(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function getJobTs(job: ScheduleJob) {
  if (!job.scheduledStart) return null;
  return new Date(job.scheduledStart).getTime();
}

function formatTime(ts: number | Date | null | undefined) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const JOB_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
];

export default function CrewCalendarPage() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());

  const { data: schedule = [], isLoading } = trpc.crewSchedule.mySchedule.useQuery();
  const jobs = schedule as unknown as ScheduleJob[];

  // Build a map: dateKey -> jobs[]
  const jobsByDate = useMemo(() => {
    const map = new Map<string, ScheduleJob[]>();
    for (const job of jobs) {
      const ts = getJobTs(job);
      if (!ts) continue;
      const d = new Date(ts);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(job);
    }
    return map;
  }, [jobs]);

  function getJobsForDay(d: Date) {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return jobsByDate.get(key) ?? [];
  }

  // Week view
  const weekDays = useMemo(() => {
    const start = getWeekStart(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  // Month view
  const monthDays = useMemo(() => {
    const start = getMonthStart(anchor);
    const end = getMonthEnd(anchor);
    // pad to start on Sunday
    const days: (Date | null)[] = [];
    for (let i = 0; i < start.getDay(); i++) days.push(null);
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) days.push(new Date(d));
    // pad to fill last row
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [anchor]);

  function prevPeriod() {
    if (view === "week") setAnchor((a) => addDays(a, -7));
    else setAnchor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1));
  }

  function nextPeriod() {
    if (view === "week") setAnchor((a) => addDays(a, 7));
    else setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1));
  }

  function goToday() {
    setAnchor(new Date());
  }

  const today = startOfDay(new Date());

  const periodLabel = view === "week"
    ? (() => {
        const start = getWeekStart(anchor);
        const end = addDays(start, 6);
        if (start.getMonth() === end.getMonth()) {
          return `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
        }
        return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
      })()
    : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;

  return (
    <div className="flex flex-col pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/crew-home")} className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-base flex-1">Calendar</h1>
          <Button variant="outline" size="sm" onClick={() => navigate("/crew-home")} className="gap-1.5">
            <List className="w-4 h-4" />
            Schedule
          </Button>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "week" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView("month")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "month" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              Month
            </button>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <Button variant="ghost" size="icon" onClick={prevPeriod} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <button onClick={goToday} className="text-xs font-medium text-muted-foreground hover:text-foreground px-1">
              Today
            </button>
            <Button variant="ghost" size="icon" onClick={nextPeriod} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-sm font-semibold">{periodLabel}</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : view === "week" ? (
        /* ─── WEEK VIEW ─── */
        <div className="flex flex-col gap-0 p-4">
          {weekDays.map((day, idx) => {
            const dayJobs = getJobsForDay(day);
            const isToday = sameDay(day, today);
            return (
              <div key={idx} className={`flex gap-3 py-3 border-b last:border-0 ${isToday ? "bg-blue-50/50 dark:bg-blue-950/20 -mx-4 px-4 rounded-lg" : ""}`}>
                {/* Day label */}
                <div className="w-12 flex-shrink-0 flex flex-col items-center pt-0.5">
                  <span className="text-xs text-muted-foreground font-medium">{WEEKDAYS[day.getDay()]}</span>
                  <span className={`text-lg font-bold leading-tight ${isToday ? "text-blue-600 dark:text-blue-400" : ""}`}>
                    {day.getDate()}
                  </span>
                  {isToday && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-0.5" />}
                </div>

                {/* Jobs */}
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  {dayJobs.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 italic pt-1">No jobs</p>
                  ) : (
                    dayJobs.map((job, jIdx) => {
                      const isCompleted = !!job.visitCompletedAt;
                      const isStarted = !!job.visitStartedAt;
                      return (
                        <button
                          key={job.id}
                          onClick={() => navigate(`/crew-job/${job.id}`)}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left w-full ${JOB_COLORS[jIdx % JOB_COLORS.length]} text-white`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{job.title}</p>
                            {job.clientName && <p className="text-xs opacity-80 truncate">{job.clientName}</p>}
                            {job.scheduledStart && (
                              <p className="text-xs opacity-70">{formatTime(job.scheduledStart)}</p>
                            )}
                          </div>
                          {isCompleted && <div className="w-2 h-2 rounded-full bg-white/80 flex-shrink-0" title="Complete" />}
                          {isStarted && !isCompleted && <div className="w-2 h-2 rounded-full bg-white/80 animate-pulse flex-shrink-0" title="In progress" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── MONTH VIEW ─── */
        <div className="p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {monthDays.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const dayJobs = getJobsForDay(day);
              const isToday = sameDay(day, today);
              const isPast = day < today;

              return (
                <div
                  key={idx}
                  className={`min-h-[60px] rounded-lg p-1 flex flex-col gap-0.5 ${
                    isToday
                      ? "bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500"
                      : isPast
                      ? "opacity-50"
                      : "bg-muted/30"
                  }`}
                >
                  <span className={`text-xs font-semibold text-center block ${isToday ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
                    {day.getDate()}
                  </span>
                  {dayJobs.slice(0, 2).map((job, jIdx) => (
                    <button
                      key={job.id}
                      onClick={() => navigate(`/crew-job/${job.id}`)}
                      className={`w-full rounded text-left px-1 py-0.5 ${JOB_COLORS[jIdx % JOB_COLORS.length]} text-white`}
                    >
                      <p className="text-[10px] font-medium truncate leading-tight">{job.title}</p>
                    </button>
                  ))}
                  {dayJobs.length > 2 && (
                    <span className="text-[10px] text-muted-foreground text-center">+{dayJobs.length - 2} more</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upcoming Jobs</p>
            {jobs
              .filter((j) => {
                const ts = getJobTs(j);
                return ts && new Date(ts) >= today;
              })
              .sort((a, b) => (getJobTs(a) ?? 0) - (getJobTs(b) ?? 0))
              .slice(0, 10)
              .map((job) => {
                const ts = getJobTs(job);
                return (
                  <button
                    key={job.id}
                    onClick={() => navigate(`/crew-job/${job.id}`)}
                    className="flex items-center gap-3 text-left py-2 border-b last:border-0"
                  >
                    <div className="flex flex-col items-center w-10 flex-shrink-0">
                      {ts && (
                        <>
                          <span className="text-xs text-muted-foreground">{MONTHS[new Date(ts).getMonth()].slice(0, 3)}</span>
                          <span className="text-lg font-bold leading-tight">{new Date(ts).getDate()}</span>
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{job.title}</p>
                      {job.clientName && <p className="text-xs text-muted-foreground truncate">{job.clientName}</p>}
                      {ts && <p className="text-xs text-muted-foreground">{formatTime(ts)}</p>}
                    </div>
                    {job.visitCompletedAt && <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-600 flex-shrink-0">Done</Badge>}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
