import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Loader2, Shirt, Trash2, UtensilsCrossed, Dumbbell, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, StateBox } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/analisis")({
  head: () => ({
    meta: [
      { title: "Análisis de imagen — EVOLVE" },
      { name: "description", content: "Sube fotos de tu outfit, comida o ejercicio de forma privada." },
      { property: "og:title", content: "Análisis de imagen — EVOLVE" },
      { property: "og:description", content: "Sube fotos de tu outfit, comida o ejercicio de forma privada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Analysis,
});

const CATS = [
  { id: "outfit", label: "Outfit", icon: Shirt },
  { id: "comida", label: "Comida", icon: UtensilsCrossed },
  { id: "ejercicio", label: "Ejercicio", icon: Dumbbell },
] as const;
type Cat = (typeof CATS)[number]["id"];

function Analysis() {
  const { data: user } = useUser();
  const qc = useQueryClient();
  const [cat, setCat] = useState<Cat>("outfit");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploads = useQuery({
    queryKey: ["uploads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("image_uploads").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      if (!data.length) return [];
      const { data: signed } = await supabase.storage.from("uploads").createSignedUrls(data.map((d) => d.storage_path), 3600);
      return data.map((d, i) => ({ ...d, url: signed?.[i]?.signedUrl }));
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("Solo se admiten imágenes.");
      if (file.size > 10 * 1024 * 1024) throw new Error("La imagen supera los 10 MB.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("uploads").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { error: dbErr } = await supabase.from("image_uploads").insert({ user_id: user!.id, category: cat, storage_path: path });
      if (dbErr) throw dbErr;
    },
    onSuccess: () => { toast.success("Imagen guardada de forma privada."); qc.invalidateQueries({ queryKey: ["uploads"] }); },
    onError: (e) => toast.error((e as Error).message || "No se pudo subir la imagen."),
  });

  const remove = useMutation({
    mutationFn: async (u: { id: string; storage_path: string }) => {
      await supabase.storage.from("uploads").remove([u.storage_path]);
      const { error } = await supabase.from("image_uploads").delete().eq("id", u.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["uploads"] }),
  });

  return (
    <AppShell title="Análisis de imagen">
      <div className="mb-6 rounded-xl border border-primary/30 bg-accent p-4 text-sm text-accent-foreground">
        <strong>Próximamente:</strong> el análisis con IA aún no está conectado. Tus fotos se guardan de forma privada, pero no generamos puntuaciones ni estimaciones de calorías.
      </div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Categoría">
        {CATS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="radio" aria-checked={cat === id} onClick={() => setCat(id)}
            className={cn("flex flex-col items-center gap-2 rounded-xl border p-4", cat === id ? "border-primary bg-accent" : "border-border bg-card")}>
            <Icon className="h-5 w-5 text-primary" aria-hidden />
            <span className="text-sm font-semibold">{label}</span>
          </button>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Seleccionar imagen"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
      <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending} className="mt-4 w-full bg-gradient-primary" size="lg">
        {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir foto
      </Button>

      <h2 className="mb-3 mt-10 text-xl font-semibold">Tus imágenes</h2>
      {uploads.isLoading ? <div className="h-32 animate-pulse rounded-2xl bg-card" />
        : uploads.error ? <StateBox>No pudimos cargar tus imágenes.</StateBox>
        : !uploads.data?.length ? <StateBox>Aún no has subido ninguna imagen.</StateBox>
        : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {uploads.data.map((u) => (
              <li key={u.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                {u.url ? <img src={u.url} alt={`Foto de ${u.category}`} className="aspect-square w-full object-cover" loading="lazy" /> : <div className="aspect-square bg-muted" />}
                <div className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-semibold capitalize">{u.category}</p>
                    <p className="text-xs text-muted-foreground">Análisis: Próximamente</p>
                  </div>
                  <button aria-label="Eliminar imagen" onClick={() => remove.mutate(u)} className="p-1.5 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
    </AppShell>
  );
}
