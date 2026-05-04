import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Guess } from "./types";

const client = new Anthropic();

const GuessSchema = z.object({
  label: z.string(),
  brand: z.string().optional(),
  model: z.string().optional(),
  category: z.string().optional(),
  confidence: z.number().min(0).max(1),
  search_query: z.string(),
  notes: z.string().optional(),
});

const ResponseSchema = z.object({ guesses: z.array(GuessSchema).min(1).max(8) });

const SYSTEM = `You identify items from photos for a resale-flipping app. The user is at a thrift store or yard sale and needs to know what something is and what to search for on eBay.

Return up to 5 guesses, ranked by likelihood. For each guess:
- "label": short human-readable name
- "brand"/"model": only if clearly identifiable (logo, marking, signature, label)
- "category": a broad category like "vintage pottery", "designer handbag", "vinyl record"
- "confidence": 0..1, calibrated honestly
- "search_query": the exact eBay search string a flipper would type — include identifying details (brand, model, era, material) but NOT condition words. Aim for queries that return useful comps, not zero results.
- "notes": one sentence on what to verify (markings to check, common fakes, condition cues)

Be specific where you can be, vague where you can't. A "no-name ceramic vase" with confidence 0.3 is more useful than a confidently-wrong "Ming dynasty vase".`;

export async function identifyItem(imageBase64: string, mediaType: string): Promise<Guess[]> {
  const message = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as any, data: imageBase64 },
          },
          {
            type: "text",
            text: 'Identify this item. Respond ONLY with JSON of shape {"guesses":[...]} matching the schema in the system prompt.',
          },
        ],
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No text response from model");

  const json = extractJson(text.text);
  const parsed = ResponseSchema.parse(json);
  return parsed.guesses;
}

function extractJson(s: string): unknown {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : s;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model did not return JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}
