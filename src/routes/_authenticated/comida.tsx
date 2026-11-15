import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, BookOpen, Camera, ImagePlus, Info, Loader2, Plus, RotateCcw, Save, Search, ShieldCheck, Sparkles, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, StateBox } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/lib/data";
import { localDate } from "@/lib/evolve";
import { getAiStatus } from "@/lib/server.functions";
import { analyzeFood, saveMeal } from "@/lib/nutrition.functions";
import { validateOutfitFile } from "@/lib/outfit";
import {
  CONFIDENCE_LABEL, MAX_GRAMS, MAX_ITEMS, MEAL_TYPES, REFERENCE_SOURCE, SOURCE_LABEL, defaultMealType, foodPath,
  itemFromReference, itemNutrition, itemsFromAi, mealTotals, searchReferenceFoods, type MealItem, type MealType, type Per100,
} from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/comida")({
  head: () => ({
    meta: [
      { title: "Analizar mi comida — EVOLVE" },
      { name: "description", content: "Haz una foto de tu plato y obtén una estimación de calorías y macros con IA que puedes corregir." },
      { property: "og:title", content: "Analizar mi comida — EVOLVE" },
      { property: "og:description", content: "Haz una foto de tu plato y obtén una estimación de calorías y macros con IA que puedes corregir." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FoodPage,
});

/** Shrinks the photo to a JPEG (max 1600 px) so analysis is fast and storage stays light. */
async function toJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("No pudimos procesar la imagen.");
  return blob;
}

async function blobToBase64(b: Blob) {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const nowLocalInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

type Draft = { items: MealItem[]; feedback: string | null; aiModel: string | null };

function FoodPage() {
  const { data: user } = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeFood);
  const save = useServerFn(saveMeal);
  const aiStatus = useServerFn(getAiStatus);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mealType, setMealType] = useState<MealType>(() => defaultMealType(new Date().getHours()));
  const [eatenAt, setEatenAt] = useState(nowLocalInput);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const u = URL.createObjectURL(photo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  const status = useQuery({ queryKey: ["ai-status"], queryFn: () => aiStatus(), staleTime: 60_000 });
  const configured = status.data?.configured;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const err = validateOutfitFile(f.type, f.size);
    setFileError(err);
    setAnalysisError(null);
    if (err) return;
    try {
      setPhoto(await toJpeg(f));
      setDraft(null);
    } catch {
      setFileError("No pudimos leer esta imagen. Prueba con otra foto.");
    }
  };

  const run = useMutation({
    mutationFn: async () => {
      if (!photo) throw new Error("Elige una foto primero.");
      setAnalysisError(null);
      return analyze({ data: { image: await blobToBase64(photo) } });
    },
    onSuccess: (r) => {
      if (r.status === "ok") {
        const items = itemsFromAi(r.items, () => crypto.randomUUID());
        if (!items.length) return setAnalysisError("La IA no identificó alimentos utilizables. Puedes añadirlos a mano.");
        setDraft({ items, feedback: r.feedback || null, aiModel: r.model });
      } else if (r.status === "failed") setAnalysisError(r.message);
      else {
        setAnalysisError("IA no configurada: no hay un modelo de visión conectado en el servidor.");
        qc.invalidateQueries({ queryKey: ["ai-status"] });
      }
    },
    onError: (e) => setAnalysisError((e as Error).message || "No se pudo analizar la foto."),
  });

  const saveM = useMutation({
    mutationFn: async () => {
      if (!draft || !user) throw new Error("No hay nada que guardar.");
      if (!draft.items.length) throw new Error("Añade al menos un alimento.");
      const when = new Date(eatenAt);
      if (Number.isNaN(when.getTime())) throw new Error("Indica una fecha y hora válidas.");
      let path: string | null = null;
      if (photo) {
        path = foodPath(user.id, crypto.randomUUID());
        const { error } = await supabase.storage.from("uploads").upload(path, photo, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error("No se pudo guardar la foto.");
      }
      try {
        return await save({
          data: {
            mealType, eatenAt: when.toISOString(), localDate: localDate(when), storagePath: path,
            items: draft.items, feedback: draft.feedback, aiModel: draft.aiModel,
          },
        });
      } catch (e) {
        if (path) await supabase.storage.from("uploads").remove([path]);
        throw e;
      }
    },
    onSuccess: () => {
      toast.success("Comida guardada en tu diario.");
      qc.invalidateQueries({ queryKey: ["meals"] });
      navigate({ to: "/diario" });
    },
    onError: (e) => toast.error((e as Error).message || "No se pudo guardar la comida."),
  });

  const reset = () => {
    setPhoto(null); setDraft(null); setAnalysisError(null); setFileError(null);
    setEatenAt(nowLocalInput()); setMealType(defaultMealType(new Date().getHours()));
  };

  const busy = run.isPending || saveM.isPending;

  return (
    <AppShell title="Analizar mi comida">
      <div className="-mt-3 mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="flex max-w-xl gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          Tu foto solo se guarda si guardas la comida, y solo tú puedes verla. Las cifras son estimaciones, no mediciones exactas, y no sustituyen el consejo de un profesional.
        </p>
        <Button asChild variant="secondary" size="sm"><Link to="/diario"><BookOpen className="h-4 w-4" /> Mi diario</Link></Button>
      </div>

      {!draft && (
        status.isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-card" />
        : status.error ? <StateBox>No pudimos comprobar si la IA está disponible. Recarga la página.</StateBox>
        : (
          <section className="rounded-2xl border border-border bg-card p-5" aria-label="Nueva foto">
            {!configured && (
              <div role="alert" className="mb-5 rounded-xl border border-destructive/40 bg-background/40 p-4">
                <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-destructive" aria-hidden /> IA no configurada</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  El análisis de fotos necesita un modelo de IA con visión conectado en el servidor (Lovable AI, clave <code>LOVABLE_API_KEY</code>). No mostramos resultados simulados; mientras tanto puedes registrar la comida a mano.
                </p>
              </div>
            )}
            <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"
              aria-label="Hacer una foto de tu comida" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              aria-label="Seleccionar foto de comida" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

            {configured && (
              <>
                <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background/40 p-4">
                  {preview ? <img src={preview} alt="Vista previa de tu comida" className="max-h-72 rounded-lg object-contain" /> : (
                    <div className="text-center text-sm text-muted-foreground">
                      <ImagePlus className="mx-auto mb-2 h-7 w-7 text-primary" aria-hidden />
                      <p className="font-semibold text-foreground">Fotografía tu plato</p>
                      <p>JPG, PNG o WEBP · máx. 10 MB · mejor desde arriba y con buena luz</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => cameraRef.current?.click()}><Camera className="h-4 w-4" /> Hacer foto</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /> {preview ? "Cambiar imagen" : "Subir imagen"}</Button>
                </div>
                {fileError && <p role="alert" className="mt-2 text-sm text-destructive">{fileError}</p>}
                {run.isPending && (
                  <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden /> Identificando alimentos y estimando porciones…
                  </p>
                )}
                {analysisError && !run.isPending && (
                  <div role="alert" className="mt-4 rounded-xl border border-destructive/40 p-3 text-sm">
                    <p className="text-destructive">{analysisError}</p>
                  </div>
                )}
                <Button onClick={() => run.mutate()} disabled={!photo || busy} className="mt-4 w-full bg-gradient-primary" size="lg">
                  {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : analysisError ? <RotateCcw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  {analysisError ? "Reintentar análisis" : "Analizar comida"}
                </Button>
              </>
            )}
            <button type="button" disabled={busy} onClick={() => { setPhoto(null); setDraft({ items: [], feedback: null, aiModel: null }); }}
              className="mt-3 w-full text-center text-sm text-muted-foreground underline hover:text-foreground">
              Registrar sin foto (a mano)
            </button>
          </section>
        )
      )}

      {draft && (
        <MealEditor
          draft={draft} setDraft={setDraft} preview={preview}
          mealType={mealType} setMealType={setMealType} eatenAt={eatenAt} setEatenAt={setEatenAt}
          saving={saveM.isPending} onSave={() => saveM.mutate()} onDiscard={reset}
        />
      )}
    </AppShell>
  );
}

function MealEditor(p: {
  draft: Draft; setDraft: (d: Draft) => void; preview: string | null;
  mealType: MealType; setMealType: (m: MealType) => void; eatenAt: string; setEatenAt: (s: string) => void;
  saving: boolean; onSave: () => void; onDiscard: () => void;
}) {
  const { draft, setDraft } = p;
  const totals = useMemo(() => mealTotals(draft.items), [draft.items]);
  const update = (id: string, patch: Partial<MealItem>) =>
    setDraft({ ...draft, items: draft.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const remove = (id: string) => setDraft({ ...draft, items: draft.items.filter((i) => i.id !== id) });
  const add = (item: MealItem) => {
    if (draft.items.length >= MAX_ITEMS) return toast.error(`Máximo ${MAX_ITEMS} alimentos por comida.`);
    setDraft({ ...draft, items: [...draft.items, item] });
  };
  const hasEstimates = draft.items.some((i) => i.source === "ia" || !i.gramsEdited);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5" aria-label="Resumen nutricional">
        <div className="flex gap-4">
          {p.preview && <img src={p.preview} alt="Tu comida" className="h-24 w-24 shrink-0 rounded-xl object-cover" />}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total estimado</p>
            <p className="text-3xl font-semibold" aria-live="polite">≈ {totals.kcal} <span className="text-base font-normal text-muted-foreground">kcal</span></p>
            {draft.items.length > 0 && (
              <p className="text-xs text-muted-foreground">Rango aproximado: {totals.kcalLow}–{totals.kcalHigh} kcal</p>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Macro label="Proteína" value={totals.protein} />
          <Macro label="Carbohidratos" value={totals.carbs} />
          <Macro label="Grasa" value={totals.fat} />
        </div>
        {hasEstimates && draft.items.length > 0 && (
          <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Las porciones de la foto son estimaciones visuales. Ajusta los gramos si los conoces para afinar el resultado.
          </p>
        )}
        {draft.feedback && (
          <div className="mt-4 rounded-xl bg-accent p-4 text-sm text-accent-foreground">
            <p className="mb-1 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4" aria-hidden /> Comentario de la IA</p>
            <p>{draft.feedback}</p>
            <p className="mt-2 text-[11px] opacity-80">Basado en la foto original; orientativo, no es consejo médico.</p>
          </div>
        )}
      </section>

      <section aria-label="Alimentos">
        <h2 className="mb-3 text-xl font-semibold">Alimentos</h2>
        {draft.items.length === 0 ? (
          <StateBox>Aún no hay alimentos. Añade los que hayas comido.</StateBox>
        ) : (
          <ul className="space-y-3">
            {draft.items.map((it) => <ItemRow key={it.id} item={it} onChange={(patch) => update(it.id, patch)} onRemove={() => remove(it.id)} />)}
          </ul>
        )}
        <AddFood onAdd={add} />
        <p className="mt-2 text-[11px] text-muted-foreground">Datos de referencia: valores medios por 100 g de {REFERENCE_SOURCE}; pueden variar según marca y preparación.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5" aria-label="Guardar en el diario">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="meal-type">Tipo de comida</Label>
            <select id="meal-type" value={p.mealType} onChange={(e) => p.setMealType(e.target.value as MealType)}
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {MEAL_TYPES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="eaten-at">Fecha y hora</Label>
            <Input id="eaten-at" type="datetime-local" value={p.eatenAt} max={new Date(Date.now() + 864e5).toISOString().slice(0, 16)}
              onChange={(e) => p.setEatenAt(e.target.value)} className="mt-2" />
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button onClick={p.onSave} disabled={p.saving || !draft.items.length} className="flex-1 bg-gradient-primary" size="lg">
            {p.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar en mi diario
          </Button>
          <Button variant="secondary" size="lg" onClick={p.onDiscard} disabled={p.saving}><X className="h-4 w-4" /> Descartar</Button>
        </div>
      </section>
    </div>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <p className="text-lg font-semibold">≈ {value} g</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

const num = (s: string) => { const n = Number(s.replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : 0; };

function ItemRow({ item, onChange, onRemove }: { item: MealItem; onChange: (p: Partial<MealItem>) => void; onRemove: () => void }) {
  const [editValues, setEditValues] = useState(false);
  const n = itemNutrition(item);
  const setPer = (k: keyof Per100, v: string) =>
    onChange({ source: "manual", referenceKey: null, per100: { ...item.per100, [k]: Math.min(k === "kcal" ? 900 : 100, num(v)) } });
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {item.source === "manual" ? (
            <Input aria-label="Nombre del alimento" value={item.name} maxLength={80} onChange={(e) => onChange({ name: e.target.value })} className="h-8" />
          ) : <p className="font-semibold">{item.name}</p>}
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            <span className={cn("rounded-full px-2 py-0.5", item.source === "referencia" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground")}>
              {SOURCE_LABEL[item.source]}
            </span>
            {item.confidence && !item.gramsEdited && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">Porción estimada · confianza {CONFIDENCE_LABEL[item.confidence]}</span>
            )}
          </div>
        </div>
        <button aria-label={`Quitar ${item.name}`} onClick={onRemove} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Input aria-label={`Gramos de ${item.name}`} type="number" inputMode="decimal" min={0} max={MAX_GRAMS} step={5}
            value={item.grams} onChange={(e) => onChange({ grams: Math.min(MAX_GRAMS, num(e.target.value)), gramsEdited: true })} className="h-9 w-24" />
          <span className="text-sm text-muted-foreground">g</span>
        </div>
        <p className="text-sm">
          <span className="font-semibold">≈ {Math.round(n.kcal)} kcal</span>
          <span className="text-muted-foreground"> · P {n.protein} g · C {n.carbs} g · G {n.fat} g</span>
        </p>
      </div>
      {item.source !== "referencia" && (
        <button type="button" onClick={() => setEditValues((v) => !v)} className="mt-2 text-xs text-muted-foreground underline">
          {editValues ? "Ocultar valores por 100 g" : "Ajustar valores por 100 g"}
        </button>
      )}
      {editValues && item.source !== "referencia" && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([["kcal", "kcal"], ["protein", "Proteína g"], ["carbs", "Carbohidratos g"], ["fat", "Grasa g"]] as const).map(([k, l]) => (
            <label key={k} className="text-[11px] text-muted-foreground">{l} / 100 g
              <Input type="number" inputMode="decimal" min={0} value={item.per100[k]} onChange={(e) => setPer(k, e.target.value)} className="mt-1 h-8" />
            </label>
          ))}
        </div>
      )}
    </li>
  );
}

function AddFood({ onAdd }: { onAdd: (i: MealItem) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const results = useMemo(() => searchReferenceFoods(q), [q]);
  if (!open) {
    return <Button variant="secondary" className="mt-3 w-full" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Añadir alimento</Button>;
  }
  const custom = () => {
    onAdd({
      id: crypto.randomUUID(), name: q.trim() || "Alimento", grams: 100, source: "manual", referenceKey: null,
      confidence: null, gramsEdited: false, per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    });
    setQ(""); setOpen(false);
  };
  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-4">
      <Label htmlFor="food-search">Buscar alimento</Label>
      <div className="relative mt-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id="food-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej.: arroz, pollo, aguacate…" className="pl-9" />
      </div>
      {q.trim() && (
        <ul className="mt-2 divide-y divide-border">
          {results.map((f) => (
            <li key={f.key}>
              <button type="button" className="flex w-full justify-between gap-3 py-2 text-left text-sm hover:text-primary"
                onClick={() => { const it = itemFromReference(f.key, crypto.randomUUID()); if (it) onAdd(it); setQ(""); setOpen(false); }}>
                <span>{f.name}</span><span className="shrink-0 text-muted-foreground">{f.kcal} kcal/100 g</span>
              </button>
            </li>
          ))}
          {!results.length && <li className="py-2 text-sm text-muted-foreground">No está en la tabla de referencia.</li>}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={custom} disabled={!q.trim()}>Añadir «{q.trim() || "…"}» con mis valores</Button>
        <Button size="sm" variant="ghost" onClick={() => { setQ(""); setOpen(false); }}>Cancelar</Button>
      </div>
    </div>
  );
}
