import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, StateBox } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/data";
import { lastNDays, localDate } from "@/lib/evolve";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/habitos")({
  head: () => ({
    meta: [
      { title: "Hábitos — EVOLVE" },
      { name: "description", content: "Crea hábitos, márcalos cada día y revisa tus últimos 7 días." },
      { property: "og:title", content: "Hábitos — EVOLVE" },
      { property: "og:description", content: "Crea hábitos, márcalos cada día y revisa tus últimos 7 días." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Habits,
});

const WEEKDAY = ["D", "L", "M", "X", "J", "V", "S"];

function Habits() {
  const { data: user } = useUser();
  const qc = useQueryClient();
  const today = localDate();
  const days = lastNDays(today, 7);
  const [name, setName] = useState("");

  const q = useQuery({
    queryKey: ["habits", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const [h, l] = await Promise.all([
        supabase.from("habits").select("*").eq("user_id", user!.id).order("created_at"),
        supabase.from("habit_logs").select("habit_id, log_date").eq("user_id", user!.id).gte("log_date", days[0]),
      ]);
      if (h.error) throw h.error;
      if (l.error) throw l.error;
      return { habits: h.data, logs: new Set(l.data.map((x) => `${x.habit_id}:${x.log_date}`)) };
    },
  });

  const add = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabase.from("habits").insert({ user_id: user!.id, name: n });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["habits"] }); },
    onError: () => toast.error("No se pudo crear el hábito."),
  });
  const toggle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("toggle_habit", { p_habit_id: id, p_local_date: today });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["habits"] }); qc.invalidateQueries({ queryKey: ["xp"] }); },
    onError: () => toast.error("No se pudo actualizar."),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) add.mutate(name.trim());
  }

  return (
    <AppShell title="Hábitos">
      <form onSubmit={submit} className="mb-6 flex gap-2">
        <label htmlFor="habit" className="sr-only">Nuevo hábito</label>
        <Input id="habit" maxLength={80} placeholder="Ej.: Meditar 5 minutos" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={!name.trim() || add.isPending} className="bg-gradient-primary">
          <Plus className="h-4 w-4" /> Añadir
        </Button>
      </form>
      <p className="mb-4 text-xs text-muted-foreground">Cada hábito marcado suma 5 XP (una vez por día).</p>

      {q.isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-card" />
      ) : q.error ? (
        <StateBox>No pudimos cargar tus hábitos.</StateBox>
      ) : !q.data?.habits.length ? (
        <StateBox>Aún no tienes hábitos. Crea el primero arriba.</StateBox>
      ) : (
        <ul className="space-y-3">
          {q.data.habits.map((h) => {
            const doneToday = q.data.logs.has(`${h.id}:${today}`);
            return (
              <li key={h.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggle.mutate(h.id)}
                    aria-pressed={doneToday}
                    aria-label={doneToday ? `Desmarcar ${h.name}` : `Marcar ${h.name} hoy`}
                    className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                      doneToday ? "border-success bg-success text-background" : "border-primary/60 hover:bg-accent")}
                  >
                    {doneToday && <Check className="h-4 w-4" />}
                  </button>
                  <span className="flex-1 font-semibold">{h.name}</span>
                  <button aria-label={`Eliminar ${h.name}`} onClick={() => remove.mutate(h.id)} className="p-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Últimos 7 días">
                  {days.map((d) => {
                    const on = q.data.logs.has(`${h.id}:${d}`);
                    const wd = WEEKDAY[new Date(d + "T12:00:00").getDay()];
                    return (
                      <div key={d} className="text-center">
                        <div className={cn("h-7 rounded-md", on ? "bg-primary" : "bg-muted")} title={`${d}: ${on ? "hecho" : "sin marcar"}`} />
                        <span className="text-[10px] text-muted-foreground">{wd}</span>
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
