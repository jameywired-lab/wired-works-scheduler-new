#!/usr/bin/env python3
"""Replace CredentialsSection with full edit/add/delete version and add Notes & Photos sections."""

with open("/home/ubuntu/wired-works-scheduler/client/src/pages/ProjectsPage.tsx", "r") as f:
    content = f.read()

start_marker = "// ─── Credentials Section ───────────────────────────────────────────────────────"
end_marker = "// ─── Project Form Modal ───────────────────────────────────────────────────────"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

assert start_idx != -1, "start_marker not found"
assert end_idx != -1, "end_marker not found"

new_section = r"""// ─── Credentials Section ───────────────────────────────────────────────────────
/** Credentials panel — full edit (label + value), add new, delete per row. */
function CredentialsSection({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const { data: creds = [], isLoading } = trpc.clientCredentials.list.useQuery({ clientId });
  const seedMutation = trpc.clientCredentials.seed.useMutation({
    onSuccess: () => utils.clientCredentials.list.invalidate({ clientId }),
  });
  const upsertMutation = trpc.clientCredentials.upsert.useMutation({
    onSuccess: () => { utils.clientCredentials.list.invalidate({ clientId }); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });
  const addMutation = trpc.clientCredentials.add.useMutation({
    onSuccess: () => { utils.clientCredentials.list.invalidate({ clientId }); toast.success("Credential added"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.clientCredentials.delete.useMutation({
    onSuccess: () => { utils.clientCredentials.list.invalidate({ clientId }); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!isLoading && creds.length === 0) seedMutation.mutate({ clientId });
  }, [isLoading, creds.length, clientId]);

  const [editValues, setEditValues] = useState<Record<number, { label: string; value: string }>>({});
  const [visibleIds, setVisibleIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const getLabel = (id: number, orig: string) => editValues[id]?.label ?? orig;
  const getValue = (id: number, orig: string | null) => editValues[id]?.value ?? (orig ?? "");

  const isSensitive = (key: string) =>
    ["wifi_password", "sonos_password", "ring_password", "gate_code"].includes(key);

  const handleSave = async (cred: { id: number; key: string; label: string; value: string | null }) => {
    setSavingId(cred.id);
    const label = getLabel(cred.id, cred.label);
    const value = getValue(cred.id, cred.value);
    await upsertMutation.mutateAsync({ clientId, key: cred.key, label, value });
    setSavingId(null);
  };

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    await addMutation.mutateAsync({ clientId, label: newLabel.trim(), value: newValue.trim() });
    setNewLabel(""); setNewValue(""); setShowAdd(false);
  };

  if (isLoading) return <div className="py-4 text-sm text-muted-foreground">Loading credentials...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          Client Credentials
        </h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAdd(v => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      {showAdd && (
        <div className="border border-border rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
          <Input
            placeholder="Label (e.g. Gate Code)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="h-8 text-sm"
          />
          <Input
            placeholder="Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!newLabel.trim() || addMutation.isPending}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewLabel(""); setNewValue(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {creds.map((cred) => {
          const label = getLabel(cred.id, cred.label);
          const val = getValue(cred.id, cred.value);
          const sensitive = isSensitive(cred.key);
          const visible = visibleIds.has(cred.id);
          const labelChanged = label !== cred.label;
          const valueChanged = val !== (cred.value ?? "");
          return (
            <div key={cred.id} className="space-y-1 border border-border/50 rounded-lg p-2.5 bg-muted/20">
              {/* Label row */}
              <div className="flex items-center gap-2">
                <Input
                  value={label}
                  onChange={(e) => setEditValues(prev => ({ ...prev, [cred.id]: { label: e.target.value, value: getValue(cred.id, cred.value) } }))}
                  className="h-7 text-xs font-medium bg-transparent border-0 border-b border-border/40 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                  placeholder="Label"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive flex-shrink-0"
                  onClick={() => deleteMutation.mutate({ id: cred.id })}
                  title="Delete credential"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {/* Value row */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={sensitive && !visible ? "password" : "text"}
                    value={val}
                    onChange={(e) => setEditValues(prev => ({ ...prev, [cred.id]: { label: getLabel(cred.id, cred.label), value: e.target.value } }))}
                    placeholder="Value..."
                    className="h-8 text-sm pr-8"
                    onKeyDown={(e) => e.key === "Enter" && handleSave(cred as any)}
                  />
                  {sensitive && (
                    <button type="button" onClick={() => setVisibleIds(prev => { const n = new Set(prev); n.has(cred.id) ? n.delete(cred.id) : n.add(cred.id); return n; })} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
                <Button
                  size="sm" variant="outline" className="h-8 px-3 text-xs"
                  onClick={() => handleSave(cred as any)}
                  disabled={savingId === cred.id || (!labelChanged && !valueChanged)}
                >
                  {savingId === cred.id ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Project Notes Section ───────────────────────────────────────────────────────
function ProjectNotesSection({ projectId }: { projectId: number }) {
  const utils = trpc.useUtils();
  const { data: notes = [], isLoading } = trpc.projectNotes.list.useQuery({ projectId });
  const createNote = trpc.projectNotes.create.useMutation({
    onSuccess: () => { utils.projectNotes.list.invalidate({ projectId }); setBody(""); setShowForm(false); toast.success("Note saved"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteNote = trpc.projectNotes.delete.useMutation({
    onSuccess: () => { utils.projectNotes.list.invalidate({ projectId }); toast.success("Note deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const [body, setBody] = useState("");
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Notes
        </h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
      {showForm && (
        <div className="border border-border rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a note..."
            rows={3}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createNote.mutate({ projectId, body })} disabled={!body.trim() || createNote.isPending}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setBody(""); }}>Cancel</Button>
          </div>
        </div>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && notes.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">No notes yet</p>
      )}
      <div className="space-y-2">
        {notes.map((note) => (
          <div key={note.id} className="border border-border/50 rounded-lg p-3 bg-muted/20">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm whitespace-pre-wrap flex-1">{note.body}</p>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive flex-shrink-0" onClick={() => deleteNote.mutate({ id: note.id })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {note.authorName} · {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Project Photos Section ───────────────────────────────────────────────────────
function ProjectPhotosSection({ projectId }: { projectId: number }) {
  const utils = trpc.useUtils();
  const { data: photos = [], isLoading } = trpc.projectPhotos.list.useQuery({ projectId });
  const uploadPhoto = trpc.projectPhotos.upload.useMutation({
    onSuccess: () => { utils.projectPhotos.list.invalidate({ projectId }); toast.success("Photo uploaded"); },
    onError: (e) => toast.error(e.message),
  });
  const deletePhoto = trpc.projectPhotos.delete.useMutation({
    onSuccess: () => { utils.projectPhotos.list.invalidate({ projectId }); toast.success("Photo deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files.slice(0, 10)) {
      if (file.size > 16 * 1024 * 1024) { toast.error(`${file.name} exceeds 16 MB limit`); continue; }
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(file);
      });
      await uploadPhoto.mutateAsync({ projectId, filename: file.name, mimeType: file.type, sizeBytes: file.size, base64 });
    }
    setUploading(false);
    e.target.value = "";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          Photos
        </h3>
        <label className="cursor-pointer">
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} disabled={uploading} />
          <span className="inline-flex items-center gap-1 text-xs h-7 px-2 rounded-md border border-border bg-transparent hover:bg-muted transition-colors">
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading..." : "Upload"}
          </span>
        </label>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && photos.length === 0 && (
        <p className="text-sm text-muted-foreground">No photos yet</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-border/50 aspect-square bg-muted">
            <img
              src={photo.s3Url}
              alt={photo.filename ?? "photo"}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setLightbox(photo.s3Url)}
            />
            <button
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => deletePhoto.mutate({ id: photo.id })}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="full" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(null)}><X className="h-6 w-6" /></button>
        </div>
      )}
    </div>
  );
}

"""

new_content = content[:start_idx] + new_section + content[end_idx:]

with open("/home/ubuntu/wired-works-scheduler/client/src/pages/ProjectsPage.tsx", "w") as f:
    f.write(new_content)

print("Done. File written successfully.")
