import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useSignOut } from "@/components/AppShell";
import { GoalPicker, IntensityPicker } from "@/components/GoalPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useGoals, useProfile, useUser } from "@/lib/data";
import { deleteAccount } from "@/lib/server.functions";
import type { Goal, Intensity } from "@/lib/evolve";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — EVOLVE" },
      { name: "description", content: "Edita tu nombre, objetivos e intensidad, o gestiona tu cuenta." },
      { property: "og:title", content: "Perfil — EVOLVE" },
      { property: "og:description", content: "Edita tu nombre, objetivos e intensidad, o gestiona tu cuenta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const { data: savedGoals } = useGoals();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [name, setName] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [intensity, setIntensity] = useState<Intensity>("media");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profile) { setName(profile.display_name ?? ""); setIntensity(profile.intensity as Intensity); }
  }, [profile]);
  useEffect(() => { if (savedGoals) setGoals(savedGoals); }, [savedGoals]);

  async function save() {
    if (!user || name.trim().length < 2 || !goals.length) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ display_name: name.trim(), intensity, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (error) throw error;
      const { error: dErr } = await supabase.from("goals").delete().eq("user_id", user.id);
      if (dErr) throw dErr;
      const { error: gErr } = await supabase.from("goals").insert(goals.map((goal) => ({ user_id: user.id, goal })));
      if (gErr) throw gErr;
      await qc.invalidateQueries();
      toast.success("Perfil actualizado. Los nuevos objetivos se aplicarán a los retos de mañana.");
    } catch {
      toast.error("No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    setDeleting(true);
    try {
      await deleteAccount();
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      toast.success("Tu cuenta y tus datos se han eliminado.");
      navigate({ to: "/", replace: true });
    } catch {
      toast.error("No se pudo eliminar la cuenta.");
      setDeleting(false);
    }
  }

  return (
    <AppShell title="Perfil">
      <p className="-mt-4 mb-6 text-sm text-muted-foreground">{user?.email}</p>
      <section className="space-y-6 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="pname">Nombre visible</Label>
          <Input id="pname" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2"><Label>Objetivos</Label><GoalPicker value={goals} onChange={setGoals} /></div>
        <div className="space-y-2"><Label>Intensidad</Label><IntensityPicker value={intensity} onChange={setIntensity} /></div>
        <Button onClick={save} disabled={saving || name.trim().length < 2 || !goals.length} className="bg-gradient-primary">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cambios
        </Button>
      </section>

      <section className="mt-6 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={signOut}><LogOut className="h-4 w-4" /> Cerrar sesión</Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive"><Trash2 className="h-4 w-4" /> Eliminar cuenta y datos</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borrarán de forma permanente tu perfil, retos, hábitos, XP, conversaciones e imágenes. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={destroy} disabled={deleting} className="bg-destructive text-destructive-foreground">
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Eliminar definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </AppShell>
  );
}
