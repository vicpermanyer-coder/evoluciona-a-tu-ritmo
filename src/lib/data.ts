import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localDate, markCompleted, normalizeGoals } from "./evolve";
import { ensureDailyChallenges } from "./challenges.functions";

export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error("Sesión no válida");
      return data.user;
    },
    staleTime: 60_000,
  });
}

export function useProfile() {
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useGoals() {
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["goals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("goal").eq("user_id", user!.id);
      if (error) throw error;
      return normalizeGoals(data.map((g) => g.goal));
    },
  });
}

/**
 * Today's challenges for the user's local date. The set is created once per day on the server
 * from the curated library and then stays fixed, even if goals or intensity change later.
 */
export function useTodayChallenges() {
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const today = localDate();
  return useQuery({
    queryKey: ["challenges", user?.id, today],
    enabled: !!user && !!profile?.onboarded,
    queryFn: async () => {
      const load = () =>
        supabase
          .from("daily_challenges")
          .select("*")
          .eq("user_id", user!.id)
          .eq("challenge_date", today)
          .order("created_at")
          .order("template_key");
      let { data, error } = await load();
      if (error) throw error;
      if (!data?.length) {
        await ensureDailyChallenges({ data: { localDate: today } });
        ({ data, error } = await load());
        if (error) throw error;
      }
      // Completion state comes from the persisted completion records for this user and local day.
      const { data: comps, error: cErr } = await supabase
        .from("challenge_completions")
        .select("challenge_id")
        .eq("user_id", user!.id)
        .eq("completed_date", today);
      if (cErr) throw cErr;
      return markCompleted(data ?? [], comps.map((c) => c.challenge_id));
    },
  });
}

export function useXpEvents() {
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["xp", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("xp_events")
        .select("amount, event_date, source_type")
        .eq("user_id", user!.id)
        .order("event_date");
      if (error) throw error;
      return data;
    },
  });
}

export function useCompletions() {
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["completions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenge_completions")
        .select("completed_date")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((d) => d.completed_date);
    },
  });
}
