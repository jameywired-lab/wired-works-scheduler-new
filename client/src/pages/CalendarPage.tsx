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
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";

// Color by job type (primary dimension)
const JOB_TYPE_COLORS: Record<string, { base: string; muted: string; label: string }> = {
  service_call: { base: "oklch(0.50 0.18 220)", muted: "oklch(0.42 0.14 220)", label: "Service Call" },
  sales_call:   { base: "oklch(0.50 0.18 145)", muted: "oklch(0.42 0.14 145)", label: "Sales Call" },
  project_job:  { base: "oklch(0.50 0.18 295)", muted: "oklch(0.42 0.14 295)", label: "Project Job" },
};

// Dim cancelled events regardless of type
const CANCELLED_COLOR = "oklch(0.35 0.05 240)";

export default function CalendarPage() {
  const { user } = useAuth();
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

  const events: EventInput[] = useMemo(() => {
    return (jobs ?? []).map((job) => {
      const typeColors = JOB_TYPE_COLORS[job.jobType ?? "service_call"] ?? JOB_TYPE_COLORS.service_call;
      const isCancelled = job.status === "cancelled";
      const bgColor = isCancelled ? CANCELLED_COLOR : typeColors.base;
      // Dim completed events slightly
      const finalColor = job.status === "completed" ? typeColors.muted : bgColor;
      return {
        id: String(job.id),
        title: job.title,
        start: new Date(job.scheduledStart),
        end: new Date(job.scheduledEnd),
        backgroundColor: finalColor,
        borderColor: finalColor,
        classNames: [`fc-event-${job.status}`, `fc-type-${job.jobType ?? "service_call"}`],
        extendedProps: { status: job.status, jobType: job.jobType },
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

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        {Object.entries(JOB_TYPE_COLORS).map(([type, { base, label }]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: base }} />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: CANCELLED_COLOR }} />
          Cancelled
        </div>
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
          buttonText={{
            today: "Today",
            month: "Month",
            week: "Week",
            day: "Day",
            list: "List",
          }}
          eventContent={(info) => (
            <div className="px-1 py-0.5 overflow-hidden">
              <div className="font-medium text-[11px] leading-tight truncate">{info.event.title}</div>
              {!isMobile && (
                <div className="text-[10px] opacity-80 truncate">{info.timeText}</div>
              )}
            </div>
          )}
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
