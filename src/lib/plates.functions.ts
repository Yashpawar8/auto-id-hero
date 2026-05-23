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
