import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ImagePlus, Lightbulb, Loader2, RotateCcw, ShieldCheck, Sparkles, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, StateBox } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUser } from "@/lib/data";
import { getAiStatus } from "@/lib/server.functions";
import { analyzeOutfit, retryOutfitAnalysis } from "@/lib/outfit.functions";
import { OCCASION_MAX, outfitPath, validateOutfitFile, type OutfitMime } from "@/lib/outfit";

export const Route = createFileRoute("/_authenticated/estilo")({
  head: () => ({
    meta: [
      { title: "Analizar mi estilo — EVOLVE" },
      { name: "description", content: "Sube una foto de tu outfit y recibe consejos de estilo con IA, de forma privada." },
      { property: "og:title", content: "Analizar mi estilo — EVOLVE" },
      { property: "og:description", content: "Sube una foto de tu outfit y recibe consejos de estilo con IA, de forma privada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StylePage,
});

type Phase = { kind: "idle" } | { kind: "uploading"; pct: number } | { kind: "analyzing" };

/** Uploads straight to the user's private folder with real progress events. */
async function uploadWithProgress(path: string, file: File, onProgress: (pct: number) => void) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Tu sesión ha caducado. Vuelve a iniciar sesión.");
  const base = String(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, "");
  const url = `${base}/storage/v1/object/uploads/${path.split("/").map(encodeURIComponent).join("/")}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY));
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("No se pudo subir la foto.")));
    xhr.onerror = () => reject(new Error("Error de red al subir la foto."));
    xhr.send(file);
  });
}

function StylePage() {
  const { data: user } = useUser();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeOutfit);
  const retry = useServerFn(retryOutfitAnalysis);
  const aiStatus = useServerFn(getAiStatus);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [occasion, setOccasion] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const status = useQuery({ queryKey: ["ai-status"], queryFn: () => aiStatus(), staleTime: 60_000 });

  const list = useQuery({
    queryKey: ["outfit-analyses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outfit_analyses")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data.length) return [];
      // Short-lived signed links; the bucket is private and has no public URLs.
      const { data: signed } = await supabase.storage.from("uploads").createSignedUrls(data.map((d) => d.storage_path), 3600);
      const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      return data.map((d) => ({ ...d, url: byPath.get(d.storage_path) ?? null }));
    },
    refetchInterval: (q) => (q.state.data?.some((d) => d.status === "analyzing") ? 5000 : false),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!file || !user) throw new Error("Elige una foto primero.");
      const err = validateOutfitFile(file.type, file.size);
      if (err) throw new Error(err);
      const path = outfitPath(user.id, crypto.randomUUID(), file.type as OutfitMime);
      setPhase({ kind: "uploading", pct: 0 });
      await uploadWithProgress(path, file, (pct) => setPhase({ kind: "uploading", pct }));
      setPhase({ kind: "analyzing" });
      qc.invalidateQueries({ queryKey: ["outfit-analyses"] });
      return analyze({ data: { storagePath: path, occasion: occasion.trim() || null } });
    },
    onSuccess: (r) => {
      if (r.status === "completed") {
        toast.success("¡Análisis listo!");
        setFile(null);
        setOccasion("");
      } else if (r.status === "failed") toast.error(r.message);
      else {
        toast.error("La IA no está configurada.");
        qc.invalidateQueries({ queryKey: ["ai-status"] });
      }
    },
    onError: (e) => toast.error((e as Error).message || "No se pudo analizar la foto."),
    onSettled: () => {
      setPhase({ kind: "idle" });
      qc.invalidateQueries({ queryKey: ["outfit-analyses"] });
    },
  });

  const retryM = useMutation({
    mutationFn: (id: string) => retry({ data: { id } }),
    onSuccess: (r) => (r.status === "completed" ? toast.success("¡Análisis listo!") : r.status === "failed" ? toast.error(r.message) : toast.error("La IA no está configurada.")),
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => qc.invalidateQueries({ queryKey: ["outfit-analyses"] }),
  });

  const remove = useMutation({
    mutationFn: async (a: { id: string; storage_path: string }) => {
      const { error: sErr } = await supabase.storage.from("uploads").remove([a.storage_path]);
      if (sErr) throw new Error("No se pudo borrar la foto.");
      const { error } = await supabase.from("outfit_analyses").delete().eq("id", a.id);
      if (error) throw new Error("No se pudo borrar el análisis.");
    },
    onSuccess: () => toast.success("Foto y análisis eliminados."),
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => qc.invalidateQueries({ queryKey: ["outfit-analyses"] }),
  });

  const pick = (f: File | undefined) => {
    if (!f) return;
    const err = validateOutfitFile(f.type, f.size);
    setFileError(err);
    setFile(err ? null : f);
  };

  const busy = phase.kind !== "idle";
  const configured = status.data?.configured;

  return (
    <AppShell title="Analizar mi estilo">
      <p className="-mt-4 mb-6 flex gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        Tu foto se guarda de forma privada y solo tú puedes verla. La IA comenta tu ropa, colores y la ocasión; nunca tu físico, edad u otros rasgos personales.
      </p>

      {status.isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-card" />
      ) : status.error ? (
        <StateBox>No pudimos comprobar si la IA está disponible. Recarga la página.</StateBox>
      ) : !configured ? (
        <div role="alert" className="rounded-2xl border border-destructive/40 bg-card p-5">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-destructive" aria-hidden /> IA no configurada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            El análisis de estilo necesita un modelo de IA con visión conectado en el servidor (Lovable AI, clave <code>LOVABLE_API_KEY</code>). Hasta que se configure no subimos fotos ni mostramos resultados.
          </p>
        </div>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-5" aria-label="Nuevo análisis">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Seleccionar foto de outfit"
            onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border bg-background/40 p-6 text-sm text-muted-foreground transition-colors hover:border-primary disabled:opacity-60">
            {preview ? (
              <img src={preview} alt="Vista previa de tu outfit" className="max-h-72 rounded-lg object-contain" />
            ) : (
              <>
                <ImagePlus className="h-7 w-7 text-primary" aria-hidden />
                <span className="font-semibold text-foreground">Elige una foto de tu outfit</span>
                <span>JPG, PNG o WEBP · máx. 10 MB · mejor de cuerpo entero y con buena luz</span>
              </>
            )}
          </button>
          {preview && !busy && (
            <button type="button" className="mt-2 text-xs text-muted-foreground underline" onClick={() => fileRef.current?.click()}>Cambiar foto</button>
          )}
          {fileError && <p role="alert" className="mt-2 text-sm text-destructive">{fileError}</p>}

          <Label htmlFor="occasion" className="mt-5 block">Ocasión <span className="text-muted-foreground">(opcional)</span></Label>
          <Textarea id="occasion" value={occasion} maxLength={OCCASION_MAX} disabled={busy} onChange={(e) => setOccasion(e.target.value)}
            placeholder="Ej.: cena con amigos, entrevista de trabajo, día de oficina…" className="mt-2" rows={2} />

          {phase.kind === "uploading" && (
            <div className="mt-4" aria-live="polite">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Subiendo foto…</span><span>{phase.pct}%</span></div>
              <Progress value={phase.pct} aria-label="Progreso de subida" />
            </div>
          )}
          {phase.kind === "analyzing" && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden /> Analizando tu outfit… puede tardar unos segundos.
            </p>
          )}

          <Button onClick={() => submit.mutate()} disabled={!file || busy} className="mt-5 w-full bg-gradient-primary" size="lg">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Analizar outfit
          </Button>
        </section>
      )}

      <h2 className="mb-3 mt-10 text-xl font-semibold">Tus análisis</h2>
      {list.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-card" />
      ) : list.error ? (
        <StateBox>No pudimos cargar tus análisis.</StateBox>
      ) : !list.data?.length ? (
        <StateBox>Aún no has analizado ningún outfit.</StateBox>
      ) : (
        <ul className="space-y-4">
          {list.data.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-2xl border border-border bg-card md:flex">
              <div className="bg-muted md:w-56 md:shrink-0">
                {a.url ? <img src={a.url} alt="Tu outfit" className="aspect-[3/4] w-full object-cover" loading="lazy" /> : <div className="aspect-[3/4]" />}
              </div>
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    {a.occasion && <p className="mt-1 text-sm"><span className="text-muted-foreground">Ocasión:</span> {a.occasion}</p>}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button aria-label="Eliminar foto y análisis" className="p-1.5 text-muted-foreground hover:text-destructive" disabled={remove.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este análisis?</AlertDialogTitle>
                        <AlertDialogDescription>Se borrarán la foto y el resultado de forma permanente.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove.mutate(a)}>Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {a.status === "analyzing" ? (
                  <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden /> Analizando…</p>
                ) : a.status === "failed" ? (
                  <div className="mt-4">
                    <p className="text-sm text-destructive">{a.error_message ?? "El análisis falló."}</p>
                    {configured && (
                      <Button variant="secondary" size="sm" className="mt-3" disabled={retryM.isPending} onClick={() => retryM.mutate(a.id)}>
                        {retryM.isPending && retryM.variables === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reintentar
                      </Button>
                    )}
                  </div>
                ) : (
                  <Result summary={a.summary} strengths={a.strengths} improvements={a.improvements} recommendations={a.recommendations} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

const asList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function Result(p: { summary: string | null; strengths: unknown; improvements: unknown; recommendations: unknown }) {
  return (
    <div className="mt-3 space-y-4">
      {p.summary && <p className="text-sm">{p.summary}</p>}
      <Section icon={CheckCircle2} title="Lo que funciona" items={asList(p.strengths)} />
      <Section icon={Wrench} title="Qué puedes mejorar" items={asList(p.improvements)} />
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Lightbulb className="h-4 w-4 text-primary" aria-hidden /> 3 recomendaciones concretas</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          {asList(p.recommendations).map((r, i) => <li key={i}>{r}</li>)}
        </ol>
      </div>
      <p className="text-[11px] text-muted-foreground">Generado por IA a partir de tu foto. Tómalo como sugerencia, no como un juicio.</p>
    </div>
  );
}

function Section({ icon: Icon, title, items }: { icon: typeof CheckCircle2; title: string; items: string[] }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" aria-hidden /> {title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}
