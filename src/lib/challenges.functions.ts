import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateChallenges, isPlausibleLocalDate, type Intensity } from "./evolve";

/**
 * Creates the signed-in user's challenges for their local day from the curated library,
 * only if that day has none yet. An existing day is never changed, so completed
 * challenges and their XP stay put when preferences change.
 */
export const ensureDailyChallenges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ localDate: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!isPlausibleLocalDate(data.localDate)) throw new Error("Fecha no válida");

    const [{ data: profile, error: pErr }, { data: goals, error: gErr }] = await Promise.all([
      supabase.from("profiles").select("intensity").eq("id", userId).maybeSingle(),
      supabase.from("goals").select("goal").eq("user_id", userId),
    ]);
    if (pErr || gErr || !profile) throw new Error("No se pudieron leer tus preferencias");

    const rows = generateChallenges(
      (goals ?? []).map((g) => g.goal),
      profile.intensity as Intensity,
      data.localDate,
      userId,
    ).map((c) => ({ template_key: c.key, title: c.title, description: c.description, category: c.goal, xp: c.xp }));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin.rpc("insert_daily_challenges", {
      p_user_id: userId,
      p_date: data.localDate,
      p_rows: rows,
    });
    if (error) {
      console.error("insert_daily_challenges failed", error);
      throw new Error("No se pudieron preparar tus retos de hoy");
    }
    return { inserted: inserted ?? 0 };
  });
