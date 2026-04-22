import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  MessageSquare,
  Save,
  Unlink,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── SMS Template Editor ──────────────────────────────────────────────────────
const TEMPLATE_LABELS: Record<string, { label: string; description: string; vars: string[] }> = {
  booking_confirmation: {
    label: "Booking Confirmation",
    description: "Sent automatically when a new job is created.",
    vars: ["{clientName}", "{jobTitle}", "{date}", "{time}"],
  },
  reminder: {
    label: "1-Hour Reminder",
    description: "Send manually from the job detail page before an appointment.",
    vars: ["{clientName}", "{date}", "{time}"],
  },
  review_request: {
    label: "Review Request",
    description: "Sent automatically when a job is marked completed.",
    vars: ["{clientName}"],
  },
};

const PREVIEW_VARS: Record<string, string> = {
  "{clientName}": "Jamey",
  "{fullName}": "Jamey Farrell",
  "{jobTitle}": "Service Call",
  "{date}": "April 17th",
  "{time}": "9:00 AM",
};

function resolvePreview(body: string) {
  let out = body;
  for (const [k, v] of Object.entries(PREVIEW_VARS)) {
    out = out.replaceAll(k, v);
  }
  return out;
}

function SmsTemplateEditor() {
  const { data: templates, isLoading } = trpc.smsTemplates.list.useQuery();
  const saveMutation = trpc.smsTemplates.save.useMutation();
  const utils = trpc.useUtils();

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (templates) {
      const initial: Record<string, string> = {};
      templates.forEach((t) => { initial[t.key] = t.body; });
      setDrafts(initial);
    }
  }, [templates]);

  const handleSave = async (key: string) => {
    try {
      await saveMutation.mutateAsync({ key, body: drafts[key] });
      utils.smsTemplates.list.invalidate();
      toast.success("Template saved!");
    } catch {
      toast.error("Failed to save template.");
    }
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading templates…</div>;
  }

  return (
    <div className="space-y-6">
      {Object.entries(TEMPLATE_LABELS).map(([key, meta]) => {
        const body = drafts[key] ?? "";
        const preview = resolvePreview(body);
        const isDirty = templates?.find((t) => t.key === key)?.body !== body;

        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{meta.label}</p>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!isDirty || saveMutation.isPending}
                onClick={() => handleSave(key)}
                className="shrink-0 ml-3"
              >
                {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Save
              </Button>
            </div>

            <Textarea
              value={body}
              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
              rows={3}
              className="text-sm font-mono resize-none"
              placeholder="Enter message text…"
            />

            {/* Available variables */}
            <div className="flex flex-wrap gap-1">
              {meta.vars.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="text-[10px] font-mono bg-muted hover:bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded cursor-pointer"
                  onClick={() => setDrafts((d) => ({ ...d, [key]: (d[key] ?? "") + v }))}
                  title={`Insert ${v}`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Live preview */}
            <div className="p-3 bg-muted/40 border border-border rounded-lg">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Preview</p>
              <p className="text-sm text-foreground">{preview || <span className="italic text-muted-foreground">Empty message</span>}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Change Password Section ──────────────────────────────────────────────────
function ChangePasswordSection() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || "Failed to update password.");
      }
    } catch {
      toast.error("Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Update the password for <strong className="text-foreground">{user?.email || user?.name}</strong>.
      </p>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Current Password</Label>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            className="bg-input border-border max-w-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label>New Password</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="bg-input border-border max-w-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Confirm New Password</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
            className="bg-input border-border max-w-sm"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5 mr-1.5" />}
        Update Password
      </Button>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: calStatus, isLoading: calLoading } = trpc.googleCalendar.status.useQuery();
  const { data: authUrlData } = trpc.googleCalendar.getAuthUrl.useQuery(
    { redirectUri: `${window.location.origin}/settings` },
    { enabled: !calStatus?.connected }
  );

  const disconnectCal = trpc.googleCalendar.disconnect.useMutation();

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      fetch(`/api/trpc/googleCalendar.callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: { code, redirectUri: `${window.location.origin}/settings` },
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.result?.data?.json?.success) {
            toast.success("Google Calendar connected!");
            utils.googleCalendar.status.invalidate();
          } else {
            toast.error("Failed to connect Google Calendar.");
          }
        })
        .catch(() => toast.error("Failed to connect Google Calendar."));
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  const handleConnectGoogle = () => {
    if (authUrlData?.url) {
      window.location.href = authUrlData.url;
    } else {
      toast.error("Google Calendar is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Railway → Variables.");
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await disconnectCal.mutateAsync();
      utils.googleCalendar.status.invalidate();
      toast.success("Google Calendar disconnected.");
    } catch {
      toast.error("Failed to disconnect.");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage integrations and app preferences</p>
      </div>

      {/* App info */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">App</span>
            <span className="text-sm font-medium">Wired Works Scheduler</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Signed in as</span>
            <span className="text-sm font-medium">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="secondary" className="capitalize">{user?.role}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <ChangePasswordSection />
        </CardContent>
      </Card>

      {/* Google Calendar */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your Google Calendar to automatically sync jobs when they are created, updated, or deleted.
          </p>
          {calLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking status…
            </div>
          ) : calStatus?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-400">Connected</p>
                  {calStatus.calendarId && (
                    <p className="text-xs text-muted-foreground">{calStatus.calendarId}</p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectGoogle}
                disabled={disconnectCal.isPending}
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                {disconnectCal.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Unlink className="h-3.5 w-3.5 mr-1.5" />
                )}
                Disconnect Google Calendar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                size="sm"
                onClick={handleConnectGoogle}
                className="flex items-center gap-2"
              >
                <Calendar className="h-3.5 w-3.5" />
                Connect Google Calendar
                <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
              </Button>
              {!authUrlData?.url && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 space-y-1">
                  <p className="font-medium">Setup required</p>
                  <p className="text-muted-foreground">
                    To enable Google Calendar sync, add these two environment variables in Railway → Variables:
                  </p>
                  <p className="font-mono text-amber-300">GOOGLE_CLIENT_ID</p>
                  <p className="font-mono text-amber-300">GOOGLE_CLIENT_SECRET</p>
                  <p className="text-muted-foreground mt-1">
                    Get these from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="underline text-amber-400">Google Cloud Console</a> → Create OAuth 2.0 Client ID (Web application). Set the authorized redirect URI to <span className="font-mono">{window.location.origin}/settings</span>.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SMS Templates */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> SMS Message Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-2">
          <p className="text-sm text-muted-foreground mb-4">
            Customise the text messages sent to clients. Click a variable tag to insert it, or type it directly. The preview shows how the message will look with sample data.
          </p>
          <SmsTemplateEditor />
          <div className="pt-2 p-3 bg-muted/50 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground">
              Messages are sent from <strong className="text-foreground">(904) 685-1240</strong> via OpenPhone.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
