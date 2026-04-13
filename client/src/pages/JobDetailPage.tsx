import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatTime,
  getInitials,
  statusClass,
  statusLabel,
  type JobStatus,
} from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  Image,
  Key,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Plus,
  Send,
  Star,
  Trash2,
  Users2,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import JobFormModal from "@/components/JobFormModal";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const jobId = Number(id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [showEditForm, setShowEditForm] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteCredentials, setNoteCredentials] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [sendingSms, setSendingSms] = useState(false);

  const { data: job, isLoading } = trpc.jobs.getById.useQuery({ id: jobId });
  const { data: crewNotes } = trpc.crewNotes.getByJob.useQuery({ jobId });
  const { data: smsLog } = trpc.jobs.getSmsLog.useQuery({ jobId });
  const { data: jobPhotos } = trpc.jobPhotos.getByJob.useQuery({ jobId });

  const createNote = trpc.crewNotes.create.useMutation();
  const updateNote = trpc.crewNotes.update.useMutation();
  const deleteNote = trpc.crewNotes.delete.useMutation();
  const sendReminder = trpc.jobs.sendReminderSms.useMutation();
  const sendToClient = trpc.messaging.sendToClient.useMutation();

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Job not found.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setLocation("/calendar")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Calendar
        </Button>
      </div>
    );
  }

  const handleAddNote = async () => {
    if (!noteContent.trim()) { toast.error("Note cannot be empty."); return; }
    try {
      await createNote.mutateAsync({
        jobId,
        content: noteContent,
        credentials: noteCredentials || undefined,
      });
      setNoteContent("");
      setNoteCredentials("");
      setShowCredentials(false);
      utils.crewNotes.getByJob.invalidate({ jobId });
      toast.success("Note added.");
    } catch {
      toast.error("Failed to add note.");
    }
  };

  const handleUpdateNote = async (noteId: number) => {
    if (!editNoteContent.trim()) return;
    try {
      await updateNote.mutateAsync({ id: noteId, content: editNoteContent });
      setEditingNoteId(null);
      utils.crewNotes.getByJob.invalidate({ jobId });
      toast.success("Note updated.");
    } catch {
      toast.error("Failed to update note.");
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    try {
      await deleteNote.mutateAsync({ id: noteId });
      utils.crewNotes.getByJob.invalidate({ jobId });
      toast.success("Note deleted.");
    } catch {
      toast.error("Failed to delete note.");
    }
  };

  const handleSendToClient = async (msg: string) => {
    if (!job?.client?.phone) { toast.error("No client phone number on file."); return; }
    setSendingSms(true);
    try {
      await sendToClient.mutateAsync({ to: job.client.phone, message: msg, jobId });
      toast.success("Message sent.");
      setSmsMessage("");
    } catch {
      toast.error("Failed to send message.");
    } finally {
      setSendingSms(false);
    }
  };

  const handleSendReminder = async () => {
    try {
      await sendReminder.mutateAsync({ jobId });
      utils.jobs.getById.invalidate({ id: jobId });
      toast.success("Reminder SMS sent.");
    } catch {
      toast.error("Failed to send reminder.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => setLocation("/calendar")} className="h-8 px-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Calendar
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{job.title}</h1>
            <Badge className={`${statusClass(job.status as JobStatus)} text-xs rounded-full shrink-0`}>
              {statusLabel(job.status as JobStatus)}
            </Badge>
          </div>
          {job.client && (
            <button
              onClick={() => setLocation(`/clients/${job.client!.id}`)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors mt-1"
            >
              {job.client.name}
            </button>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowEditForm(true)} className="shrink-0">
          <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit
        </Button>
      </div>

      {/* Job details */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-medium">{formatDate(job.scheduledStart)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-sm font-medium">
                  {formatTime(job.scheduledStart)} – {formatTime(job.scheduledEnd)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDuration(job.scheduledStart, job.scheduledEnd)}
                </p>
              </div>
            </div>
          </div>

          {job.address && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  {job.address}
                </a>
              </div>
            </div>
          )}

          {/* Crew */}
          {job.assignments && job.assignments.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Users2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Assigned Crew</p>
                <div className="flex flex-wrap gap-1.5">
                  {job.assignments.map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5 bg-muted rounded-full px-2.5 py-1">
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                          {getInitials(a.crewMemberName ?? "?")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">{a.crewMemberName}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {job.description && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1.5">Description</p>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{job.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Owner instructions */}
      {job.ownerInstructions && (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-amber-400 flex items-center gap-2">
              <Bell className="h-4 w-4" /> Instructions from Owner
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{job.ownerInstructions}</p>
          </CardContent>
        </Card>
      )}

      {/* SMS Panel */}
      <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> SMS Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5">
            <div className="grid grid-cols-3 gap-2">
              <SmsStatusBadge
                label="Booking"
                sent={job.bookingSmsSent ?? false}
                icon={<Send className="h-3 w-3" />}
              />
              <SmsStatusBadge
                label="Reminder"
                sent={job.reminderSmsSent ?? false}
                icon={<Bell className="h-3 w-3" />}
              />
              <SmsStatusBadge
                label="Review"
                sent={job.reviewSmsSent ?? false}
                icon={<Star className="h-3 w-3" />}
              />
            </div>
            {!job.reminderSmsSent && job.client?.phone && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSendReminder}
                disabled={sendReminder.isPending}
                className="w-full"
              >
                {sendReminder.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Bell className="h-3.5 w-3.5 mr-1.5" />
                )}
                Send 1-Hour Reminder Now
              </Button>
            )}
            {smsLog && smsLog.length > 0 && (
              <div className="pt-2 border-t border-border space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">SMS Log</p>
                {smsLog.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{log.messageType}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={log.status === "sent" ? "secondary" : "destructive"} className="text-[10px] px-1.5 py-0">
                        {log.status}
                      </Badge>
                      <span className="text-muted-foreground/60">{formatDateTime(new Date(log.sentAt).getTime())}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      {/* In-App Messaging Panel */}
      {job.client?.phone && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" /> Message Client
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {["On my way!", "I've arrived.", "Job complete!"].map((quick) => (
                <Button
                  key={quick}
                  size="sm"
                  variant="outline"
                  className="text-xs h-8"
                  disabled={sendingSms}
                  onClick={() => handleSendToClient(quick)}
                >
                  {quick}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Custom message…"
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && smsMessage.trim() && handleSendToClient(smsMessage)}
                className="flex-1 h-9 px-3 text-sm rounded-md border border-border bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button
                size="sm"
                onClick={() => handleSendToClient(smsMessage)}
                disabled={sendingSms || !smsMessage.trim()}
                className="shrink-0"
              >
                {sendingSms ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {job.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Navigation className="h-3 w-3" /> Get directions to job site
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Job Photos */}
      {jobPhotos && jobPhotos.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" /> Job Photos ({jobPhotos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {jobPhotos.map((photo) => (
                <a
                  key={photo.id}
                  href={photo.s3Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors block"
                >
                  <img
                    src={photo.s3Url}
                    alt={photo.filename ?? "Job photo"}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Crew Notes */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Field Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          {/* Existing notes */}
          {(crewNotes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No field notes yet.</p>
          ) : (
            <div className="space-y-3">
              {crewNotes!.map((note) => (
                <div key={note.id} className="bg-muted/50 border border-border rounded-lg p-3">
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editNoteContent}
                        onChange={(e) => setEditNoteContent(e.target.value)}
                        className="bg-input border-border resize-none text-sm"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdateNote(note.id)} disabled={updateNote.isPending}>
                          {updateNote.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                              {getInitials(note.authorName ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{note.authorName}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(new Date(note.createdAt).getTime())}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.content); }}
                            className="p-1 rounded hover:bg-muted transition-colors"
                          >
                            <Edit2 className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1 rounded hover:bg-destructive/15 transition-colors"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{note.content}</p>
                      {note.credentials && (
                        <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Key className="h-3 w-3 text-amber-400" />
                            <span className="text-xs font-medium text-amber-400">Credentials</span>
                          </div>
                          <p className="text-xs text-foreground/70 font-mono">{note.credentials}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add note */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Textarea
              placeholder="Add a field note…"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="bg-input border-border resize-none text-sm"
              rows={3}
            />
            {showCredentials && (
              <Textarea
                placeholder="Client credentials (gate codes, passwords, etc.)…"
                value={noteCredentials}
                onChange={(e) => setNoteCredentials(e.target.value)}
                className="bg-input border-amber-500/30 resize-none text-sm font-mono"
                rows={2}
              />
            )}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={createNote.isPending || !noteContent.trim()}
              >
                {createNote.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                )}
                Add Note
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCredentials(!showCredentials)}
                className="text-amber-400 hover:text-amber-300"
              >
                <Key className="h-3.5 w-3.5 mr-1.5" />
                {showCredentials ? "Hide" : "Add"} Credentials
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showEditForm && (
        <JobFormModal
          open={showEditForm}
          onClose={() => setShowEditForm(false)}
          jobId={jobId}
          onSuccess={() => {
            setShowEditForm(false);
            utils.jobs.getById.invalidate({ id: jobId });
          }}
        />
      )}
    </div>
  );
}

function SmsStatusBadge({ label, sent, icon }: { label: string; sent: boolean; icon: React.ReactNode }) {
  return (
    <div className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border ${sent ? "bg-emerald-500/10 border-emerald-500/25" : "bg-muted border-border"}`}>
      <div className={sent ? "text-emerald-400" : "text-muted-foreground"}>{icon}</div>
      <span className="text-[10px] font-medium">{label}</span>
      {sent ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
      ) : (
        <span className="text-[10px] text-muted-foreground">Pending</span>
      )}
    </div>
  );
}
