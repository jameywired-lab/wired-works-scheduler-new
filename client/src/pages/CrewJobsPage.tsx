import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Briefcase,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  User,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE_MB = 10;

type PhotoPreview = {
  file: File;
  previewUrl: string;
  base64: string;
};

function statusColor(status: string) {
  switch (status) {
    case "scheduled": return "bg-blue-500/10 text-blue-600 border-blue-200";
    case "in_progress": return "bg-amber-500/10 text-amber-600 border-amber-200";
    case "completed": return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    case "cancelled": return "bg-red-500/10 text-red-600 border-red-200";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function CrewJobsPage() {
  const utils = trpc.useUtils();
  const { data: jobs = [], isLoading } = trpc.jobs.list.useQuery();
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [closeOutJob, setCloseOutJob] = useState<(typeof jobs)[0] | null>(null);
  const [smsJob, setSmsJob] = useState<(typeof jobs)[0] | null>(null);

  // Close-out state
  const [fieldNote, setFieldNote] = useState("");
  const [credentials, setCredentials] = useState("");
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SMS state
  const [smsMessage, setSmsMessage] = useState("");

  const updateJob = trpc.jobs.update.useMutation({
    onSuccess: () => utils.jobs.list.invalidate(),
  });
  const addCrewNote = trpc.crewNotes.create.useMutation({
    onSuccess: () => utils.crewNotes.getByJob.invalidate(),
  });
  const uploadPhoto = trpc.jobPhotos.upload.useMutation();
  const sendSms = trpc.messaging.sendToClient.useMutation();

  // Filter to only active/upcoming jobs (not cancelled)
  const activeJobs = jobs.filter((j) => j.status !== "cancelled");

  // Today's jobs summary
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayJobs = activeJobs.filter((j) => {
    if (!j.scheduledStart) return false;
    const t = j.scheduledStart;
    return t >= todayStart.getTime() && t <= todayEnd.getTime();
  });
  const todayCompleted = todayJobs.filter((j) => j.status === "completed").length;
  const todayRemaining = todayJobs.filter((j) => j.status !== "completed").length;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = files.slice(0, remaining);

    const newPreviews: PhotoPreview[] = [];
    for (const file of toAdd) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit`);
        continue;
      }
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // strip data URL prefix
        };
        reader.readAsDataURL(file);
      });
      const previewUrl = URL.createObjectURL(file);
      newPreviews.push({ file, previewUrl, base64 });
    }
    setPhotos((prev) => [...prev, ...newPreviews]);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleCloseOut = async () => {
    if (!closeOutJob) return;
    setIsSubmitting(true);
    try {
      // 1. Add crew note if provided
      if (fieldNote.trim()) {
        await addCrewNote.mutateAsync({
          jobId: closeOutJob.id,
          content: fieldNote.trim(),
          credentials: credentials.trim() || undefined,
        });
      }

      // 2. Upload photos sequentially
      for (const photo of photos) {
        await uploadPhoto.mutateAsync({
          jobId: closeOutJob.id,
          filename: photo.file.name,
          mimeType: photo.file.type,
          base64Data: photo.base64,
          sizeBytes: photo.file.size,
        });
      }

      // 3. Mark job as completed
      await updateJob.mutateAsync({
        id: closeOutJob.id,
        status: "completed",
      });

      toast.success("Job closed out successfully");
      setCloseOutJob(null);
      setFieldNote("");
      setCredentials("");
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPhotos([]);
    } catch (err) {
      toast.error("Failed to close out job. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendSms = async (quickMsg?: string) => {
    if (!smsJob) return;
    const msg = quickMsg ?? smsMessage.trim();
    if (!msg) return;
    const phone = smsJob.clientPhone ?? "";
    if (!phone) {
      toast.error("No phone number on file for this client");
      return;
    }
    try {
      await sendSms.mutateAsync({ to: phone, message: msg, jobId: smsJob.id });
      toast.success("Message sent");
      setSmsMessage("");
      if (!quickMsg) setSmsJob(null);
    } catch {
      toast.error("Failed to send message");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Jobs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeJobs.length} active job{activeJobs.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Today's summary card */}
      {todayJobs.length > 0 && (
        <div className="bg-gradient-to-r from-teal-900/40 to-teal-800/20 border border-teal-700/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-teal-400 font-medium uppercase tracking-wide">Today</p>
              <p className="text-lg font-bold mt-0.5">
                {todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""} scheduled
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-teal-400">{todayCompleted}/{todayJobs.length}</p>
              <p className="text-xs text-muted-foreground">completed</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-teal-950/60 rounded-full h-2">
            <div
              className="bg-teal-500 h-2 rounded-full transition-all"
              style={{ width: `${todayJobs.length > 0 ? (todayCompleted / todayJobs.length) * 100 : 0}%` }}
            />
          </div>
          {/* List today's jobs */}
          <div className="space-y-1.5">
            {todayJobs.map((j) => (
              <div key={j.id} className="flex items-center gap-2 text-sm">
                <span className={`h-2 w-2 rounded-full shrink-0 ${j.status === "completed" ? "bg-teal-500" : j.status === "in_progress" ? "bg-amber-400" : "bg-zinc-500"}`} />
                <span className={`flex-1 truncate ${j.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{j.title}</span>
                {j.scheduledStart && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(j.scheduledStart).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
              </div>
            ))}
          </div>
          {todayRemaining === 0 && todayJobs.length > 0 && (
            <p className="text-xs text-teal-400 font-medium text-center">All done for today!</p>
          )}
        </div>
      )}

      {activeJobs.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No jobs assigned to you yet.</p>
          </CardContent>
        </Card>
      )}

      {activeJobs.map((job) => {
        const isExpanded = expandedJob === job.id;
        const scheduledDate = job.scheduledStart ? new Date(job.scheduledStart) : null;

        return (
          <Card key={job.id} className="overflow-hidden transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base font-semibold truncate">{job.title}</CardTitle>
                    <Badge variant="outline" className={`text-xs ${statusColor(job.status ?? "scheduled")}`}>
                      {(job.status ?? "scheduled").replace("_", " ")}
                    </Badge>
                  </div>
                  {job.clientName && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <User className="h-3 w-3" /> {job.clientName}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {scheduledDate && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                  <Clock className="h-3 w-3" />
                  {format(scheduledDate, "EEE, MMM d · h:mm a")}
                </div>
              )}
              {job.address && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{job.address}</span>
                </div>
              )}
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 space-y-4">
                {job.description && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Instructions from Owner
                    </p>
                    <p className="text-sm">{job.description}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {job.address && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address ?? "")}`,
                          "_blank"
                        )
                      }
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Directions
                    </Button>
                  )}
                  {job.clientPhone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setSmsJob(job)}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Text Client
                    </Button>
                  )}
                  {job.clientPhone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => window.open(`tel:${job.clientPhone}`, "_self")}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Call Client
                    </Button>
                  )}
                  {job.status !== "completed" && (
                    <Button
                      size="sm"
                      className="gap-1.5 col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setCloseOutJob(job)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Close Out Job
                    </Button>
                  )}
                </div>

                {/* Client Credentials */}
                {job.clientId && (
                  <CrewClientCredentials clientId={job.clientId} />
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* ── Close-Out Dialog ── */}
      <Dialog open={!!closeOutJob} onOpenChange={(o) => { if (!o) { setCloseOutJob(null); setFieldNote(""); setCredentials(""); photos.forEach(p => URL.revokeObjectURL(p.previewUrl)); setPhotos([]); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Close Out: {closeOutJob?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Field Notes</Label>
              <Textarea
                placeholder="Describe what was done, any issues found, materials used..."
                value={fieldNote}
                onChange={(e) => setFieldNote(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Client Credentials / Access Codes</Label>
              <Input
                placeholder="Gate code, alarm code, lockbox combination..."
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Stored securely in job notes, visible only to the team.</p>
            </div>

            {/* Photo upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Photos ({photos.length}/{MAX_PHOTOS})</Label>
                {photos.length < MAX_PHOTOS && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Add Photos
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoSelect}
              />
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                      <img
                        src={p.previewUrl}
                        alt={p.file.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length === 0 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Tap to add up to {MAX_PHOTOS} photos</p>
                </button>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloseOutJob(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={handleCloseOut}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Complete Job</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SMS Dialog ── */}
      <Dialog open={!!smsJob} onOpenChange={(o) => { if (!o) { setSmsJob(null); setSmsMessage(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Text {smsJob?.clientName ?? "Client"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Quick messages */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Quick Messages</Label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  "Hi! I'm on my way to your location. ETA ~15 minutes.",
                  "Hi! I'm on my way. ETA ~30 minutes.",
                  "Hi! I've arrived and am getting started.",
                  "Hi! We've finished the job. Have a great day!",
                ].map((msg) => (
                  <button
                    key={msg}
                    onClick={() => handleSendSms(msg)}
                    disabled={sendSms.isPending}
                    className="text-left text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or custom</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Textarea
                placeholder="Type a custom message..."
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSmsJob(null)}>Cancel</Button>
            <Button
              onClick={() => handleSendSms()}
              disabled={!smsMessage.trim() || sendSms.isPending}
              className="gap-1.5"
            >
              {sendSms.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Crew Client Credentials ──────────────────────────────────────────────────
function CrewClientCredentials({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const { data: creds = [], isLoading } = trpc.clientCredentials.list.useQuery({ clientId });
  const [collapsed, setCollapsed] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const isSensitive = (key: string) =>
    ["wifi_password", "sonos_password", "ring_password", "smart_hub_pin", "gate_code", "alarm_code"].includes(key);

  const toggleVisible = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const filledCreds = creds.filter((c) => (c.value ?? "").trim().length > 0);

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="text-base">🔑</span>
          Client Credentials
          {filledCreds.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({filledCreds.length} saved)
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{collapsed ? "Show" : "Hide"}</span>
      </button>
      {!collapsed && (
        <div className="px-3 pb-3 space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-2">Loading...</p>
          ) : filledCreds.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No credentials saved for this client yet.</p>
          ) : (
            filledCreds.map((cred) => {
              const sensitive = isSensitive(cred.key);
              const visible = visibleKeys.has(cred.key);
              return (
                <div key={cred.key} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground shrink-0 w-36">{cred.label}</span>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-xs font-mono bg-background border border-border rounded px-2 py-1 flex-1 truncate">
                      {sensitive && !visible ? "••••••••" : (cred.value ?? "")}
                    </span>
                    {sensitive && (
                      <button
                        type="button"
                        onClick={() => toggleVisible(cred.key)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
