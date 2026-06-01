import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Loader2, Camera, CheckCircle2, XCircle, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { detectPlate, saveDetection } from "@/lib/plates.functions";

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
  const save = useServerFn(saveDetection);
  const qc = useQueryClient();

  const downscale = (file: File, maxDim = 1280, quality = 0.85): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not decode image"));
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas not supported"));
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 20 * 1024 * 1024) return toast.error("Image too large (max 20MB)");
    try {
      const dataUrl = await downscale(file);
      setImageDataUrl(dataUrl);
      setResult(null);
    } catch (e) {
      console.error(e);
      toast.error("Could not process image");
    }
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
      // Only upload after a successful detection. RLS restricts to the user's own folder.
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      let imagePath: string | null = null;
      if (userId) {
        try {
          const blob = await (await fetch(imageDataUrl)).blob();
          const path = `${userId}/${Date.now()}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("plates")
            .upload(path, blob, { contentType: "image/jpeg", upsert: false });
          if (!upErr) imagePath = path;
          else console.error("storage upload failed", upErr);
        } catch (e) { console.error(e); }
      }

      // Server matches against this user's vehicles and inserts the detection
      // using the JWT-derived user_id (never trusts a client-supplied id).
      const saved = await save({
        data: { plate: res.plate, confidence: res.confidence, image_path: imagePath },
      });
      if (!saved.ok) {
        toast.error(saved.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["detections"] });
      setResult({ plate: res.plate, confidence: res.confidence, matched: saved.matched });
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