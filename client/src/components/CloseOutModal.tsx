import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Image,
  Loader2,
  X,
} from "lucide-react";

type CloseoutOutcome =
  | "client_happy_bill"
  | "client_issue_urgent"
  | "proposal_needed"
  | "bill_service_call";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  jobId: number;
  jobType: "service_call" | "sales_call" | "project_job";
  clientName?: string;
  clientPhone?: string;
  clientId?: number;
}

// ─── Outcome definitions per job type ────────────────────────────────────────
interface OutcomeOption { value: CloseoutOutcome; label: string; description: string; urgent?: boolean }
const SERVICE_OUTCOMES: OutcomeOption[] = [
  {
    value: "client_happy_bill",
    label: "Client happy — ready for billing",
    description: "Job completed successfully. Create a billing follow-up.",
  },
  {
    value: "client_issue_urgent",
    label: "Issue with client — respond ASAP",
    description: "There is a problem that needs immediate attention.",
    urgent: true,
  },
];

const SALES_OUTCOMES: OutcomeOption[] = [
  {
    value: "proposal_needed",
    label: "Meeting done — proposal needed",
    description: "Send a proposal to the client and follow up.",
  },
  {
    value: "bill_service_call",
    label: "Meeting done — bill out a service call",
    description: "No proposal needed; bill the client for this visit.",
  },
];

export default function CloseOutModal({
  open,
  onClose,
  onSuccess,
  jobId,
  jobType,
  clientName,
  clientPhone,
  clientId,
}: Props) {
  const utils = trpc.useUtils();
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<CloseoutOutcome | null>(null);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = trpc.jobPhotos.upload.useMutation();
  const closeOut = trpc.followUps.closeOut.useMutation({
    onSuccess: () => {
      utils.jobs.getById.invalidate({ id: jobId });
      utils.dashboard.getData.invalidate();
      utils.followUps.list.invalidate();
      toast.success("Job closed out! Follow-up created.");
      onSuccess();
    },
    onError: (e) => {
      toast.error(e.message);
      setIsSubmitting(false);
    },
  });

  const outcomes = jobType === "sales_call" ? SALES_OUTCOMES : SERVICE_OUTCOMES;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = 10 - photos.length;
    const toAdd = files.slice(0, remaining);
    const previews = toAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...previews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error("Notes are required before closing out.");
      return;
    }
    if (!outcome) {
      toast.error("Please select an outcome before closing out.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload photos first
      for (const { file } of photos) {
        const base64 = await fileToBase64(file);
        await uploadPhoto.mutateAsync({
          jobId,
          filename: file.name,
          mimeType: file.type,
          base64Data: base64,
          sizeBytes: file.size,
        });
      }

      // Close out the job
      await closeOut.mutateAsync({
        jobId,
        closeoutNotes: notes.trim(),
        closeoutOutcome: outcome,
        contactName: clientName,
        phone: clientPhone,
        clientId,
      });
    } catch {
      // errors handled by mutation callbacks
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setNotes("");
    setOutcome(null);
    setPhotos([]);
    onClose();
  };

  const notesValid = notes.trim().length > 0;
  const outcomeValid = outcome !== null;
  const canSubmit = notesValid && outcomeValid && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            Close Out Job
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Job type badge */}
          <div className="flex items-center gap-2">
            <Badge
              className={
                jobType === "sales_call"
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-blue-500/15 text-blue-400"
              }
            >
              {jobType === "sales_call" ? "Sales Call" : "Service Call"}
            </Badge>
            {clientName && (
              <span className="text-sm text-muted-foreground">{clientName}</span>
            )}
          </div>

          {/* Outcome checkboxes */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              Outcome
              <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2">
              {outcomes.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOutcome(opt.value)}
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-all ${
                    outcome === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <Checkbox
                    checked={outcome === opt.value}
                    onCheckedChange={() => setOutcome(opt.value)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{opt.label}</span>
                      {opt.urgent === true && (
                        <Badge className="bg-destructive/15 text-destructive text-[10px] h-4 px-1.5 flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Urgent
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Notes — mandatory */}
          <div className="space-y-1.5">
            <Label htmlFor="closeout-notes" className="text-sm font-semibold flex items-center gap-1.5">
              Notes
              <span className="text-destructive">*</span>
              {!notesValid && (
                <span className="text-xs text-destructive font-normal ml-1">Required</span>
              )}
            </Label>
            <Textarea
              id="closeout-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what was done, any issues, materials used, or next steps…"
              rows={4}
              className={`resize-none ${!notesValid && notes.length > 0 ? "border-destructive" : ""}`}
            />
          </div>

          {/* Photo upload */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Image className="h-4 w-4" />
              Photos
              <span className="text-xs text-muted-foreground font-normal ml-1">
                ({photos.length}/10)
              </span>
            </Label>

            {photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                    <img
                      src={p.preview as string}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="h-4 w-4 mr-2" />
                Add Photos
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={
              outcome === "client_issue_urgent"
                ? "bg-destructive hover:bg-destructive/90"
                : ""
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Closing out…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Complete Job
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
