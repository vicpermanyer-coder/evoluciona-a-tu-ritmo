import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTodayChallenges } from "@/lib/data";
import { localDate } from "@/lib/evolve";
import { cn } from "@/lib/utils";
import { StateBox } from "./AppShell";

export function ChallengeList({ limit }: { limit?: number }) {
  const { data, isLoading, error, refetch } = useTodayChallenges();
  const qc = useQueryClient();
  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("complete_challenge", { p_challenge_id: id, p_local_date: localDate() });
      if (error) throw error;
      return data as { awarded: boolean; xp: number };
    },
    onSuccess: (r, id) => {
      if (r.awarded) toast.success(`¡Reto completado! +${r.xp} XP`);
      // Update the shared cache right away so the dashboard counter and bar reflect it instantly.
      qc.setQueriesData<{ id: string; done: boolean }[]>({ queryKey: ["challenges"] }, (old) =>
        old?.map((c) => (c.id === id ? { ...c, done: true } : c)),
      );
      qc.invalidateQueries({ queryKey: ["challenges"] });
      qc.invalidateQueries({ queryKey: ["xp"] });
      qc.invalidateQueries({ queryKey: ["completions"] });
    },
    onError: () => toast.error("No se pudo completar el reto."),
  });

  if (isLoading) return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-card" />)}</div>;
  if (error)
    return (
      <StateBox>
        No pudimos cargar tus retos.{" "}
        <button className="font-semibold text-primary" onClick={() => refetch()}>Reintentar</button>
      </StateBox>
    );
  if (!data?.length) return <StateBox>No hay retos para hoy.</StateBox>;

  return (
    <ul className="space-y-3">
      {data.slice(0, limit).map((c) => (
        <li key={c.id} className={cn("flex items-start gap-4 rounded-2xl border border-border bg-card p-4 transition-opacity", c.done && "opacity-70")}>
          <button
            aria-label={c.done ? `${c.title}: completado` : `Completar ${c.title}`}
            disabled={c.done || complete.isPending}
            onClick={() => complete.mutate(c.id)}
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all",
              c.done ? "border-success bg-success text-background" : "border-primary/60 hover:bg-accent",
            )}
          >
            {complete.isPending && complete.variables === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : c.done && <Check className="h-4 w-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={cn("font-semibold", c.done && "line-through")}>{c.title}</p>
            <p className="text-sm text-muted-foreground">{c.description}</p>
          </div>
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">+{c.xp} XP</span>
        </li>
      ))}
    </ul>
  );
}
