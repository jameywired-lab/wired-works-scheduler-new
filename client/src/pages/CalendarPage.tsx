import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { EventClickArg, DateSelectArg, EventInput } from "@fullcalendar/core";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useRef, useMemo } from "react";
import { Plus } from "lucide-react";
import JobFormModal from "@/components/JobFormModal";
import { useIsMobile } from "@/hooks/useMobile";

const CANCELLED_COLOR = "oklch(0.35 0.05 240)";
const COMPLETED_OPACITY = "cc"; // hex alpha for ~80%

// Derive initials from a full name
function nameToInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type CrewEntry = { crewMemberId: number; crewMemberName: string; colorHex?: string | null };

/** Pick a calendar event background color based on crew assignment:
 *  - No crew → default blue
 *  - 1 crew member → their colorHex
 *  - Multiple crew members with different colors → black (mixed crew)
 *  - Cancelled → grey
 */
function pickEventColor(crew: CrewEntry[], isCancelled: boolean, isCompleted: boolean): string {
  if (isCancelled) return CANCELLED_COLOR;
  const colorSet = new Set(crew.map((c) => c.colorHex).filter(Boolean));
  const colors = Array.from(colorSet);
  let base: string;
  if (colors.length === 0) {
    base = "oklch(0.50 0.18 220)"; // default blue
  } else if (colors.length === 1) {
    base = colors[0]!;
  } else {
    base = "#1a1a1a"; // multiple different crew colors → black
  }
  if (isCompleted) {
    // Darken slightly for completed
    return base === "#1a1a1a" ? "#444" : base + COMPLETED_OPACITY;
  }
  return base;
}

function CrewBadge({ name, colorHex, size = "sm" }: { name: string; colorHex?: string | null; size?: "sm" | "xs" }) {
  const initials = nameToInitials(name);
  const color = colorHex ?? "oklch(0.50 0.10 240)";
  const dim = size === "xs" ? "14px" : "18px";
  const fontSize = size === "xs" ? "7px" : "8px";
  return (
    <span
      title={name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dim,
        height: dim,
        borderRadius: "50%",
        backgroundColor: color,
        color: "#fff",
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.02em",
        flexShrink: 0,
        border: "1px solid rgba(255,255,255,0.25)",
      }}
    >
      {initials}
    </span>
  );
}

export default function CalendarPage() {
  const [, setLocation] = useLocation();
  const [showJobForm, setShowJobForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { startMs: start.getTime(), endMs: end.getTime() };
  });
  const calendarRef = useRef<FullCalendar>(null);
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();

  const { data: jobs, isLoading } = trpc.jobs.listByDateRange.useQuery({
    startMs: dateRange.startMs,
    endMs: dateRange.endMs,
  });

  // Fetch crew list for legend
  const { data: crewList = [] } = trpc.crew.list.useQuery({});

  const events: EventInput[] = useMemo(() => {
    return (jobs ?? []).map((job) => {
      const crew: CrewEntry[] = (job as any).crew ?? [];
      const isCancelled = job.status === "cancelled";
      const isCompleted = job.status === "completed";
      const bgColor = pickEventColor(crew, isCancelled, isCompleted);
      return {
        id: String(job.id),
        title: job.title,
        start: new Date(job.scheduledStart),
        end: new Date(job.scheduledEnd),
        backgroundColor: bgColor,
        borderColor: bgColor,
        classNames: [`fc-event-${job.status}`, `fc-type-${job.jobType ?? "service_call"}`],
        extendedProps: {
          status: job.status,
          jobType: job.jobType,
          crew,
        },
      };
    });
  }, [jobs]);

  const handleEventClick = (info: EventClickArg) => {
    setLocation(`/jobs/${info.event.id}`);
  };

  const handleDateSelect = (info: DateSelectArg) => {
    setSelectedDate(info.start);
    setShowJobForm(true);
  };

  const handleDatesSet = (info: { start: Date; end: Date }) => {
    setDateRange({
      startMs: info.start.getTime(),
      endMs: info.end.getTime(),
    });
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Schedule and manage all jobs</p>
        </div>
        <Button size="sm" onClick={() => { setSelectedDate(undefined); setShowJobForm(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Job
        </Button>
      </div>

      {/* Legend — dynamic from crew DB */}
      <div className="flex flex-wrap gap-3 mb-3 items-center">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "oklch(0.50 0.18 220)" }} />
          No crew assigned
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#1a1a1a" }} />
          Mixed crew
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: CANCELLED_COLOR }} />
          Cancelled
        </div>
        {crewList.length > 0 && (
          <div className="flex items-center gap-3 ml-2 border-l border-border pl-3">
            {crewList.map((m) => {
              const color = (m as any).colorHex ?? "oklch(0.50 0.10 240)";
              return (
                <div key={m.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 16, height: 16, borderRadius: "50%", backgroundColor: color,
                      color: "#fff", fontSize: 8, fontWeight: 700,
                    }}
                  >
                    {nameToInitials(m.name)}
                  </span>
                  {m.name}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-3 md:p-5">
        {isLoading && (
          <div className="flex items-center justify-center h-12 text-sm text-muted-foreground mb-3">
            Loading jobs…
          </div>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView={isMobile ? "listWeek" : "timeGridWeek"}
          headerToolbar={{
            left: isMobile ? "prev,next" : "prev,next today",
            center: "title",
            right: isMobile ? "listWeek,dayGridMonth" : "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
          events={events}
          selectable={true}
          selectMirror={true}
          select={handleDateSelect}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height={isMobile ? "calc(100dvh - 220px)" : "calc(100dvh - 200px)"}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          nowIndicator
          eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day", list: "List" }}
          eventContent={(info) => {
            const crew: CrewEntry[] = info.event.extendedProps.crew ?? [];
            return (
              <div className="px-1 py-0.5 overflow-hidden w-full">
                <div className="flex items-center gap-1 w-full">
                  <span className="font-medium text-[11px] leading-tight truncate flex-1 min-w-0">
                    {info.event.title}
                  </span>
                  {crew.length > 0 && (
                    <span className="flex items-center gap-0.5 shrink-0">
                      {crew.slice(0, 3).map((c) => (
                        <CrewBadge key={c.crewMemberId} name={c.crewMemberName} colorHex={c.colorHex} size="xs" />
                      ))}
                    </span>
                  )}
                </div>
                {!isMobile && (
                  <div className="text-[10px] opacity-80 truncate">{info.timeText}</div>
                )}
              </div>
            );
          }}
        />
      </div>

      {showJobForm && (
        <JobFormModal
          open={showJobForm}
          onClose={() => setShowJobForm(false)}
          initialDate={selectedDate}
          onSuccess={() => {
            setShowJobForm(false);
            utils.jobs.listByDateRange.invalidate();
          }}
        />
      )}
    </div>
  );
}
