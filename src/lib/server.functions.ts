import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: Boolean(process.env.LOVABLE_API_KEY) };
});

export const sendCoachMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ conversationId: z.string().uuid(), content: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, title")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (convErr || !conv) throw new Error("Conversación no encontrada");

    const { error: insErr } = await supabase
      .from("messages")
      .insert({ conversation_id: conv.id, user_id: userId, role: "user", content: data.content });
    if (insErr) throw new Error("No se pudo guardar tu mensaje");

    if (conv.title === "Nueva conversación") {
      await supabase
        .from("conversations")
        .update({ title: data.content.slice(0, 60), updated_at: new Date().toISOString() })
        .eq("id", conv.id);
    } else {
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conv.id);
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { status: "not_configured" as const };

    const [{ data: history }, { data: profile }, { data: goals }] = await Promise.all([
      supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(40),
      supabase.from("profiles").select("display_name, intensity").eq("id", userId).maybeSingle(),
      supabase.from("goals").select("goal").eq("user_id", userId),
    ]);

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: GATEWAY,
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const instructions = `Eres el coach de EVOLVE, una app de mejora personal. Responde siempre en español, con calidez, de forma concreta y breve (máximo ~180 palabras), con pasos accionables. No des diagnósticos médicos. Usuario: ${profile?.display_name ?? "sin nombre"}. Objetivos: ${(goals ?? []).map((g) => g.goal).join(", ") || "no definidos"}. Intensidad: ${profile?.intensity ?? "media"}.`;

    let text = "";
    try {
      const result = streamText({
        model: provider.responses(MODEL),
        instructions,
        messages: (history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        abortSignal: getRequest()?.signal,
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
      text = (await result.text).trim();
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      console.error("coach error", status, e);
      if (status === 402) return { status: "error" as const, message: "Se agotaron los créditos de IA del espacio de trabajo." };
      if (status === 429) return { status: "error" as const, message: "Demasiadas peticiones. Inténtalo en un momento." };
      return { status: "error" as const, message: "El coach no pudo responder. Inténtalo de nuevo." };
    }
    if (!text) return { status: "error" as const, message: "El coach no devolvió respuesta." };

    const { error: aErr } = await supabase
      .from("messages")
      .insert({ conversation_id: conv.id, user_id: userId, role: "assistant", content: text });
    if (aErr) throw new Error("No se pudo guardar la respuesta");
    return { status: "ok" as const };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: files } = await supabase.storage.from("uploads").list(userId, { limit: 1000 });
    if (files?.length) await supabase.storage.from("uploads").remove(files.map((f) => `${userId}/${f.name}`));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error("No se pudo eliminar la cuenta");
    return { ok: true };
  });
