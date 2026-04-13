import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquare,
  Settings,
  Unlink,
  Zap,
} from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
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
      // Exchange code via tRPC
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
      // Clean up URL
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  const handleConnectGoogle = () => {
    if (authUrlData?.url) {
      window.location.href = authUrlData.url;
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
            <Button
              size="sm"
              onClick={handleConnectGoogle}
              disabled={!authUrlData?.url}
              className="flex items-center gap-2"
            >
              <Calendar className="h-3.5 w-3.5" />
              Connect Google Calendar
              <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* SMS */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> SMS Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            SMS notifications are powered by <strong className="text-foreground">OpenPhone (Quo)</strong>. Messages are sent from your OpenPhone number <strong className="text-foreground">(904) 685-1240</strong> to your clients automatically.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span className="text-muted-foreground"><strong className="text-foreground">Booking confirmation</strong> — sent automatically when a job is created</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span className="text-muted-foreground"><strong className="text-foreground">1-hour reminder</strong> — send manually from the job detail page</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span className="text-muted-foreground"><strong className="text-foreground">Review request</strong> — sent automatically when a job is marked completed</span>
            </div>
          </div>
          <div className="p-3 bg-muted/50 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground font-mono">
              Required env vars: <span className="text-foreground">OPENPHONE_API_KEY</span>, <span className="text-foreground">OPENPHONE_FROM_NUMBER</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
