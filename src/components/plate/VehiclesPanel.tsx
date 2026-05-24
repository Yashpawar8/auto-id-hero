import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Car } from "lucide-react";

type Vehicle = {
  id: string;
  plate: string;
  owner_name: string | null;
  fine_amount: number;
  reason: string | null;
  notes: string | null;
};

export default function VehiclesPanel() {
  const qc = useQueryClient();
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, owner_name, fine_amount, reason, notes")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const [plate, setPlate] = useState("");
  const [owner, setOwner] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean) return toast.error("Enter a plate");
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("vehicles").insert({
      user_id: userRes.user!.id,
      plate: clean,
      owner_name: owner || null,
      fine_amount: Number(amount) || 0,
      reason: reason || null,
      notes: notes || null,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") return toast.error("Plate already registered");
      return toast.error(error.message);
    }
    toast.success("Vehicle added");
    setPlate(""); setOwner(""); setAmount(""); setReason(""); setNotes("");
    qc.invalidateQueries({ queryKey: ["vehicles"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    qc.invalidateQueries({ queryKey: ["vehicles"] });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Plus className="h-5 w-5 text-primary" /> Register campus vehicle
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Add a campus vehicle plate with any applicable fine.</p>
        <form onSubmit={add} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="plate">Plate number *</Label>
            <Input id="plate" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC1234" className="font-mono uppercase tracking-widest" />
          </div>
          <div>
            <Label htmlFor="owner">Owner name</Label>
            <Input id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount">Fine amount ($)</Label>
              <Input id="amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Overspeeding" />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional details" />
          </div>
          <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving…" : "Add vehicle"}</Button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Car className="h-5 w-5 text-primary" /> Registered vehicles
          </h2>
          <span className="text-sm text-muted-foreground">{vehicles.length}</span>
        </div>
        <div className="mt-4 space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && vehicles.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No vehicles yet. Add one on the left to get started.
            </p>
          )}
          {vehicles.map((v) => (
            <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
              <div className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm font-bold tracking-widest text-primary">
                {v.plate}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{v.owner_name || "Unknown owner"}</div>
                <div className="truncate text-xs text-muted-foreground">{v.reason || "No reason set"}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">${Number(v.fine_amount).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">fine</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(v.id)} aria-label="Remove">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}