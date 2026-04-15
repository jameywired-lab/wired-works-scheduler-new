import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FolderOpen, Search, ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react";

// ── Donut chart (same as ProjectsPage) ──────────────────────────────────────
function DonutChart({ pct }: { pct: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  const color =
    pct >= 100 ? "#22c55e" : pct >= 60 ? "#3b82f6" : pct >= 30 ? "#f59e0b" : "#6b7280";
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
      <circle
        cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="30" textAnchor="middle" fontSize="10" fontWeight="600" fill={color}>
        {pct}%
      </text>
    </svg>
  );
}

function jobTypeBadge(type: string | null) {
  switch (type) {
    case "new_construction": return <Badge className="bg-blue-500/15 text-blue-600 border-blue-300/40 text-[10px]">New Construction</Badge>;
    case "commercial": return <Badge className="bg-violet-500/15 text-violet-600 border-violet-300/40 text-[10px]">Commercial</Badge>;
    case "retrofit": return <Badge className="bg-amber-500/15 text-amber-600 border-amber-300/40 text-[10px]">Retrofit</Badge>;
    default: return null;
  }
}

export default function CrewProjectsPage() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: projects = [], isLoading } = trpc.projects.list.useQuery();

  const active = projects.filter(
    (p) => p.status !== "completed" && p.status !== "cancelled"
  );

  const filtered = active.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.clientName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-500/10">
          <FolderOpen className="h-6 w-6 text-violet-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} active project{active.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects or clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Project list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No active projects</p>
          {search && <p className="text-sm mt-1">Try a different search</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((project) => (
            <CrewProjectCard
              key={project.id}
              project={project}
              expanded={expandedId === project.id}
              onToggle={() => setExpandedId(expandedId === project.id ? null : project.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Individual project card ──────────────────────────────────────────────────
function CrewProjectCard({
  project,
  expanded,
  onToggle,
}: {
  project: { id: number; title: string; clientName?: string | null; projectType?: string | null; status: string };
  expanded: boolean;
  onToggle: () => void;
}) {
  const { data: milestones = [] } = trpc.projects.getMilestones.useQuery(
    { projectId: project.id },
    { enabled: expanded }
  );

  // Weighted progress
  const totalWeight = milestones.reduce((s, m) => s + (m.weight ?? 0), 0);
  const doneWeight = milestones
    .filter((m) => m.isComplete)
    .reduce((s, m) => s + (m.weight ?? 0), 0);
  const pct = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;

  // Quick pct from milestone count when not expanded
  const quickPct = (() => {
    // We don't have milestones unless expanded; show 0 as placeholder
    return expanded ? pct : 0;
  })();

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left"
        onClick={onToggle}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {expanded ? (
              <DonutChart pct={pct} />
            ) : (
              <div className="h-13 w-13 flex items-center justify-center shrink-0">
                <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold leading-tight truncate">{project.title}</p>
                {expanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
              </div>
              {project.clientName && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">{project.clientName}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {jobTypeBadge(project.projectType ?? null)}
              </div>
            </div>
          </div>
        </CardContent>
      </button>

      {/* Expanded milestone list */}
      {expanded && milestones.length > 0 && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Stages — {pct}% complete
          </p>
          {milestones
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((m) => (
              <div key={m.id} className="flex items-center gap-2.5">
                {m.isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
                <span className={`text-sm flex-1 ${m.isComplete ? "line-through text-muted-foreground" : ""}`}>
                  {m.title}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  m.isComplete
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {m.weight ?? 0}%
                </span>
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}
