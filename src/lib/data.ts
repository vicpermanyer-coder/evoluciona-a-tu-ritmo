import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateChallenges, localDate, markCompleted, type Goal, type Intensity } from "./evolve";

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
      return data.map((g) => g.goal as Goal);
    },
  });
}

/** Today's challenges for the user's local date; generates them once if missing. */
export function useTodayChallenges() {
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const { data: goals } = useGoals();
  const today = localDate();
  return useQuery({
    queryKey: ["challenges", user?.id, today],
    enabled: !!user && !!profile && !!goals,
    queryFn: async () => {
      const load = () =>
        supabase
          .from("daily_challenges")
          .select("*")
          .eq("user_id", user!.id)
          .eq("challenge_date", today)
          .order("created_at");
      let { data, error } = await load();
      if (error) throw error;
      if (!data.length) {
        const rows = generateChallenges(goals!, profile!.intensity as Intensity, today, user!.id).map((t) => ({
          user_id: user!.id,
          challenge_date: today,
          template_key: t.key,
          title: t.title,
          description: t.description,
          category: t.goal,
          xp: t.xp,
        }));
        const ins = await supabase
          .from("daily_challenges")
          .upsert(rows, { onConflict: "user_id,challenge_date,template_key", ignoreDuplicates: true });
        if (ins.error) throw ins.error;
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
