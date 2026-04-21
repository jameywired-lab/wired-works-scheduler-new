import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { History, Trash2, CheckCircle, Undo2, RefreshCw, AlertTriangle } from "lucide-react";

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
  const [pendingUndo, setPendingUndo] = useState<LogEntry | null>(null);

  const { data: entries = [], isLoading, refetch } = trpc.activityLog.list.useQuery();

  const undoMutation = trpc.activityLog.undo.useMutation({
    onSuccess: (result) => {
      setPendingUndo(null);
      if (result.success) {
        toast.success(result.message, { duration: 4000 });
        refetch();
      } else {
        toast.error(result.message);
      }
    },
    onError: (err) => {
      setPendingUndo(null);
      toast.error(`Undo failed: ${err.message}`);
    },
  });

  const handleUndoRequest = (entry: LogEntry) => {
    setPendingUndo(entry);
  };

  const handleConfirmUndo = () => {
    if (pendingUndo) {
      undoMutation.mutate({ id: pendingUndo.id });
    }
  };

  const handleCancelUndo = () => {
    setPendingUndo(null);
  };

  const filtered = (entries as LogEntry[]).filter((e) => {
    if (filter === "all") return true;
    return e.action === filter;
  });

  const grouped = groupByDate(filtered);

  const isDelete = pendingUndo?.action === "delete";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* ── Page header ── */}
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

      {/* ── Loading ── */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading activity log...</div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">No activity found in the last 30 days.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Grouped entries ── */}
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
                onUndoRequest={() => handleUndoRequest(entry)}
                isUndoing={undoMutation.isPending && undoMutation.variables?.id === entry.id}
              />
            ))}
          </div>
        </div>
      ))}

      {/* ── Confirmation modal ── */}
      <Dialog open={!!pendingUndo} onOpenChange={(open) => { if (!open) handleCancelUndo(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                isDelete
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              }`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg">Confirm Undo</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed pt-1">
              {pendingUndo && (
                <>
                  You are about to restore the{" "}
                  <span className="font-semibold text-foreground">
                    {formatEntityType(pendingUndo.entityType)}
                  </span>{" "}
                  {pendingUndo.action === "delete" ? "that was deleted" : "that was marked complete"}:
                  <div className="mt-2 px-3 py-2 rounded-md bg-muted border border-border text-foreground font-medium text-sm">
                    {pendingUndo.entityLabel ?? `#${pendingUndo.entityId}`}
                  </div>
                  <div className="mt-3">
                    {pendingUndo.action === "delete"
                      ? "This will re-insert the record into the database. Any changes made after the deletion will not be affected."
                      : "This will mark the item as incomplete and restore it to its previous state."}
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 sm:gap-2 mt-2">
            <Button
              variant="outline"
              onClick={handleCancelUndo}
              disabled={undoMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUndo}
              disabled={undoMutation.isPending}
              className="flex-1 sm:flex-none gap-1.5"
            >
              <Undo2 className="h-4 w-4" />
              {undoMutation.isPending ? "Restoring..." : "Yes, Undo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivityLogCard({
  entry,
  onUndoRequest,
  isUndoing,
}: {
  entry: LogEntry;
  onUndoRequest: () => void;
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

        {/* Undo button — opens confirmation modal */}
        {!isUndone && (
          <Button
            variant="outline"
            size="sm"
            onClick={onUndoRequest}
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
