import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FolderOpen, Search, ChevronRight, CheckCircle2, Clock, PauseCircle, XCircle } from "lucide-react";

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-300/40 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
    case "on_hold":
      return <Badge className="bg-amber-500/15 text-amber-600 border-amber-300/40 text-[10px]"><PauseCircle className="h-3 w-3 mr-1" />On Hold</Badge>;
    case "completed":
      return <Badge className="bg-blue-500/15 text-blue-600 border-blue-300/40 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
    case "cancelled":
      return <Badge className="bg-red-500/15 text-red-600 border-red-300/40 text-[10px]"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
    default:
      return <Badge className="bg-muted text-muted-foreground text-[10px]"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
  }
}

function projectTypeBadge(type: string | null) {
  switch (type) {
    case "new_construction": return <Badge className="bg-blue-500/15 text-blue-600 border-blue-300/40 text-[10px]">New Construction</Badge>;
    case "commercial": return <Badge className="bg-violet-500/15 text-violet-600 border-violet-300/40 text-[10px]">Commercial</Badge>;
    case "retrofit": return <Badge className="bg-amber-500/15 text-amber-600 border-amber-300/40 text-[10px]">Retrofit</Badge>;
    default: return null;
  }
}

export default function CrewProjectsPage() {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  const { data: projects = [], isLoading } = trpc.projects.list.useQuery();

  const filtered = projects.filter((p) => {
    if (p.status === "cancelled") return false;
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.clientName ?? "").toLowerCase().includes(q)
    );
  });

  const active = filtered.filter((p) => p.status === "active");
  const other = filtered.filter((p) => p.status !== "active");

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
            {active.length} active · {other.length} other
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
          <p className="font-medium">No projects found</p>
          {search && <p className="text-sm mt-1">Try a different search</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {active.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">Active</p>
              {active.map((project) => (
                <ProjectCard key={project.id} project={project} onClick={() => navigate(`/crew-project/${project.id}`)} />
              ))}
            </>
          )}
          {other.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1 mt-4">Other</p>
              {other.map((project) => (
                <ProjectCard key={project.id} project={project} onClick={() => navigate(`/crew-project/${project.id}`)} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onClick,
}: {
  project: { id: number; title: string; clientName?: string | null; projectType?: string | null; status: string; dueDate?: number | null };
  onClick: () => void;
}) {
  return (
    <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10 shrink-0">
            <FolderOpen className="h-5 w-5 text-violet-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold leading-tight truncate">{project.title}</p>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            </div>
            {project.clientName && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{project.clientName}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {statusBadge(project.status)}
              {projectTypeBadge(project.projectType ?? null)}
              {project.dueDate && (
                <span className="text-[10px] text-muted-foreground">
                  Due {new Date(project.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
