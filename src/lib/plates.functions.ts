import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const detectInput = z.object({
  imageDataUrl: z
    .string()
    .min(20)
    .max(15_000_000)
    .refine((v) => v.startsWith("data:image/"), "Must be a data:image/* URL"),
});

export const detectPlate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => detectInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { plate: null, confidence: 0, error: "AI is not configured" };
    }

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a license-plate OCR system. Look at the image and read the vehicle's license plate. Respond ONLY by calling the report_plate tool. plate = the characters exactly as printed, uppercase A-Z and 0-9 only (strip spaces, dashes, dots, state names, country codes). confidence = 0..1. If no plate is visible OR the image isn't a vehicle, call the tool with plate=\"\" confidence=0.",
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
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) return { plate: null, confidence: 0, error: "Rate limit exceeded, try again shortly." };
    if (res.status === 402) return { plate: null, confidence: 0, error: "AI credits exhausted. Add credits in Settings." };
    if (!res.ok) {
      const t = await res.text();
      console.error("AI gateway error", res.status, t);
      return { plate: null, confidence: 0, error: `AI service error (${res.status})` };
    }

    const json = await res.json();
    const msg = json?.choices?.[0]?.message;
    const call = msg?.tool_calls?.[0];
    let plateRaw = "";
    let confidence = 0;
    if (call?.function?.arguments) {
      try {
        const args = typeof call.function.arguments === "string"
          ? JSON.parse(call.function.arguments)
          : call.function.arguments;
        plateRaw = String(args.plate || "");
        confidence = Number(args.confidence) || 0;
      } catch (e) {
        console.error("tool_call parse failed", e, call.function.arguments);
      }
    }
    // Fallback: pull a plate-shaped token from the assistant text content.
    if (!plateRaw && typeof msg?.content === "string") {
      const m = msg.content.toUpperCase().match(/[A-Z0-9]{4,10}/);
      if (m) { plateRaw = m[0]; confidence = 0.5; }
    }
    const plate = plateRaw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!plate) {
      console.error("No plate parsed. AI response:", JSON.stringify(json).slice(0, 500));
      return { plate: null, confidence: 0, error: "No plate detected in image" };
    }
    return { plate, confidence, error: null as string | null };
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
