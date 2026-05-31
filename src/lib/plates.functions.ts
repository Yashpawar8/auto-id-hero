import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const detectInput = z.object({
  imageDataUrl: z.string().min(20).max(15_000_000),
});

export const detectPlate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => detectInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { plate: null, confidence: 0, error: "AI is not configured" };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You read vehicle license plates from photos. Always respond by calling the report_plate tool with the plate text exactly as it appears (uppercase letters and digits, no spaces or dashes) and a confidence between 0 and 1. If no plate is visible, return plate as an empty string and confidence 0.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Read the license plate in this image." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_plate",
              description: "Report the detected license plate.",
              parameters: {
                type: "object",
                properties: {
                  plate: { type: "string", description: "Plate text, uppercase, no spaces" },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                },
                required: ["plate", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_plate" } },
      }),
    });

    if (res.status === 429) return { plate: null, confidence: 0, error: "Rate limit exceeded, try again shortly." };
    if (res.status === 402) return { plate: null, confidence: 0, error: "AI credits exhausted. Add credits in Settings." };
    if (!res.ok) {
      const t = await res.text();
      console.error("AI gateway error", res.status, t);
      return { plate: null, confidence: 0, error: "AI service error" };
    }

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return { plate: null, confidence: 0, error: "No response from AI" };
    try {
      const args = JSON.parse(call.function.arguments);
      const plate = String(args.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const confidence = Number(args.confidence) || 0;
      if (!plate) return { plate: null, confidence: 0, error: "No plate detected in image" };
      return { plate, confidence, error: null as string | null };
    } catch {
      return { plate: null, confidence: 0, error: "Could not parse AI response" };
    }
  });

const plateSchema = z.string().min(1).max(20).regex(/^[A-Z0-9]+$/);

export const addVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        plate: z.string().min(1).max(32),
        owner_name: z.string().max(120).nullable().optional(),
        fine_amount: z.number().min(0).max(1_000_000).optional(),
        reason: z.string().max(200).nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clean = data.plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const plate = plateSchema.parse(clean);
    const { error } = await supabase.from("vehicles").insert({
      user_id: userId,
      plate,
      owner_name: data.owner_name || null,
      fine_amount: data.fine_amount ?? 0,
      reason: data.reason || null,
      notes: data.notes || null,
    });
    if (error) return { ok: false as const, code: error.code ?? null, message: error.message };
    return { ok: true as const };
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

export const saveDetection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        plate: z.string().min(1).max(32),
        confidence: z.number().min(0).max(1),
        image_path: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const plate = plateSchema.parse(data.plate.toUpperCase().replace(/[^A-Z0-9]/g, ""));

    // Validate image_path belongs to this user (must be under "<userId>/...")
    let safePath: string | null = null;
    if (data.image_path) {
      if (!data.image_path.startsWith(`${userId}/`)) {
        return { ok: false as const, message: "Invalid image path" };
      }
      safePath = data.image_path;
    }

    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("id, plate, owner_name, fine_amount, reason")
      .eq("user_id", userId)
      .ilike("plate", plate)
      .maybeSingle();

    const { error } = await supabase.from("detections").insert({
      user_id: userId,
      plate,
      confidence: data.confidence,
      image_url: safePath,
      matched_vehicle_id: vehicle?.id ?? null,
    });
    if (error) return { ok: false as const, message: error.message };
    return {
      ok: true as const,
      matched: vehicle
        ? {
            id: vehicle.id,
            plate: vehicle.plate,
            owner_name: vehicle.owner_name,
            fine_amount: Number(vehicle.fine_amount),
            reason: vehicle.reason,
          }
        : null,
    };
  });
