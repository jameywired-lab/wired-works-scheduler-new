import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { Truck, Package, CheckCircle2, AlertTriangle, Send, ClipboardList } from "lucide-react";

export default function VanInventoryPage() {
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [partText, setPartText] = useState("");
  const [requestedBy, setRequestedBy] = useState("Crew");

  const { data: items = [], refetch } = trpc.inventory.listItems.useQuery();
  const { data: requests = [], refetch: refetchRequests } = trpc.inventory.listRequests.useQuery();

  const updateQty = trpc.inventory.updateCurrentQty.useMutation({
    onSuccess: () => refetch(),
  });

  const sendReport = trpc.inventory.sendReport.useMutation({
    onSuccess: (data) => {
      if (data.shortages === 0) {
        toast.success("Van is fully stocked. Text sent to owner.");
      } else {
        toast.success(`Shortage report for ${data.shortages} item(s) sent to owner.`);
      }
      setShowConfirmSend(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setShowConfirmSend(false);
    },
  });

  const requestPart = trpc.inventory.requestPart.useMutation({
    onSuccess: (data) => {
      if (data.smsSent) {
        toast.success("Your parts request has been texted to the owner.");
      } else {
        toast("Request saved (SMS unavailable).");
      }
      setPartText("");
      refetchRequests();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Compute totals
  const totalItems = items.length;
  const shortItems = items.filter((i) => i.currentQty < i.targetQty);
  const fullyStocked = items.filter((i) => i.currentQty >= i.targetQty).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Truck className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Van Inventory</h1>
            <p className="text-sm text-muted-foreground">
              Track what's on the van and request restocking
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowConfirmSend(true)}
          disabled={sendReport.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Send className="h-4 w-4 mr-2" />
          Complete Inventory
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{totalItems}</p>
                <p className="text-xs text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-500">{fullyStocked}</p>
                <p className="text-xs text-muted-foreground">Fully Stocked</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-amber-500">{shortItems.length}</p>
                <p className="text-xs text-muted-foreground">Need Restocking</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory">
        <TabsList className="w-full">
          <TabsTrigger value="inventory" className="flex-1">
            <Package className="h-4 w-4 mr-2" />
            Inventory Checklist
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex-1">
            <ClipboardList className="h-4 w-4 mr-2" />
            Parts Requested
          </TabsTrigger>
        </TabsList>

        {/* Inventory Checklist Tab */}
        <TabsContent value="inventory" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Enter current quantities on the van
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {/* Column headers */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2 text-center">Target</div>
                  <div className="col-span-2 text-center">On Hand</div>
                  <div className="col-span-3 text-center">Status</div>
                </div>
                {items.map((item) => {
                  const shortage = item.targetQty - item.currentQty;
                  const isShort = shortage > 0;
                  return (
                    <div
                      key={item.id}
                      className={`grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors ${
                        isShort ? "bg-amber-500/5" : "bg-green-500/5"
                      }`}
                    >
                      <div className="col-span-5 font-medium text-sm">{item.name}</div>
                      <div className="col-span-2 text-center text-sm text-muted-foreground">
                        {item.targetQty}
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <Input
                          type="number"
                          min={0}
                          defaultValue={item.currentQty}
                          className="w-16 h-8 text-center text-sm"
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val !== item.currentQty) {
                              updateQty.mutate({ id: item.id, currentQty: val });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      </div>
                      <div className="col-span-3 flex justify-center">
                        {isShort ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">
                            Need {shortage}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-green-500 text-green-600 text-xs">
                            ✓ OK
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {shortItems.length > 0 && (
            <Card className="mt-4 border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Shortage Summary ({shortItems.length} items)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {shortItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium text-amber-600">
                        Need {item.targetQty - item.currentQty}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Parts Requested Tab */}
        <TabsContent value="requests" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Request a Part</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Your name (optional)"
                  value={requestedBy}
                  onChange={(e) => setRequestedBy(e.target.value)}
                  className="w-40 shrink-0"
                />
                <Textarea
                  placeholder="Describe the part(s) you need..."
                  value={partText}
                  onChange={(e) => setPartText(e.target.value)}
                  className="min-h-[60px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (partText.trim()) {
                        requestPart.mutate({
                          requestedBy: requestedBy || "Crew",
                          partDescription: partText.trim(),
                        });
                      }
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (partText.trim()) {
                      requestPart.mutate({
                        requestedBy: requestedBy || "Crew",
                        partDescription: partText.trim(),
                      });
                    }
                  }}
                  disabled={!partText.trim() || requestPart.isPending}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4 mr-1" />
                  Send
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Press Enter or click Send — your request will be texted to the owner immediately.
              </p>
            </CardContent>
          </Card>

          {/* Request History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {requests.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No parts requests yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {requests.map((req) => (
                    <div key={req.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{req.partDescription}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Requested by {req.requestedBy} ·{" "}
                          {new Date(req.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          req.smsSent
                            ? "border-green-500 text-green-600 shrink-0"
                            : "border-muted text-muted-foreground shrink-0"
                        }
                      >
                        {req.smsSent ? "✓ Sent" : "Pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Send Dialog */}
      <AlertDialog open={showConfirmSend} onOpenChange={setShowConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Inventory & Send Report?</AlertDialogTitle>
            <AlertDialogDescription>
              {shortItems.length === 0
                ? "All items are fully stocked. A confirmation text will be sent to the owner."
                : `This will text a shortage report for ${shortItems.length} item(s) to the owner at (904) 333-6466.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sendReport.mutate()}
              disabled={sendReport.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sendReport.isPending ? "Sending..." : "Send Report"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
