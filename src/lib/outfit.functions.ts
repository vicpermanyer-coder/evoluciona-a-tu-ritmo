import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  OCCASION_MAX,
  OUTFIT_MAX_BYTES,
  isOwnOutfitPath,
  normalizeOutfitResult,
  sniffImageMime,
  type OutfitMime,
} from "./outfit";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const STALE_MS = 3 * 60 * 1000;

type Outcome =
  | { status: "completed"; id: string }
  | { status: "failed"; id: string; message: string }
  | { status: "not_configured" };

const INSTRUCTIONS = [
  "Eres el asesor de estilo de EVOLVE. Analizas UNA foto de un outfit y respondes SIEMPRE en español, con un tono constructivo, respetuoso y motivador.",
  "Evalúa solo lo visible de la ropa y complementos: prendas, colores y su coordinación, ajuste aparente de las prendas (no del cuerpo), texturas, calzado, accesorios y adecuación a la ocasión indicada.",
  "PROHIBIDO: valorar o mencionar el atractivo físico, la belleza, el peso, la talla, medidas corporales, forma del cuerpo, edad, etnia, raza, color de piel, género, orientación, religión, discapacidad, salud u otras características personales o sensibles. No adivines nada sobre la persona. Si alguien aparece, habla solo de su ropa.",
  "Si la foto no muestra un outfit con claridad, marca outfit_visible=false y explica brevemente en summary qué foto conviene subir; deja las listas vacías.",
  "Formato: summary = 1-2 frases de valoración general. works = 2-4 puntos de lo que funciona. improve = 2-4 puntos de qué puede mejorar. recommendations = exactamente 3 recomendaciones concretas y prácticas (por ejemplo, cambiar una prenda, añadir un accesorio, ajustar colores), cada una de una o dos frases.",
].join("\n");

function createRunIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has("X-Lovable-AIG-Run-ID")) headers.set("X-Lovable-AIG-Run-ID", runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get("X-Lovable-AIG-Run-ID")?.trim() || undefined;
    return res;
  };
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function statusOf(e: unknown): number | undefined {
  for (let cur: unknown = e, i = 0; cur && i < 5; i++) {
    const s = (cur as { statusCode?: number }).statusCode;
    if (typeof s === "number") return s;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Calls the vision model and stores the result (or a clear failure) on the analysis row. */
async function runAnalysis(id: string, bytes: Uint8Array, mime: OutfitMime, occasion: string | null): Promise<Outcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const finish = async (patch: Record<string, unknown>) => {
    await supabaseAdmin
      .from("outfit_analyses")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
  };
  const fail = async (message: string): Promise<Outcome> => {
    await finish({ status: "failed", error_message: message });
    return { status: "failed", id, message };
  };

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return fail("La IA no está configurada en el servidor.");

  const { createOpenAI } = await import("@ai-sdk/openai");
  const { streamText, Output, NoObjectGeneratedError } = await import("ai");
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createRunIdFetch(),
  });
  const schema = z.object({
    outfit_visible: z.boolean(),
    summary: z.string(),
    works: z.array(z.string()),
    improve: z.array(z.string()),
    recommendations: z.array(z.string()),
  });

  try {
    const result = streamText({
      model: provider.responses(MODEL),
      instructions: INSTRUCTIONS,
      output: Output.object({ schema }),
      maxRetries: 0,
      abortSignal: getRequest()?.signal,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: occasion
                ? `Ocasión indicada por el usuario: "${occasion}". Analiza mi outfit para esa ocasión.`
                : "No he indicado ocasión. Analiza mi outfit y sugiere para qué ocasiones encaja.",
            },
            { type: "image", image: new URL(`data:${mime};base64,${toBase64(bytes)}`), mediaType: mime },
          ],
        },
      ],
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const raw = await result.output;
    if (!raw.outfit_visible) {
      return fail(raw.summary?.trim() || "No se ve un outfit con claridad. Prueba con una foto de cuerpo entero y buena luz.");
    }
    const norm = normalizeOutfitResult(raw);
    if (!norm) return fail("La IA no devolvió un análisis completo. Puedes reintentarlo.");
    await finish({ status: "completed", error_message: null, model: MODEL, ...norm });
    return { status: "completed", id };
  } catch (e) {
    const status = statusOf(e);
    console.error("outfit analysis error", status, e);
    if ((e as Error)?.name === "AbortError") return fail("El análisis se canceló. Puedes reintentarlo.");
    if (NoObjectGeneratedError.isInstance(e) && !status) return fail("La IA no pudo analizar esta foto.");
    if (status === 402) return fail("Se agotaron los créditos de IA del espacio de trabajo. Añade créditos para seguir analizando.");
    if (status === 403) return fail("El acceso a la IA está bloqueado para este espacio de trabajo.");
    if (status === 429) return fail("Demasiadas peticiones a la IA. Inténtalo en un momento.");
    if (status === 401) return fail("La clave de IA del servidor no es válida.");
    return fail("No se pudo completar el análisis. Inténtalo de nuevo.");
  }
}

/** Downloads the photo through the caller's own session, so storage access rules prove ownership. */
async function readOwnPhoto(
  supabase: { storage: { from: (b: string) => { download: (p: string) => Promise<{ data: Blob | null; error: unknown }> } } },
  path: string,
) {
  const { data, error } = await supabase.storage.from("uploads").download(path);
  if (error || !data) throw new Error("No encontramos tu foto.");
  if (data.size > OUTFIT_MAX_BYTES) throw new Error("La imagen supera los 10 MB.");
  const bytes = new Uint8Array(await data.arrayBuffer());
  const mime = sniffImageMime(bytes);
  if (!mime) throw new Error("Formato no admitido. Usa una foto JPG, PNG o WEBP.");
  return { bytes, mime };
}

export const analyzeOutfit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        storagePath: z.string().max(200),
        occasion: z.string().trim().max(OCCASION_MAX).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Outcome> => {
    const { supabase, userId } = context;
    if (!isOwnOutfitPath(data.storagePath, userId)) throw new Error("Ruta de foto no válida");
    const occasion = data.occasion || null;

    if (!process.env["LOVABLE_API_KEY"]) {
      await supabase.storage.from("uploads").remove([data.storagePath]);
      return { status: "not_configured" };
    }

    let photo: Awaited<ReturnType<typeof readOwnPhoto>>;
    try {
      photo = await readOwnPhoto(supabase, data.storagePath);
    } catch (e) {
      await supabase.storage.from("uploads").remove([data.storagePath]);
      throw e;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("outfit_analyses")
      .insert({ user_id: userId, storage_path: data.storagePath, mime_type: photo.mime, occasion, status: "analyzing" })
      .select("id")
      .single();
    if (error || !row) {
      console.error("outfit insert failed", error);
      throw new Error(error?.code === "23505" ? "Esta foto ya tiene un análisis." : "No se pudo guardar el análisis.");
    }
    return runAnalysis(row.id, photo.bytes, photo.mime, occasion);
  });

export const retryOutfitAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Outcome> => {
    const { supabase } = context;
    // RLS: only the owner can read this row.
    const { data: row, error } = await supabase
      .from("outfit_analyses")
      .select("id, storage_path, occasion, status, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Análisis no encontrado");
    if (row.status === "completed") return { status: "completed", id: row.id };
    if (row.status === "analyzing" && Date.now() - new Date(row.updated_at).getTime() < STALE_MS) {
      throw new Error("Este análisis ya está en curso.");
    }
    if (!process.env["LOVABLE_API_KEY"]) return { status: "not_configured" };

    const photo = await readOwnPhoto(supabase, row.storage_path);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Claim the row atomically so two retries cannot run (and bill) twice.
    const { data: claimed } = await supabaseAdmin
      .from("outfit_analyses")
      .update({ status: "analyzing", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("updated_at", row.updated_at)
      .select("id");
    if (!claimed?.length) throw new Error("Este análisis ya está en curso.");
    return runAnalysis(row.id, photo.bytes, photo.mime, row.occasion);
  });
