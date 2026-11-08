import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { GoalPicker, IntensityPicker } from "@/components/GoalPicker";
import { useUser } from "@/lib/data";
import type { Goal, Intensity } from "@/lib/evolve";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Configura tu perfil — EVOLVE" },
      { name: "description", content: "Elige tus objetivos y la intensidad de tus retos diarios." },
      { property: "og:title", content: "Configura tu perfil — EVOLVE" },
      { property: "og:description", content: "Elige tus objetivos y la intensidad de tus retos diarios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { data: user } = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [intensity, setIntensity] = useState<Intensity>("media");
  const [saving, setSaving] = useState(false);

  async function finish() {
    if (!user) return;
    setSaving(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: name.trim(), intensity, onboarded: true, updated_at: new Date().toISOString() });
      if (pErr) throw pErr;
      await supabase.from("goals").delete().eq("user_id", user.id);
      const { error: gErr } = await supabase.from("goals").insert(goals.map((goal) => ({ user_id: user.id, goal })));
      if (gErr) throw gErr;
      await qc.invalidateQueries();
      navigate({ to: "/dashboard" });
    } catch {
      toast.error("No pudimos guardar tu configuración. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const canNext = step === 0 ? name.trim().length >= 2 : step === 1 ? goals.length > 0 : true;

  return (
    <div className="min-h-screen bg-hero px-5 py-8">
      <div className="mx-auto max-w-xl">
        <Logo />
        <div className="mt-8 flex gap-2" aria-label={`Paso ${step + 1} de 3`}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <section className="mt-10">
          {step === 0 && (
            <>
              <h1 className="text-3xl font-semibold">¿Cómo quieres que te llamemos?</h1>
              <div className="mt-6 space-y-2">
                <Label htmlFor="name">Nombre visible</Label>
                <Input id="name" autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h1 className="text-3xl font-semibold">¿En qué quieres mejorar?</h1>
              <p className="mt-2 text-muted-foreground">Elige uno o varios. Puedes cambiarlo después.</p>
              <div className="mt-6"><GoalPicker value={goals} onChange={setGoals} /></div>
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="text-3xl font-semibold">¿Qué ritmo prefieres?</h1>
              <p className="mt-2 text-muted-foreground">Define cuántos retos recibirás cada día.</p>
              <div className="mt-6"><IntensityPicker value={intensity} onChange={setIntensity} /></div>
            </>
          )}
        </section>
        <div className="mt-10 flex justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Atrás</Button>
          {step < 2 ? (
            <Button disabled={!canNext} onClick={() => setStep(step + 1)} className="bg-gradient-primary">Continuar</Button>
          ) : (
            <Button disabled={saving} onClick={finish} className="bg-gradient-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Empezar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
