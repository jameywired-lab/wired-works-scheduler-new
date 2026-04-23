import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, FolderOpen, MapPin, User, Key, StickyNote,
  Camera, Trash2, Plus, Eye, EyeOff, CheckCircle2, Circle,
  ExternalLink, Loader2
} from "lucide-react";
import { toast } from "sonner";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CrewProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0", 10);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [newNote, setNewNote] = useState("");
  const [showCreds, setShowCreds] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: project, isLoading: loadingProject } = trpc.projects.getById.useQuery(
    { id: projectId },
    { enabled: projectId > 0 }
  );
  const { data: client } = trpc.clients.getById.useQuery(
    { id: project?.clientId ?? 0 },
    { enabled: !!(project?.clientId) }
  );
  const { data: credentials = [] } = trpc.projectCredentials.list.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );
  const { data: notes = [], isLoading: loadingNotes } = trpc.projectNotes.list.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );
  const { data: photos = [], isLoading: loadingPhotos } = trpc.projectPhotos.list.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addNote = trpc.projectNotes.create.useMutation({
    onSuccess: () => {
      setNewNote("");
      utils.projectNotes.list.invalidate({ projectId });
      toast.success("Note added");
    },
    onError: () => toast.error("Failed to add note"),
  });

  const deleteNote = trpc.projectNotes.delete.useMutation({
    onSuccess: () => utils.projectNotes.list.invalidate({ projectId }),
    onError: () => toast.error("Failed to delete note"),
  });

  const deletePhoto = trpc.projectPhotos.delete.useMutation({
    onSuccess: () => utils.projectPhotos.list.invalidate({ projectId }),
    onError: () => toast.error("Failed to delete photo"),
  });

  const uploadPhoto = trpc.projectPhotos.upload.useMutation({
    onSuccess: () => {
      utils.projectPhotos.list.invalidate({ projectId });
      toast.success("Photo uploaded");
    },
    onError: () => toast.error("Failed to upload photo"),
    onSettled: () => setUploadingPhoto(false),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Photo must be under 16 MB");
      return;
    }
    setUploadingPhoto(true);
    try {
      const base64 = await fileToBase64(file);
      await uploadPhoto.mutateAsync({
        projectId,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        base64,
        uploadedBy: user?.name ?? "Crew",
      });
    } catch {
      setUploadingPhoto(false);
    }
    e.target.value = "";
  }

  function openMaps(address: string) {
    const q = encodeURIComponent(address);
    window.open(`https://maps.google.com/?q=${q}`, "_blank");
  }

  // ── Loading / not found ───────────────────────────────────────────────────
  if (loadingProject) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!project) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>Project not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/crew-projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Projects
        </Button>
      </div>
    );
  }

  const milestones = project.milestones ?? [];
  const totalWeight = milestones.reduce((s, m) => s + (m.weight ?? 0), 0);
  const doneWeight = milestones.filter((m) => m.isComplete).reduce((s, m) => s + (m.weight ?? 0), 0);
  const pct = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;

  // Build address string from client addresses (use first one)
  const addressStr = client
    ? [client.addressLine1, client.addressLine2, client.city, client.state, client.zip].filter(Boolean).join(", ")
    : null;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 pb-24">
      {/* Back button */}
      <button
        onClick={() => navigate("/crew-projects")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </button>

      {/* Project header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-violet-500/10 shrink-0">
          <FolderOpen className="h-6 w-6 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold leading-tight">{project.title}</h1>
          {client && (
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {client.name}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge className={
              project.status === "active" ? "bg-emerald-500/15 text-emerald-600 border-emerald-300/40 text-[10px]" :
              project.status === "on_hold" ? "bg-amber-500/15 text-amber-600 border-amber-300/40 text-[10px]" :
              "bg-muted text-muted-foreground text-[10px]"
            }>
              {project.status.replace("_", " ")}
            </Badge>
            {project.projectType && (
              <Badge className="bg-blue-500/15 text-blue-600 border-blue-300/40 text-[10px]">
                {project.projectType.replace("_", " ")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground leading-relaxed">
            {project.description}
          </CardContent>
        </Card>
      )}

      {/* Client info + address */}
      {client && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <p className="font-medium">{client.name}</p>
            {client.phone && (
              <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                📞 {client.phone}
              </a>
            )}
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                ✉️ {client.email}
              </a>
            )}
            {addressStr && (
              <button
                onClick={() => openMaps(addressStr)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline text-left"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {addressStr}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progress / Milestones */}
      {milestones.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                Stages
              </span>
              <span className="text-xs font-normal text-muted-foreground">{pct}% complete</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {milestones
              .slice()
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map((m) => (
                <div key={m.id} className="flex items-center gap-2.5">
                  {m.isComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className={`text-sm flex-1 ${m.isComplete ? "line-through text-muted-foreground" : ""}`}>
                    {m.title}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Credentials */}
      {credentials.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                Credentials & Access
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowCreds(!showCreds)}
              >
                {showCreds ? <><EyeOff className="h-3.5 w-3.5 mr-1" />Hide</> : <><Eye className="h-3.5 w-3.5 mr-1" />Show</>}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {credentials.map((cred) => (
              <div key={cred.id} className="rounded-lg bg-muted/40 p-3 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cred.label}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{cred.key}</span>
                  <span className="text-sm font-mono">
                    {showCreds ? (cred.value ?? "—") : "••••••••"}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-muted-foreground" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Add note */}
          <div className="space-y-2">
            <Textarea
              placeholder="Add a note about this project…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            <Button
              size="sm"
              disabled={!newNote.trim() || addNote.isPending}
              onClick={() => addNote.mutate({ projectId, body: newNote.trim(), authorName: user?.name ?? "Crew" })}
              className="w-full"
            >
              {addNote.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Note
            </Button>
          </div>

          {/* Notes list */}
          {loadingNotes ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
          ) : (
            <div className="space-y-2">
              {notes
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((note) => (
                  <div key={note.id} className="rounded-lg bg-muted/30 p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-relaxed flex-1">{note.body}</p>
                      <button
                        onClick={() => deleteNote.mutate({ id: note.id })}
                        className="text-muted-foreground/50 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {note.authorName && <span className="font-medium">{note.authorName} · </span>}
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              Photos
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={uploadingPhoto}
              onClick={() => photoInputRef.current?.click()}
            >
              {uploadingPhoto ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Camera className="h-3.5 w-3.5 mr-1" />
              )}
              Add Photo
            </Button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loadingPhotos ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => <div key={i} className="aspect-square rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Camera className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No photos yet</p>
              <p className="text-xs mt-1">Tap "Add Photo" to upload</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted/40">
                  <img
                    src={photo.s3Url ?? ""}
                    alt={photo.filename ?? "Project photo"}
                    className="w-full h-full object-cover"
                    onClick={() => window.open(photo.s3Url, "_blank")}
                  />
                  <button
                    onClick={() => deletePhoto.mutate({ id: photo.id })}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Dates */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        {project.startDate && (
          <div>
            <span className="font-medium">Start: </span>
            {new Date(project.startDate).toLocaleDateString()}
          </div>
        )}
        {project.dueDate && (
          <div>
            <span className="font-medium">Due: </span>
            {new Date(project.dueDate).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}
