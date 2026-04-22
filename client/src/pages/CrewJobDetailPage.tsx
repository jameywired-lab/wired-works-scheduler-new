import { useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Users,
  Clock,
  Play,
  CheckCircle,
  Camera,
  Trash2,
  FileText,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

function formatDateTime(ts: number | Date | null | undefined) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(startMs: number, endMs: number) {
  const diffMs = endMs - startMs;
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getMapsUrl(address: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

type ScheduleJob = {
  id: number;
  title: string;
  description: string | null;
  status: string | null;
  scheduledStart: number | Date | null;
  scheduledEnd: number | Date | null;
  address: string | null;
  ownerInstructions: string | null;
  jobType: string | null;
  clientId: number | null;
  clientName: string | null;
  clientPhone: string | null;
  assignmentId: number;
  visitStartedAt: number | null;
  visitCompletedAt: number | null;
  visitNotes: string | null;
  teamMembers: { crewMemberId: number | null; name: string }[];
};

export default function CrewJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const jobId = parseInt(id ?? "0", 10);
  const [, navigate] = useLocation();

  const utils = trpc.useUtils();
  const { data: schedule = [], isLoading } = trpc.crewSchedule.mySchedule.useQuery();
  const job = (schedule as unknown as ScheduleJob[]).find((j) => j.id === jobId);

  // Visit tracking
  const startVisit = trpc.crewSchedule.startVisit.useMutation({
    onSuccess: () => {
      utils.crewSchedule.mySchedule.invalidate();
      toast.success("Visit started — timer running");
    },
    onError: () => toast.error("Failed to start visit"),
  });

  const completeVisit = trpc.crewSchedule.completeVisit.useMutation({
    onSuccess: () => {
      utils.crewSchedule.mySchedule.invalidate();
      setCompleteDialogOpen(false);
      setNotesDialogOpen(true);
      toast.success("Visit completed!");
    },
    onError: () => toast.error("Failed to complete visit"),
  });

  const updateNotes = trpc.crewSchedule.updateNotes.useMutation({
    onSuccess: () => {
      utils.crewSchedule.mySchedule.invalidate();
      toast.success("Notes saved");
    },
    onError: () => toast.error("Failed to save notes"),
  });

  // Photos
  const { data: photos = [], refetch: refetchPhotos } = trpc.crewSchedule.getPhotos.useQuery({ jobId });
  const uploadPhoto = trpc.crewSchedule.uploadPhoto.useMutation({
    onSuccess: () => {
      refetchPhotos();
      toast.success("Photo uploaded");
    },
    onError: () => toast.error("Failed to upload photo"),
  });
  const deletePhoto = trpc.crewSchedule.deletePhoto.useMutation({
    onSuccess: () => {
      refetchPhotos();
      toast.success("Photo deleted");
    },
    onError: () => toast.error("Failed to delete photo"),
  });

  // UI state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [localNotes, setLocalNotes] = useState<string>("");
  const [deletePhotoId, setDeletePhotoId] = useState<number | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenNotes = useCallback(() => {
    setLocalNotes(job?.visitNotes ?? "");
    setNotesDialogOpen(true);
  }, [job?.visitNotes]);

  const handleSaveNotes = useCallback(() => {
    if (!job) return;
    updateNotes.mutate({ assignmentId: job.assignmentId, notes: localNotes });
    setNotesDialogOpen(false);
  }, [job, localNotes, updateNotes]);

  const handleCompleteConfirm = useCallback(() => {
    if (!job) return;
    completeVisit.mutate({ assignmentId: job.assignmentId });
  }, [job, completeVisit]);

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        uploadPhoto.mutate({ jobId, dataUrl });
        setUploadingPhoto(false);
      };
      reader.onerror = () => {
        toast.error("Failed to read photo");
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingPhoto(false);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  }, [jobId, uploadPhoto]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <p className="text-muted-foreground">Job not found or not assigned to you.</p>
        <Button variant="outline" onClick={() => navigate("/crew-home")}>Back to Schedule</Button>
      </div>
    );
  }

  const startTs = job.scheduledStart ? new Date(job.scheduledStart).getTime() : null;
  const endTs = job.scheduledEnd ? new Date(job.scheduledEnd).getTime() : null;
  const isStarted = !!job.visitStartedAt;
  const isCompleted = !!job.visitCompletedAt;
  const visitDuration = job.visitStartedAt && job.visitCompletedAt
    ? formatDuration(job.visitStartedAt, job.visitCompletedAt)
    : null;

  return (
    <div className="flex flex-col pb-32">
      {/* Back header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/crew-home")} className="-ml-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base truncate">{job.title}</h1>
          {job.status && (
            <Badge variant="outline" className="text-xs mt-0.5">{job.status}</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Client info card */}
        <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Client</h2>

          {job.clientName && (
            <p className="font-semibold text-lg">{job.clientName}</p>
          )}

          {job.clientPhone && (
            <a
              href={`tel:${job.clientPhone}`}
              className="flex items-center gap-2 text-primary font-medium"
            >
              <Phone className="w-4 h-4" />
              {job.clientPhone}
            </a>
          )}

          {job.address && (
            <a
              href={getMapsUrl(job.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-primary"
            >
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm leading-snug">{job.address}</span>
              <ExternalLink className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
            </a>
          )}
        </div>

        {/* Schedule */}
        {(startTs || endTs) && (
          <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Scheduled</h2>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>
                {startTs ? formatDateTime(startTs) : ""}
                {startTs && endTs ? " – " : ""}
                {endTs ? formatDateTime(endTs) : ""}
              </span>
            </div>
          </div>
        )}

        {/* Team members */}
        {job.teamMembers.length > 0 && (
          <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Team on this job</h2>
            <div className="flex flex-wrap gap-2">
              {job.teamMembers.map((m) => (
                <div key={m.crewMemberId} className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Job description / instructions */}
        {(job.description || job.ownerInstructions) && (
          <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Instructions</h2>
            {job.description && <p className="text-sm text-muted-foreground">{job.description}</p>}
            {job.ownerInstructions && (
              <p className="text-sm mt-1 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-900 dark:text-amber-200">
                {job.ownerInstructions}
              </p>
            )}
          </div>
        )}

        {/* Visit status */}
        <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Visit Status</h2>

          {isCompleted ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                <CheckCircle className="w-5 h-5" />
                Visit Complete
              </div>
              {visitDuration && (
                <p className="text-sm text-muted-foreground">Duration: {visitDuration}</p>
              )}
              {job.visitStartedAt && (
                <p className="text-xs text-muted-foreground">
                  Started: {new Date(job.visitStartedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  {" · "}
                  Completed: {new Date(job.visitCompletedAt!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              )}
            </div>
          ) : isStarted ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-amber-600 font-semibold">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                In Progress
              </div>
              <p className="text-xs text-muted-foreground">
                Started: {new Date(job.visitStartedAt!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not started yet</p>
          )}
        </div>

        {/* Notes & Photos (visible after visit started) */}
        {(isStarted || isCompleted) && (
          <>
            {/* Notes */}
            <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Visit Notes</h2>
                <Button variant="outline" size="sm" onClick={handleOpenNotes} className="gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  {job.visitNotes ? "Edit" : "Add Notes"}
                </Button>
              </div>
              {job.visitNotes ? (
                <p className="text-sm whitespace-pre-wrap">{job.visitNotes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No notes yet — tap "Add Notes" to write something.</p>
              )}
            </div>

            {/* Photos */}
            <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Photos ({photos.length})
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto || uploadPhoto.isPending}
                  className="gap-1.5"
                >
                  {uploadingPhoto || uploadPhoto.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  Add Photo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>

              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {(photos as { id: number; s3Url: string }[]).map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden group">
                      <img
                        src={photo.s3Url}
                        alt="Job photo"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setDeletePhotoId(photo.id)}
                        className="absolute top-1 right-1 bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No photos yet — tap "Add Photo" to take or upload one.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating action buttons */}
      <div className="fixed bottom-20 left-0 right-0 px-4 flex flex-col gap-2 z-20">
        {!isStarted && !isCompleted && (
          <Button
            size="lg"
            className="w-full gap-2 shadow-lg bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => startVisit.mutate({ assignmentId: job.assignmentId })}
            disabled={startVisit.isPending}
          >
            {startVisit.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            Start Visit
          </Button>
        )}

        {isStarted && !isCompleted && (
          <Button
            size="lg"
            className="w-full gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setCompleteDialogOpen(true)}
            disabled={completeVisit.isPending}
          >
            {completeVisit.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Complete Visit
          </Button>
        )}

        {isCompleted && (
          <Button
            size="lg"
            variant="outline"
            className="w-full gap-2 shadow-lg"
            onClick={handleOpenNotes}
          >
            <FileText className="w-5 h-5" />
            {job.visitNotes ? "Edit Notes & Photos" : "Add Notes & Photos"}
          </Button>
        )}
      </div>

      {/* Complete Visit confirmation dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this visit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will record the completion time. You can still add notes and photos after completing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompleteConfirm}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Complete Visit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notes dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Visit Notes</DialogTitle>
          </DialogHeader>
          <Textarea
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            placeholder="Describe what was done, any issues found, materials used..."
            className="min-h-[160px] resize-none"
            autoFocus
          />
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSaveNotes} disabled={updateNotes.isPending} className="w-full sm:w-auto">
              {updateNotes.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete photo confirmation */}
      <AlertDialog open={deletePhotoId !== null} onOpenChange={(open) => { if (!open) setDeletePhotoId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletePhotoId !== null) deletePhoto.mutate({ photoId: deletePhotoId });
                setDeletePhotoId(null);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
