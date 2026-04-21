import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { History, Trash2, CheckCircle, Undo2, RefreshCw } from "lucide-react";

type ActionFilter = "all" | "delete" | "complete";

type LogEntry = {
  id: number;
  action: "delete" | "complete" | "update";
  entityType: string;
  entityId: number;
  entityLabel: string | null;
  performedAt: Date;
  undoneAt: Date | null;
};

function formatEntityType(type: string): string {
  switch (type) {
    case "client": return "Client";
    case "job": return "Job";
    case "followUp": return "Follow-Up";
    case "crewMember": return "Crew Member";
    case "tag": return "Tag";
    case "clientTag": return "Client Tag";
    default: return type;
  }
}

function groupByDate(entries: LogEntry[]): { dateLabel: string; entries: LogEntry[] }[] {
  const groups: Map<string, LogEntry[]> = new Map();
  for (const entry of entries) {
    const d = new Date(entry.performedAt);
    const label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entry);
  }
  return Array.from(groups.entries()).map(([dateLabel, entries]) => ({ dateLabel, entries }));
}

export default function ActivityLogPage() {
  const [filter, setFilter] = useState<ActionFilter>("all");
  const { data: entries = [], isLoading, refetch } = trpc.activityLog.list.useQuery();
  const undoMutation = trpc.activityLog.undo.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message, { duration: 4000 });
        refetch();
      } else {
        toast.error(result.message);
      }
    },
    onError: (err) => {
      toast.error(`Undo failed: ${err.message}`);
    },
  });

  const filtered = (entries as LogEntry[]).filter((e) => {
    if (filter === "all") return true;
    return e.action === filter;
  });

  const grouped = groupByDate(filtered);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
            <p className="text-sm text-muted-foreground">Last 30 days of deletes and completions — click Undo to restore</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as ActionFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="delete">Deletes Only</SelectItem>
              <SelectItem value="complete">Completions Only</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading activity log...</div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">No activity found in the last 30 days.</p>
          </CardContent>
        </Card>
      )}

      {grouped.map(({ dateLabel, entries: dayEntries }) => (
        <div key={dateLabel} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">{dateLabel}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            {dayEntries.map((entry) => (
              <ActivityLogCard
                key={entry.id}
                entry={entry}
                onUndo={() => undoMutation.mutate({ id: entry.id })}
                isUndoing={undoMutation.isPending && undoMutation.variables?.id === entry.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityLogCard({
  entry,
  onUndo,
  isUndoing,
}: {
  entry: LogEntry;
  onUndo: () => void;
  isUndoing: boolean;
}) {
  const isDelete = entry.action === "delete";
  const isComplete = entry.action === "complete";
  const isUndone = !!entry.undoneAt;

  const time = new Date(entry.performedAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <Card className={`transition-opacity ${isUndone ? "opacity-50" : ""}`}>
      <CardContent className="py-3 px-4 flex items-center gap-3">
        {/* Action icon */}
        <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
          isDelete ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
          isComplete ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
          "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        }`}>
          {isDelete ? <Trash2 className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs shrink-0">
              {formatEntityType(entry.entityType)}
            </Badge>
            <span className="font-medium text-sm text-foreground truncate">
              {entry.entityLabel ?? `#${entry.entityId}`}
            </span>
            {isUndone && (
              <Badge variant="secondary" className="text-xs shrink-0">Restored</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground capitalize">{entry.action}d</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
        </div>

        {/* Undo button */}
        {!isUndone && (
          <Button
            variant="outline"
            size="sm"
            onClick={onUndo}
            disabled={isUndoing}
            className="shrink-0 gap-1.5"
          >
            <Undo2 className="h-3.5 w-3.5" />
            {isUndoing ? "Restoring..." : "Undo"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
