import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

type Detection = {
  id: string;
  plate: string;
  image_url: string | null;
  confidence: number | null;
  created_at: string;
  matched_vehicle_id: string | null;
  vehicles: { fine_amount: number; owner_name: string | null; reason: string | null } | null;
};

export default function HistoryPanel() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["detections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("detections")
        .select("id, plate, image_url, confidence, created_at, matched_vehicle_id, vehicles(fine_amount, owner_name, reason)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as Detection[];
    },
  });

  const [signed, setSigned] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = data.map((d) => d.image_url).filter((p): p is string => !!p && !p.startsWith("http"));
    if (paths.length === 0) return;
    let cancelled = false;
    supabase.storage.from("plates").createSignedUrls(paths, 3600).then(({ data: signedData }) => {
      if (cancelled || !signedData) return;
      const map: Record<string, string> = {};
      signedData.forEach((s, i) => { if (s.signedUrl) map[paths[i]] = s.signedUrl; });
      setSigned(map);
    });
    return () => { cancelled = true; };
  }, [data]);

  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <History className="h-5 w-5 text-primary" /> Campus detection history
      </h2>
      <div className="mt-4 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && data.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No detections yet. Go to the Detect tab to scan your first campus vehicle.
          </p>
        )}
        {data.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
            {d.image_url && signed[d.image_url] ? (
              <img src={signed[d.image_url]} alt={d.plate} className="h-14 w-20 rounded-md object-cover" />
            ) : (
              <div className="grid h-14 w-20 place-items-center rounded-md bg-background text-xs text-muted-foreground">no image</div>
            )}
            <div className="font-mono text-lg font-bold tracking-widest text-primary">{d.plate}</div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="truncate">{d.vehicles?.owner_name || "Unmatched plate"}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(d.created_at).toLocaleString()} · {Math.round((d.confidence ?? 0) * 100)}%
              </div>
            </div>
            {d.vehicles ? (
              <Badge variant="destructive">${Number(d.vehicles.fine_amount).toFixed(2)}</Badge>
            ) : (
              <Badge variant="secondary">Clear</Badge>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}