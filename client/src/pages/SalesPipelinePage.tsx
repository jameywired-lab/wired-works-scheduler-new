import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Phone, Mail, DollarSign, Bell, Pencil, Trash2, X } from "lucide-react";

type Stage = "new_lead" | "proposal_needed" | "proposal_sent" | "follow_up" | "won" | "lost";

const STAGES: { id: Stage; label: string; color: string; bg: string }[] = [
  { id: "new_lead", label: "New Lead", color: "text-sky-400", bg: "bg-sky-950/40 border-sky-800" },
  { id: "proposal_needed", label: "Proposal Needed", color: "text-amber-400", bg: "bg-amber-950/40 border-amber-800" },
  { id: "proposal_sent", label: "Proposal Sent", color: "text-violet-400", bg: "bg-violet-950/40 border-violet-800" },
  { id: "follow_up", label: "Follow-Up", color: "text-orange-400", bg: "bg-orange-950/40 border-orange-800" },
  { id: "won", label: "Won", color: "text-emerald-400", bg: "bg-emerald-950/40 border-emerald-800" },
  { id: "lost", label: "Lost", color: "text-red-400", bg: "bg-red-950/40 border-red-800" },
];

interface PipelineEntry {
  id: number;
  clientId: number | null;
  clientName: string;
  phone: string | null;
  email: string | null;
  stage: Stage;
  notes: string | null;
  estimatedValue: number | null;
  reminderAt: number | null;
  reminderNote: string | null;
  sourceFollowUpId: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface EntryFormData {
  clientName: string;
  phone: string;
  email: string;
  stage: Stage;
  notes: string;
  estimatedValue: string;
}

const emptyForm: EntryFormData = {
  clientName: "",
  phone: "",
  email: "",
  stage: "new_lead",
  notes: "",
  estimatedValue: "",
};

export default function SalesPipelinePage() {
  const utils = trpc.useUtils();

  const { data: entries = [], isLoading } = trpc.salesPipeline.list.useQuery();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<PipelineEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<PipelineEntry | null>(null);
  const [reminderEntry, setReminderEntry] = useState<PipelineEntry | null>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [form, setForm] = useState<EntryFormData>(emptyForm);

  const createMutation = trpc.salesPipeline.create.useMutation({
    onSuccess: () => {
      utils.salesPipeline.list.invalidate();
      setShowAddDialog(false);
      setForm(emptyForm);
      toast.success("Added to pipeline");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.salesPipeline.update.useMutation({
    onSuccess: () => {
      utils.salesPipeline.list.invalidate();
      setEditEntry(null);
      toast.success("Entry updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.salesPipeline.delete.useMutation({
    onSuccess: () => {
      utils.salesPipeline.list.invalidate();
      setDeleteEntry(null);
      toast.success("Entry removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const setReminderMutation = trpc.salesPipeline.setReminder.useMutation({
    onSuccess: () => {
      utils.salesPipeline.list.invalidate();
      setReminderEntry(null);
      setReminderDate("");
      setReminderNote("");
      toast.success("Reminder set — a follow-up entry has been created.");
    },
    onError: (err) => toast.error(err.message),
  });

  const stageMutation = trpc.salesPipeline.update.useMutation({
    onSuccess: () => utils.salesPipeline.list.invalidate(),
  });

  function openEdit(entry: PipelineEntry) {
    setEditEntry(entry);
    setForm({
      clientName: entry.clientName,
      phone: entry.phone ?? "",
      email: entry.email ?? "",
      stage: entry.stage,
      notes: entry.notes ?? "",
      estimatedValue: entry.estimatedValue != null ? String(entry.estimatedValue / 100) : "",
    });
  }

  function handleSave() {
    const payload = {
      clientName: form.clientName,
      phone: form.phone || undefined,
      email: form.email || undefined,
      stage: form.stage,
      notes: form.notes || undefined,
      estimatedValue: form.estimatedValue ? Math.round(parseFloat(form.estimatedValue) * 100) : undefined,
    };
    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleStageChange(id: number, stage: Stage) {
    stageMutation.mutate({ id, stage });
  }

  function handleSetReminder() {
    if (!reminderEntry || !reminderDate) return;
    setReminderMutation.mutate({
      id: reminderEntry.id,
      reminderAt: new Date(reminderDate).getTime(),
      reminderNote: reminderNote || undefined,
    });
  }

  const activeCount = entries.filter((e) => e.stage !== "won" && e.stage !== "lost").length;
  const wonCount = entries.filter((e) => e.stage === "won").length;
  const totalValue = entries
    .filter((e) => e.stage !== "lost")
    .reduce((sum, e) => sum + (e.estimatedValue ?? 0), 0);

  const dialogOpen = showAddDialog || !!editEntry;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount} active &bull; {wonCount} won &bull; Est. value:{" "}
            <span className="text-emerald-400 font-medium">
              ${(totalValue / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setShowAddDialog(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Add Lead
        </Button>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
          {STAGES.map((stage) => {
            const stageEntries = entries.filter((e) => e.stage === stage.id);
            return (
              <div key={stage.id} className={`rounded-xl border ${stage.bg} p-3 space-y-2 min-h-[120px]`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${stage.color}`}>
                    {stage.label}
                  </span>
                  <span className="text-xs text-muted-foreground bg-muted/30 rounded-full px-1.5 py-0.5">
                    {stageEntries.length}
                  </span>
                </div>
                {stageEntries.map((entry) => (
                  <PipelineCard
                    key={entry.id}
                    entry={entry as PipelineEntry}
                    onEdit={() => openEdit(entry as PipelineEntry)}
                    onDelete={() => setDeleteEntry(entry as PipelineEntry)}
                    onSetReminder={() => {
                      setReminderEntry(entry as PipelineEntry);
                      setReminderDate("");
                      setReminderNote("");
                    }}
                    onStageChange={(s) => handleStageChange(entry.id, s)}
                  />
                ))}
                {stageEntries.length === 0 && (
                  <div className="text-xs text-muted-foreground/50 text-center py-4">Empty</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); setEditEntry(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editEntry ? "Edit Pipeline Entry" : "Add to Sales Pipeline"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Client / Contact Name *</Label>
              <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 000-0000" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as Stage })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Est. Value ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimatedValue}
                  onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Details, source, context..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditEntry(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.clientName.trim() || createMutation.isPending || updateMutation.isPending}>
              {editEntry ? "Save Changes" : "Add to Pipeline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteEntry} onOpenChange={(open) => { if (!open) setDeleteEntry(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Entry?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleteEntry?.clientName}</strong> from the pipeline? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEntry(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteEntry && deleteMutation.mutate({ id: deleteEntry.id })} disabled={deleteMutation.isPending}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Reminder Dialog */}
      <Dialog open={!!reminderEntry} onOpenChange={(open) => { if (!open) setReminderEntry(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Reminder</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            A follow-up entry will be created for <strong>{reminderEntry?.clientName}</strong>.
          </p>
          <div className="space-y-3">
            <div>
              <Label>Reminder Date &amp; Time *</Label>
              <Input type="datetime-local" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={reminderNote} onChange={(e) => setReminderNote(e.target.value)} placeholder="What to follow up on..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderEntry(null)}>Cancel</Button>
            <Button onClick={handleSetReminder} disabled={!reminderDate || setReminderMutation.isPending}>
              Set Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PipelineCard({
  entry,
  onEdit,
  onDelete,
  onSetReminder,
  onStageChange,
}: {
  entry: PipelineEntry;
  onEdit: () => void;
  onDelete: () => void;
  onSetReminder: () => void;
  onStageChange: (stage: Stage) => void;
}) {
  const [showMove, setShowMove] = useState(false);

  return (
    <div className="bg-card/80 border border-border rounded-lg p-3 space-y-2 text-sm group relative">
      {/* Actions */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={onSetReminder} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-amber-400">
          <Bell className="w-3 h-3" />
        </button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-red-400">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Name */}
      <div className="font-medium text-foreground pr-16 leading-tight">{entry.clientName}</div>

      {/* Contact */}
      {entry.phone && (
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Phone className="w-3 h-3 shrink-0" />
          <span>{entry.phone}</span>
        </div>
      )}
      {entry.email && (
        <div className="flex items-center gap-1 text-muted-foreground text-xs truncate">
          <Mail className="w-3 h-3 shrink-0" />
          <span className="truncate">{entry.email}</span>
        </div>
      )}

      {/* Value */}
      {entry.estimatedValue != null && entry.estimatedValue > 0 && (
        <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
          <DollarSign className="w-3 h-3 shrink-0" />
          <span>{(entry.estimatedValue / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
        </div>
      )}

      {/* Notes */}
      {entry.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2">{entry.notes}</p>
      )}

      {/* Reminder indicator */}
      {entry.reminderAt && (
        <div className="flex items-center gap-1 text-amber-400 text-xs">
          <Bell className="w-3 h-3" />
          <span>{new Date(Number(entry.reminderAt)).toLocaleDateString()}</span>
        </div>
      )}

      {/* Move to stage */}
      <div className="pt-1">
        {showMove ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Move to:</span>
              <button onClick={() => setShowMove(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
            {STAGES.filter((s) => s.id !== entry.stage).map((s) => (
              <button
                key={s.id}
                onClick={() => { onStageChange(s.id); setShowMove(false); }}
                className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-muted/50 ${s.color}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setShowMove(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Move stage
          </button>
        )}
      </div>
    </div>
  );
}
