import { useState, useRef } from "react";
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
import {
  Truck,
  Package,
  CheckCircle2,
  AlertTriangle,
  Send,
  ClipboardList,
  Pencil,
  Trash2,
  Plus,
  X,
} from "lucide-react";

export default function VanInventoryPage() {
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [partText, setPartText] = useState("");
  const [requestedBy, setRequestedBy] = useState("Crew");
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // New item form state
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState("1");

  const utils = trpc.useUtils();

  const { data: items = [], refetch } = trpc.inventory.listItems.useQuery();
  const { data: requests = [], refetch: refetchRequests } = trpc.inventory.listRequests.useQuery();

  const updateQty = trpc.inventory.updateCurrentQty.useMutation({
    onSuccess: () => refetch(),
  });

  const updateItem = trpc.inventory.updateItem.useMutation({
    onSuccess: () => { refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const createItem = trpc.inventory.createItem.useMutation({
    onSuccess: () => {
      toast.success("Item added to inventory.");
      setNewName("");
      setNewTarget("1");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteItem = trpc.inventory.deleteItem.useMutation({
    onSuccess: () => {
      toast.success("Item removed from inventory.");
      setDeleteConfirmId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
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

  const itemToDelete = items.find((i) => i.id === deleteConfirmId);

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
        <div className="flex items-center gap-2">
          {editMode ? (
            <Button
              variant="outline"
              onClick={() => setEditMode(false)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Done Editing
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                Edit Inventory
              </Button>
              <Button
                onClick={() => setShowConfirmSend(true)}
                disabled={sendReport.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                <Send className="h-4 w-4" />
                Complete Inventory
              </Button>
            </>
          )}
        </div>
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
                {editMode
                  ? "Edit items — rename, change targets, add or remove"
                  : "Enter current quantities on the van"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {/* Column headers */}
                <div className={`grid gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30 ${editMode ? "grid-cols-12" : "grid-cols-12"}`}>
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2 text-center">Target</div>
                  {!editMode && <div className="col-span-2 text-center">On Hand</div>}
                  {!editMode && <div className="col-span-3 text-center">Status</div>}
                  {editMode && <div className="col-span-5 text-right pr-2">Actions</div>}
                </div>

                {items.map((item) => {
                  const shortage = item.targetQty - item.currentQty;
                  const isShort = shortage > 0;

                  if (editMode) {
                    return (
                      <EditableItemRow
                        key={item.id}
                        item={item}
                        onSaveName={(name) => updateItem.mutate({ id: item.id, name })}
                        onSaveTarget={(targetQty) => updateItem.mutate({ id: item.id, targetQty })}
                        onDelete={() => setDeleteConfirmId(item.id)}
                      />
                    );
                  }

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

                {/* Add new item row (edit mode only) */}
                {editMode && (
                  <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center bg-blue-500/5 border-t-2 border-blue-500/20">
                    <div className="col-span-5">
                      <Input
                        placeholder="New item name..."
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newName.trim()) {
                            const t = parseInt(newTarget, 10);
                            if (!isNaN(t) && t > 0) {
                              createItem.mutate({ name: newName.trim(), targetQty: t });
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Input
                        type="number"
                        min={1}
                        value={newTarget}
                        onChange={(e) => setNewTarget(e.target.value)}
                        className="w-16 h-8 text-center text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newName.trim()) {
                            const t = parseInt(newTarget, 10);
                            if (!isNaN(t) && t > 0) {
                              createItem.mutate({ name: newName.trim(), targetQty: t });
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="col-span-5 flex justify-end">
                      <Button
                        size="sm"
                        disabled={!newName.trim() || createItem.isPending}
                        onClick={() => {
                          const t = parseInt(newTarget, 10);
                          if (newName.trim() && !isNaN(t) && t > 0) {
                            createItem.mutate({ name: newName.trim(), targetQty: t });
                          }
                        }}
                        className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Item
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {!editMode && shortItems.length > 0 && (
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

      {/* Delete Confirm Dialog */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{itemToDelete?.name}</strong> from the inventory list. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteConfirmId !== null) deleteItem.mutate({ id: deleteConfirmId }); }}
              disabled={deleteItem.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Editable Item Row ────────────────────────────────────────────────────────

type EditableItemRowProps = {
  item: { id: number; name: string; targetQty: number };
  onSaveName: (name: string) => void;
  onSaveTarget: (targetQty: number) => void;
  onDelete: () => void;
};

function EditableItemRow({ item, onSaveName, onSaveTarget, onDelete }: EditableItemRowProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-muted/20 transition-colors">
      <div className="col-span-5">
        <Input
          ref={nameRef}
          defaultValue={item.name}
          className="h-8 text-sm"
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val && val !== item.name) onSaveName(val);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              if (nameRef.current) nameRef.current.value = item.name;
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>
      <div className="col-span-2 flex justify-center">
        <Input
          ref={targetRef}
          type="number"
          min={1}
          defaultValue={item.targetQty}
          className="w-16 h-8 text-center text-sm"
          onBlur={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val > 0 && val !== item.targetQty) onSaveTarget(val);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
      <div className="col-span-5 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
