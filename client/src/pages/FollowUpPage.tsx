import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
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
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Image,
  Link,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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
  messageCount: number;
  messages?: string | null;
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
  const [, navigate] = useLocation();

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
  const [replyMediaUrls, setReplyMediaUrls] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const uploadMedia = trpc.communications.uploadMedia.useMutation();
  const sendSms = trpc.communications.sendSms.useMutation({
    onSuccess: () => {
      toast.success("Message sent");
      setReplyText("");
      setReplyMediaUrls([]);
      setLinkInput("");
      setShowLinkInput(false);
      setShowReply(false);
    },
    onError: (err) => toast.error(err.message ?? "Failed to send"),
  });

  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large (max 5 MB)"); return; }
    setUploadingMedia(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await uploadMedia.mutateAsync({ fileBase64: base64, mimeType: file.type, fileName: file.name });
        setReplyMediaUrls(prev => [...prev, result.url]);
        toast.success("Photo attached");
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingMedia(false);
    }
  }

  function handleAddLink() {
    if (!linkInput.trim()) return;
    const url = linkInput.trim().startsWith("http") ? linkInput.trim() : `https://${linkInput.trim()}`;
    setReplyMediaUrls(prev => [...prev, url]);
    setLinkInput("");
    setShowLinkInput(false);
  }

  const snoozed = isSnoozeActive(f.remindAt);
  const isProposal = f.type === "proposal" || f.proposalStatus !== "none";
  const proposalPending = f.proposalStatus === "pending";

  const cardClass = [
    "border rounded-xl p-4 transition-all shadow-sm",
    f.clientContacted
      ? "border-cyan-500/40 bg-card"
      : f.isUrgent
      ? "border-red-500/40 bg-card"
      : snoozed
      ? "border-border/40 bg-card opacity-60"
      : "border-border bg-card",
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
            {/* Clickable client name — navigates to client communications */}
            {f.clientId ? (
              <button
                className="font-semibold text-sm text-foreground truncate hover:text-teal-400 hover:underline transition-colors cursor-pointer"
                onClick={() => navigate(`/clients/${f.clientId}?tab=communications`)}
                title="View client communications"
              >
                {f.contactName || "Unknown Caller"}
              </button>
            ) : (
              <span className="font-semibold text-sm text-foreground truncate">
                {f.contactName || "Unknown Caller"}
              </span>
            )}
            {f.phone && (
              <span className="text-xs text-muted-foreground">{f.phone}</span>
            )}
            {/* Message count badge for grouped texts */}
            {f.type === "text" && f.messageCount > 1 && (
              <span className="inline-flex items-center gap-1 bg-teal-600/20 text-teal-400 border border-teal-600/30 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                <MessageSquare className="h-2.5 w-2.5" />{f.messageCount} messages
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {timeAgo(new Date(f.createdAt).getTime())}
          </span>
        </div>
        {/* Grouped messages display for texts */}
        {f.type === "text" && f.messages ? (
          <div className="mb-3 space-y-1.5">
            {(() => {
              try {
                const msgs: { body: string; receivedAt: number }[] = JSON.parse(f.messages);
                return msgs.map((m, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5 shrink-0">
                      {new Date(m.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <p className="text-sm text-foreground leading-snug">{m.body}</p>
                  </div>
                ));
              } catch { return null; }
            })()}
          </div>
        ) : f.note ? (
          <p className="text-sm text-foreground mb-3 leading-relaxed">
            {f.note.replace(/^📱 Inbound SMS(?: \(\d+ messages\))?: /, "")}
          </p>
        ) : null}

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

          {/* SMS Reply button — prominent teal button for text follow-ups */}
          {f.phone && (
            <Button
              size="sm"
              className={showReply
                ? "h-8 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-3"
                : "h-8 text-xs bg-teal-600 hover:bg-teal-500 text-white font-semibold px-3 shadow-sm"
              }
              onClick={() => setShowReply(!showReply)}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />{showReply ? "Cancel Reply" : "Reply via Text"}
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
          <div className="mt-3 border border-teal-600/30 rounded-xl p-3 bg-white space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-teal-700 font-medium">Reply to {f.contactName || f.phone}</span>
              <button onClick={() => { setShowReply(false); setReplyMediaUrls([]); setShowLinkInput(false); }} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Textarea
              placeholder="Type your message…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="min-h-[70px] text-sm text-gray-900 bg-white border-gray-300 resize-none placeholder:text-gray-400"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && (replyText.trim() || replyMediaUrls.length > 0)) {
                  sendSms.mutate({ to: f.phone!, body: replyText.trim() || " ", clientId: f.clientId ?? undefined, mediaUrls: replyMediaUrls.length > 0 ? replyMediaUrls : undefined });
                }
              }}
            />

            {/* Attached media / links preview */}
            {replyMediaUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {replyMediaUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-1 bg-zinc-800 rounded px-2 py-1 text-xs text-zinc-300">
                    {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img src={url} alt="attachment" className="h-8 w-8 object-cover rounded" />
                    ) : (
                      <Link className="h-3 w-3 text-blue-400" />
                    )}
                    <span className="max-w-[120px] truncate">{url.split("/").pop()}</span>
                    <button onClick={() => setReplyMediaUrls(prev => prev.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-red-400 ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Link input */}
            {showLinkInput && (
              <div className="flex gap-2">
                <Input
                  placeholder="Paste a URL…"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="h-7 text-xs text-gray-900 bg-white border-gray-300 placeholder:text-gray-400"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddLink(); }}
                />
                <Button size="sm" className="h-7 text-xs" onClick={handleAddLink}>Add</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowLinkInput(false)}>Cancel</Button>
              </div>
            )}

            <div className="flex items-center justify-between">
              {/* Attachment buttons */}
              <div className="flex gap-1">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} disabled={uploadingMedia} />
                  <span className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded border border-zinc-600/50 text-zinc-400 hover:bg-zinc-800 cursor-pointer">
                    <Image className="h-3 w-3" />{uploadingMedia ? "Uploading…" : "Photo"}
                  </span>
                </label>
                <Button size="sm" variant="outline" className="h-7 text-xs border-zinc-600/50 text-zinc-400" onClick={() => setShowLinkInput(!showLinkInput)}>
                  <Link className="h-3 w-3 mr-1" />Link
                </Button>
              </div>
              <Button
                size="sm"
                className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                disabled={(!replyText.trim() && replyMediaUrls.length === 0) || sendSms.isPending}
                onClick={() => sendSms.mutate({ to: f.phone!, body: replyText.trim() || " ", clientId: f.clientId ?? undefined, mediaUrls: replyMediaUrls.length > 0 ? replyMediaUrls : undefined })}
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
  const [form, setForm] = useState({ contactName: "", phone: "", email: "", note: "", type: "manual" });
  const [clientId, setClientId] = useState<number | undefined>(undefined);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { data: allClients = [] } = trpc.clients.list.useQuery();

  const create = trpc.followUps.create.useMutation({
    onSuccess: () => {
      utils.followUps.list.invalidate();
      toast.success("Follow-up added");
      setForm({ contactName: "", phone: "", email: "", note: "", type: "manual" });
      setClientId(undefined);
      setDropdownOpen(false);
      onClose();
    },
  });

  const filteredClients = allClients.filter((c) =>
    form.contactName.trim() === "" ||
    c.name.toLowerCase().includes(form.contactName.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Follow-Up</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Client inline typeahead */}
          <div className="relative">
            <Input
              placeholder="Type a contact name…"
              value={form.contactName}
              onChange={(e) => {
                setForm((f) => ({ ...f, contactName: e.target.value, phone: "", email: "" }));
                setClientId(undefined);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              autoComplete="off"
            />
            {dropdownOpen && filteredClients.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {filteredClients.slice(0, 25).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setForm((f) => ({ ...f, contactName: c.name, phone: c.phone ?? "", email: c.email ?? "" }));
                      setClientId(c.id);
                      setDropdownOpen(false);
                    }}
                  >
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    {(c.phone || c.email) && (
                      <p className="text-xs text-muted-foreground">
                        {[c.phone, c.email].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              placeholder="Email (optional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

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
            onClick={() => create.mutate({
              contactName: form.contactName || undefined,
              phone: form.phone || undefined,
              email: form.email || undefined,
              clientId,
              note: form.note || undefined,
              type: form.type as "call" | "text" | "manual",
            })}
            disabled={!form.contactName.trim() || create.isPending}
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
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
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
        <Card className="border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No active follow-ups</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
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
          <div className="space-y-4">
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
                <div key={f.id} className="border border-border/50 rounded-xl p-3 bg-card opacity-60">
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
