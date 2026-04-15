import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Phone,
  Plus,
  Send,
  Truck,
  UserCheck,
  Wrench,
  Clock,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type FollowUp = {
  id: number;
  contactName?: string | null;
  phone?: string | null;
  type: string;
  note?: string | null;
  isFollowedUp: boolean;
  contactedAt?: number | null;
  clientId?: number | null;
  proposalStatus: string;
  proposalSentAt?: number | null;
  isUrgent: boolean;
  urgentAt?: number | null;
  remindAt?: number | null;
  clientContacted: boolean;
  createdAt: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sourceLabel(type: string) {
  switch (type) {
    case "text": return "SMS";
    case "call": return "Call";
    case "closeout": return "Close-Out";
    case "proposal": return "Proposal";
    case "inventory": return "Inventory";
    default: return "Manual";
  }
}

function sourceBadge(type: string) {
  const base = "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded";
  switch (type) {
    case "text": return <span className={`${base} bg-blue-500/20 text-blue-300`}><MessageSquare className="inline h-2.5 w-2.5 mr-0.5" />SMS</span>;
    case "call": return <span className={`${base} bg-violet-500/20 text-violet-300`}><Phone className="inline h-2.5 w-2.5 mr-0.5" />Call</span>;
    case "closeout": return <span className={`${base} bg-amber-500/20 text-amber-300`}><Wrench className="inline h-2.5 w-2.5 mr-0.5" />Close-Out</span>;
    case "proposal": return <span className={`${base} bg-emerald-500/20 text-emerald-300`}><CheckCircle2 className="inline h-2.5 w-2.5 mr-0.5" />Proposal</span>;
    case "inventory": return <span className={`${base} bg-orange-500/20 text-orange-400`}><Truck className="inline h-2.5 w-2.5 mr-0.5" />Inventory</span>;
    default: return <span className={`${base} bg-zinc-500/20 text-zinc-400`}>Manual</span>;
  }
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isSnoozeActive(remindAt?: number | null) {
  return !!remindAt && remindAt > Date.now();
}

// ─── Follow-Up Card ───────────────────────────────────────────────────────────

function FollowUpCard({ f, onRefresh }: { f: FollowUp; onRefresh: () => void }) {
  const utils = trpc.useUtils();

  const complete = trpc.followUps.completeTask.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); toast.success("Follow-up completed"); },
  });
  const deleteFollowUp = trpc.followUps.delete.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); toast.success("Follow-up deleted"); },
    onError: (err) => toast.error(err.message ?? "Failed to delete"),
  });
  const remindTomorrow = trpc.followUps.remindTomorrow.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); toast.success("Reminder set for tomorrow"); },
  });
  const markContacted = trpc.followUps.markClientContacted.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); toast.success("Marked as client contacted — moved to top"); },
  });
  const sendProposal = trpc.followUps.sendProposal.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); toast.success("Proposal sent — follow-up in 24h"); },
  });
  const [showProposalActions, setShowProposalActions] = useState(false);
  const resolveProposal = trpc.followUps.resolveProposal.useMutation({
    onSuccess: (_, vars) => {
      utils.followUps.list.invalidate();
      if (vars.outcome === "accepted") toast.success("Project created from proposal!");
      else toast.success("Follow-up resolved");
    },
  });
  const [projectTitle, setProjectTitle] = useState("");
  const [showProjectDialog, setShowProjectDialog] = useState(false);

  // SMS Reply
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const sendSms = trpc.communications.sendSms.useMutation({
    onSuccess: () => {
      toast.success("Message sent");
      setReplyText("");
      setShowReply(false);
    },
    onError: (err) => toast.error(err.message ?? "Failed to send"),
  });

  const snoozed = isSnoozeActive(f.remindAt);
  const isProposal = f.type === "proposal" || f.proposalStatus !== "none";
  const proposalPending = f.proposalStatus === "pending";

  const cardClass = [
    "border rounded-lg p-4 transition-all",
    f.clientContacted
      ? "border-cyan-500/60 bg-cyan-950/30"
      : f.isUrgent
      ? "border-red-500/60 bg-red-950/30"
      : snoozed
      ? "border-zinc-700/40 bg-zinc-900/40 opacity-60"
      : "border-zinc-700/50 bg-zinc-900/50",
  ].join(" ");

  return (
    <>
      <div className={cardClass}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {f.clientContacted && (
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]">
                <UserCheck className="h-2.5 w-2.5 mr-1" />Contacted
              </Badge>
            )}
            {f.isUrgent && !f.clientContacted && (
              <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px]">
                <AlertTriangle className="h-2.5 w-2.5 mr-1" />URGENT
              </Badge>
            )}
            {snoozed && (
              <Badge className="bg-zinc-600/30 text-zinc-400 border-zinc-600/40 text-[10px]">
                <Clock className="h-2.5 w-2.5 mr-1" />Snoozed
              </Badge>
            )}
            {sourceBadge(f.type)}
            <span className="font-semibold text-sm text-foreground truncate">
              {f.contactName || "Unknown Caller"}
            </span>
            {f.phone && (
              <span className="text-xs text-muted-foreground">{f.phone}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {timeAgo(new Date(f.createdAt).getTime())}
          </span>
        </div>

        {/* Note */}
        {f.note && (
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{f.note}</p>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Complete */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-emerald-600/50 text-emerald-400 hover:bg-emerald-950/50"
            onClick={() => complete.mutate({ id: f.id })}
            disabled={complete.isPending}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />Complete
          </Button>

          {/* Remind Me Tomorrow */}
          {!snoozed && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-zinc-600/50 text-zinc-300 hover:bg-zinc-800/50"
              onClick={() => remindTomorrow.mutate({ id: f.id })}
              disabled={remindTomorrow.isPending}
            >
              <Bell className="h-3 w-3 mr-1" />Remind Tomorrow
            </Button>
          )}

          {/* Client Contacted */}
          {!f.clientContacted && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-cyan-600/50 text-cyan-400 hover:bg-cyan-950/50"
              onClick={() => markContacted.mutate({ id: f.id })}
              disabled={markContacted.isPending}
            >
              <UserCheck className="h-3 w-3 mr-1" />Client Contacted
            </Button>
          )}

          {/* SMS Reply button — show when follow-up has a phone number */}
          {f.phone && (f.type === "text" || f.type === "call") && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-teal-600/50 text-teal-400 hover:bg-teal-950/50"
              onClick={() => setShowReply(!showReply)}
            >
              <MessageSquare className="h-3 w-3 mr-1" />{showReply ? "Cancel" : "Reply"}
            </Button>
          )}

          {/* Proposal actions */}
          {isProposal && !proposalPending && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-emerald-600/50 text-emerald-400 hover:bg-emerald-950/50"
              onClick={() => sendProposal.mutate({ id: f.id })}
              disabled={sendProposal.isPending}
            >
              Proposal Sent — Follow Up in 24h
            </Button>
          )}

          {proposalPending && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-violet-600/50 text-violet-300 hover:bg-violet-950/50"
              onClick={() => setShowProposalActions(!showProposalActions)}
            >
              Proposal Outcome {showProposalActions ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
            </Button>
          )}

          {/* Delete — always visible */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-red-600/50 text-red-400 hover:bg-red-950/50 ml-auto"
            onClick={() => deleteFollowUp.mutate({ id: f.id })}
            disabled={deleteFollowUp.isPending}
          >
            <X className="h-3 w-3 mr-1" />Delete
          </Button>
        </div>

        {/* Inline SMS reply composer */}
        {showReply && f.phone && (
          <div className="mt-3 border border-teal-600/30 rounded-md p-3 bg-teal-950/20 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-teal-400 font-medium">Reply to {f.contactName || f.phone}</span>
              <button onClick={() => setShowReply(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Textarea
              placeholder="Type your message…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="min-h-[70px] text-sm bg-zinc-900/60 border-zinc-700 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && replyText.trim()) {
                  sendSms.mutate({ to: f.phone!, body: replyText.trim(), clientId: f.clientId ?? undefined });
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                disabled={!replyText.trim() || sendSms.isPending}
                onClick={() => sendSms.mutate({ to: f.phone!, body: replyText.trim(), clientId: f.clientId ?? undefined })}
              >
                <Send className="h-3 w-3 mr-1" />{sendSms.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        )}

        {/* Proposal outcome sub-buttons */}
        {proposalPending && showProposalActions && (
          <div className="flex flex-wrap gap-2 mt-2 pl-1 border-l-2 border-violet-600/40">
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setShowProjectDialog(true)}
            >
              Client Accepted
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-red-600/50 text-red-400 hover:bg-red-950/50"
              onClick={() => resolveProposal.mutate({ id: f.id, outcome: "declined" })}
              disabled={resolveProposal.isPending}
            >
              Client Declined
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-zinc-600/50 text-zinc-300 hover:bg-zinc-800/50"
              onClick={() => resolveProposal.mutate({ id: f.id, outcome: "not_ready" })}
              disabled={resolveProposal.isPending}
            >
              Not Ready Yet
            </Button>
          </div>
        )}
      </div>

      {/* Create project dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Project title"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProjectDialog(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!projectTitle.trim() || resolveProposal.isPending}
              onClick={() => {
                resolveProposal.mutate({
                  id: f.id,
                  outcome: "accepted",
                  projectTitle: projectTitle.trim(),
                  projectClientId: f.clientId as number | undefined,
                });
                setShowProjectDialog(false);
                setProjectTitle("");
              }}
            >
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Add Follow-Up Dialog ─────────────────────────────────────────────────────

function AddFollowUpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ contactName: "", phone: "", note: "", type: "manual" });
  const create = trpc.followUps.create.useMutation({
    onSuccess: () => {
      utils.followUps.list.invalidate();
      toast.success("Follow-up added");
      setForm({ contactName: "", phone: "", note: "", type: "manual" });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Follow-Up</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input
            placeholder="Contact name"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          />
          <Input
            placeholder="Phone number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="text">SMS</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Note (optional)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate({ ...form, type: form.type as "call" | "text" | "manual" })}
            disabled={create.isPending}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FollowUpPage() {
  const { data: allFollowUps = [], isLoading } = trpc.followUps.list.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;
  const markUrgent = trpc.followUps.markUrgent.useMutation({
    onSuccess: () => utils.followUps.list.invalidate(),
  });

  // Auto-mark urgent proposals past 24h
  useEffect(() => {
    const now = Date.now();
    allFollowUps.forEach((f) => {
      if (
        !f.isFollowedUp &&
        f.type === "proposal" &&
        f.proposalStatus === "pending" &&
        f.proposalSentAt &&
        now - f.proposalSentAt > TWENTY_FOUR_H &&
        !f.isUrgent
      ) {
        markUrgent.mutate({ id: f.id });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFollowUps]);

  const now = Date.now();

  // Active = not completed and not snoozed (or snooze expired)
  const active = allFollowUps
    .filter((f) => !f.isFollowedUp && (!f.remindAt || f.remindAt <= now))
    .sort((a, b) => {
      // 1. Client Contacted first
      if (a.clientContacted && !b.clientContacted) return -1;
      if (!a.clientContacted && b.clientContacted) return 1;
      // 2. Urgent next
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      // 3. Newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Snoozed = remindAt in the future
  const snoozed = allFollowUps.filter((f) => !f.isFollowedUp && f.remindAt && f.remindAt > now);

  // Done
  const done = allFollowUps.filter((f) => f.isFollowedUp);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Follow-Ups</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {active.length} active{snoozed.length > 0 ? `, ${snoozed.length} snoozed` : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" />Add
        </Button>
      </div>

      {/* Active list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <Card className="border-zinc-700/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No active follow-ups</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {active.map((f) => (
            <FollowUpCard key={f.id} f={f as FollowUp} onRefresh={() => utils.followUps.list.invalidate()} />
          ))}
        </div>
      )}

      {/* Snoozed section */}
      {snoozed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />Snoozed ({snoozed.length})
          </h2>
          <div className="space-y-2">
            {snoozed.map((f) => (
              <FollowUpCard key={f.id} f={f as FollowUp} onRefresh={() => utils.followUps.list.invalidate()} />
            ))}
          </div>
        </div>
      )}

      {/* Done section (collapsible) */}
      {done.length > 0 && (
        <div className="space-y-2">
          <button
            className="flex items-center gap-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
            onClick={() => setShowDone(!showDone)}
          >
            {showDone ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Completed ({done.length})
          </button>
          {showDone && (
            <div className="space-y-2">
              {done.slice(0, 20).map((f) => (
                <div key={f.id} className="border border-zinc-800/50 rounded-lg p-3 opacity-50">
                  <div className="flex items-center gap-2">
                    {sourceBadge(f.type)}
                    <span className="text-sm text-muted-foreground">{f.contactName || "Unknown"}</span>
                    {f.phone && <span className="text-xs text-muted-foreground">{f.phone}</span>}
                    <span className="text-xs text-muted-foreground ml-auto">{timeAgo(new Date(f.createdAt).getTime())}</span>
                  </div>
                  {f.note && <p className="text-xs text-muted-foreground mt-1 truncate">{f.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AddFollowUpDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
