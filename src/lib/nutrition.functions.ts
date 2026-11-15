import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sniffImageMime, OUTFIT_MAX_BYTES } from "./outfit";
import {
  MAX_GRAMS, MAX_ITEMS, REFERENCE_FOODS, REFERENCE_KEYS, isOwnFoodPath, mealTotals, withReferenceData,
  type AiFoodItem, type MealItem,
} from "./nutrition";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export type FoodAnalysis =
  | { status: "ok"; items: AiFoodItem[]; feedback: string; model: string }
  | { status: "failed"; message: string }
  | { status: "not_configured" };

const INSTRUCTIONS = [
  "Eres el analizador nutricional de EVOLVE. Recibes UNA foto de comida y respondes SIEMPRE en español.",
  "Identifica cada alimento o bebida visible y estima su porción en gramos (o ml≈g para bebidas). Las cifras son estimaciones visuales, nunca medidas exactas.",
  "Si un alimento coincide razonablemente con uno de la lista de referencia, pon su clave en reference_key; si no, reference_key=null. Da siempre tu estimación de kcal, proteína, carbohidratos y grasa por 100 g. Incluye aceites o salsas visibles como elementos aparte.",
  "confidence indica cuán segura es la estimación de la porción: alta, media o baja.",
  "feedback: 2-3 frases constructivas y sin juicios sobre el equilibrio del plato (p. ej. verduras, proteína, fibra) con una idea práctica opcional. PROHIBIDO: inferir el estado de salud, el peso o el cuerpo de nadie, dar diagnósticos médicos o lenguaje culpabilizador.",
  "Si la foto no muestra comida con claridad, food_visible=false, explica en message qué foto subir y deja items vacío. Máximo 15 elementos.",
  "Lista de referencia (clave — nombre):",
  ...REFERENCE_FOODS.map((f) => `${f.key} — ${f.name}`),
].join("\n");

function statusOf(e: unknown): number | undefined {
  for (let cur: unknown = e, i = 0; cur && i < 5; i++) {
    const s = (cur as { statusCode?: number }).statusCode;
    if (typeof s === "number") return s;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

export const analyzeFood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ image: z.string().min(10).max(14_500_000) }).parse(d))
  .handler(async ({ data }): Promise<FoodAnalysis> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { status: "not_configured" };
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(data.image), (c) => c.charCodeAt(0));
    } catch {
      throw new Error("Imagen no válida.");
    }
    if (bytes.length > OUTFIT_MAX_BYTES) throw new Error("La imagen supera los 10 MB.");
    const mime = sniffImageMime(bytes);
    if (!mime) throw new Error("Formato no admitido. Usa una foto JPG, PNG o WEBP.");

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    let runId: string | undefined;
    const provider = createOpenAI({
      baseURL: GATEWAY,
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: async (input, init) => {
        const h = new Headers(init?.headers);
        if (runId) h.set("X-Lovable-AIG-Run-ID", runId);
        const res = await fetch(input, { ...init, headers: h });
        runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
        return res;
      },
    });
    const schema = z.object({
      food_visible: z.boolean(),
      message: z.string(),
      items: z.array(z.object({
        name: z.string(),
        reference_key: z.enum(REFERENCE_KEYS).nullable(),
        grams: z.number(),
        confidence: z.enum(["alta", "media", "baja"]),
        kcal_100g: z.number(),
        protein_100g: z.number(),
        carbs_100g: z.number(),
        fat_100g: z.number(),
      })),
      feedback: z.string(),
    });
    try {
      const result = streamText({
        model: provider.responses(MODEL),
        instructions: INSTRUCTIONS,
        output: Output.object({ schema }),
        maxRetries: 0,
        abortSignal: getRequest()?.signal,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Analiza los alimentos de esta foto." },
            { type: "image", image: new URL(`data:${mime};base64,${data.image}`), mediaType: mime },
          ],
        }],
        providerOptions: {
          openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
        },
      });
      const raw = await result.output;
      if (!raw.food_visible || !raw.items.length) {
        return { status: "failed", message: raw.message?.trim() || "No vemos comida con claridad. Prueba con una foto del plato desde arriba y con buena luz." };
      }
      return { status: "ok", items: raw.items, feedback: raw.feedback.trim().slice(0, 2000), model: MODEL };
    } catch (e) {
      const status = statusOf(e);
      console.error("food analysis error", status, e);
      if (NoObjectGeneratedError.isInstance(e) && !status) return { status: "failed", message: "La IA no pudo analizar esta foto." };
      if (status === 402) return { status: "failed", message: "Se agotaron los créditos de IA del espacio de trabajo." };
      if (status === 403) return { status: "failed", message: "El acceso a la IA está bloqueado para este espacio de trabajo." };
      if (status === 429) return { status: "failed", message: "Demasiadas peticiones a la IA. Inténtalo en un momento." };
      if (status === 401) return { status: "failed", message: "La clave de IA del servidor no es válida." };
      return { status: "failed", message: "No se pudo completar el análisis. Inténtalo de nuevo." };
    }
  });

const per100 = z.object({
  kcal: z.number().min(0).max(900), protein: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100), fat: z.number().min(0).max(100),
});
const itemSchema = z.object({
  id: z.string().max(64),
  name: z.string().trim().min(1).max(80),
  grams: z.number().min(0).max(MAX_GRAMS),
  source: z.enum(["referencia", "ia", "manual"]),
  referenceKey: z.string().max(60).nullable(),
  confidence: z.enum(["alta", "media", "baja"]).nullable(),
  gramsEdited: z.boolean(),
  per100,
});

export const saveMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      mealType: z.enum(["desayuno", "almuerzo", "comida", "merienda", "cena", "otro"]),
      eatenAt: z.string().datetime({ offset: true }),
      localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      storagePath: z.string().max(200).nullable(),
      items: z.array(itemSchema).min(1).max(MAX_ITEMS),
      feedback: z.string().max(2000).nullable(),
      aiModel: z.string().max(60).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.storagePath && !isOwnFoodPath(data.storagePath, userId)) throw new Error("Ruta de foto no válida");
    const eaten = new Date(data.eatenAt);
    const diffDays = Math.abs(eaten.getTime() - new Date(`${data.localDate}T12:00:00Z`).getTime()) / 864e5;
    if (diffDays > 1.5 || eaten.getTime() > Date.now() + 864e5) throw new Error("Fecha no válida");
    // Recalculate with the verified reference values on the server, never trusting sent totals.
    const items: MealItem[] = data.items.map((i) => withReferenceData(i));
    const t = mealTotals(items);
    const { data: row, error } = await supabase
      .from("meals")
      .insert({
        user_id: userId, meal_type: data.mealType, eaten_at: eaten.toISOString(), local_date: data.localDate,
        storage_path: data.storagePath, items, total_kcal: t.kcal, total_protein: t.protein, total_carbs: t.carbs,
        total_fat: t.fat, kcal_low: t.kcalLow, kcal_high: t.kcalHigh, feedback: data.feedback, ai_model: data.aiModel,
      })
      .select("id")
      .single();
    if (error || !row) {
      console.error("meal insert failed", error);
      throw new Error("No se pudo guardar la comida.");
    }
    return { id: row.id };
  });
