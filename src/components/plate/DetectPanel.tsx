import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Loader2, Camera, CheckCircle2, XCircle, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { detectPlate } from "@/lib/plates.functions";

type Result = {
  plate: string;
  confidence: number;
  matched: { id: string; plate: string; owner_name: string | null; fine_amount: number; reason: string | null } | null;
};

export default function DetectPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const detect = useServerFn(detectPlate);
  const qc = useQueryClient();

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) return toast.error("Image too large (max 10MB)");
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const runDetect = async () => {
    if (!imageDataUrl) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await detect({ data: { imageDataUrl } });
      if (res.error || !res.plate) {
        toast.error(res.error ?? "No plate detected");
        return;
      }
      // Match against user vehicles
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user!.id;
      const { data: vehicle } = await supabase
        .from("vehicles")
        .select("id, plate, owner_name, fine_amount, reason")
        .ilike("plate", res.plate)
        .maybeSingle();

      // Upload image to storage
      let imagePath: string | null = null;
      try {
        const blob = await (await fetch(imageDataUrl)).blob();
        const path = `${userId}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from("plates").upload(path, blob, { contentType: blob.type || "image/jpeg" });
        if (!upErr) imagePath = path;
      } catch (e) { console.error(e); }

      await supabase.from("detections").insert({
        user_id: userId,
        plate: res.plate,
        confidence: res.confidence,
        image_url: imagePath,
        matched_vehicle_id: vehicle?.id ?? null,
      });
      qc.invalidateQueries({ queryKey: ["detections"] });
      setResult({ plate: res.plate, confidence: res.confidence, matched: vehicle ?? null });
    } catch (e) {
      console.error(e);
      toast.error("Detection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Camera className="h-5 w-5 text-primary" /> Detect campus vehicle
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Upload a campus vehicle photo and AI will read the plate number.</p>

        <div
          className="mt-4 grid aspect-video place-items-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-secondary/30 cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        >
          {imageDataUrl ? (
            <img src={imageDataUrl} alt="Campus vehicle" className="h-full w-full object-contain" />
          ) : (
            <div className="text-center text-muted-foreground">
              <Upload className="mx-auto h-8 w-8" />
              <p className="mt-2 text-sm">Click or drag a vehicle photo here</p>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        <div className="mt-4 flex gap-2">
          <Button onClick={() => fileRef.current?.click()} variant="outline">Choose photo</Button>
          <Button onClick={runDetect} disabled={!imageDataUrl || loading} className="flex-1">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading plate…</> : "Detect plate"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Result</h2>
        {!result && !loading && (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            Upload a photo and tap Detect to see the result here.
          </div>
        )}
        {loading && (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            <p className="mt-2">Analyzing image…</p>
          </div>
        )}
        {result && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-border bg-secondary/40 p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Detected plate</p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-[0.2em] text-primary">{result.plate}</p>
              <p className="mt-2 text-xs text-muted-foreground">Confidence {Math.round(result.confidence * 100)}%</p>
            </div>
            {result.matched ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span className="font-semibold">Fine outstanding</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Owner</div>
                    <div className="font-medium">{result.matched.owner_name || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Reason</div>
                    <div className="font-medium">{result.matched.reason || "—"}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-md bg-background/40 p-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">${Number(result.matched.fine_amount).toFixed(2)}</span>
                  <Badge variant="destructive" className="ml-auto">Unpaid</Badge>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">No fines on record</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">This plate isn't registered in the campus database.</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}