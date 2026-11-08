// Pure domain logic for EVOLVE (dates, levels, streaks, challenge generation).

export type Goal = "fitness" | "nutricion" | "estilo" | "confianza" | "habitos";
export type Intensity = "suave" | "media" | "intensa";

export const GOALS: { id: Goal; label: string; desc: string }[] = [
  { id: "fitness", label: "Fitness", desc: "Moverte más y ganar fuerza" },
  { id: "nutricion", label: "Nutrición", desc: "Comer con intención" },
  { id: "estilo", label: "Estilo", desc: "Cuidar tu imagen" },
  { id: "confianza", label: "Confianza", desc: "Hablar y actuar con seguridad" },
  { id: "habitos", label: "Hábitos", desc: "Rutinas que se sostienen" },
];

export const INTENSITIES: { id: Intensity; label: string; desc: string; count: number }[] = [
  { id: "suave", label: "Suave", desc: "3 retos al día", count: 3 },
  { id: "media", label: "Media", desc: "4 retos al día", count: 4 },
  { id: "intensa", label: "Intensa", desc: "5 retos al día", count: 5 },
];

export const XP_PER_LEVEL = 100;

/** Local calendar date (YYYY-MM-DD) in the user's timezone. */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return localDate(dt);
}

export function lastNDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

export function levelFromXp(total: number) {
  const level = Math.floor(total / XP_PER_LEVEL) + 1;
  const into = total % XP_PER_LEVEL;
  return { level, into, next: XP_PER_LEVEL, pct: Math.round((into / XP_PER_LEVEL) * 100) };
}

/** Consecutive days with activity ending today (or yesterday if today has none yet). */
export function currentStreak(activeDates: Iterable<string>, today: string): number {
  const set = new Set(activeDates);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(activeDates: Iterable<string>): number {
  const sorted = [...new Set(activeDates)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

type Template = { key: string; goal: Goal; title: string; description: string; xp: number };

export const CHALLENGE_TEMPLATES: Template[] = [
  { key: "fit-walk", goal: "fitness", title: "Camina 8.000 pasos", description: "Divide el paseo en dos bloques si te resulta más fácil.", xp: 20 },
  { key: "fit-pushups", goal: "fitness", title: "3 series de flexiones", description: "Hasta casi el fallo, con buena técnica. Apóyate en rodillas si lo necesitas.", xp: 25 },
  { key: "fit-stretch", goal: "fitness", title: "10 minutos de movilidad", description: "Caderas, hombros y espalda. Sin prisa.", xp: 15 },
  { key: "fit-stairs", goal: "fitness", title: "Escaleras en lugar de ascensor", description: "Todas las veces que puedas hoy.", xp: 10 },
  { key: "nut-water", goal: "nutricion", title: "Bebe 2 litros de agua", description: "Ten una botella a la vista durante el día.", xp: 15 },
  { key: "nut-veg", goal: "nutricion", title: "Verdura en dos comidas", description: "Que ocupe al menos medio plato.", xp: 20 },
  { key: "nut-nosugar", goal: "nutricion", title: "Día sin bebidas azucaradas", description: "Agua, café o infusiones.", xp: 20 },
  { key: "nut-protein", goal: "nutricion", title: "Proteína en el desayuno", description: "Huevos, yogur griego, legumbres o tofu.", xp: 15 },
  { key: "sty-outfit", goal: "estilo", title: "Prepara tu outfit de mañana", description: "Elige la ropa esta noche, completa y planchada.", xp: 15 },
  { key: "sty-groom", goal: "estilo", title: "Rutina de cuidado personal", description: "Piel, pelo y uñas: 10 minutos dedicados a ti.", xp: 15 },
  { key: "sty-closet", goal: "estilo", title: "Retira 3 prendas que no usas", description: "Dónalas o guárdalas fuera de tu vista.", xp: 20 },
  { key: "con-talk", goal: "confianza", title: "Inicia una conversación", description: "Con alguien con quien normalmente no hablarías.", xp: 25 },
  { key: "con-posture", goal: "confianza", title: "Postura consciente", description: "Revisa tu postura cada vez que mires el móvil.", xp: 10 },
  { key: "con-opinion", goal: "confianza", title: "Da tu opinión en voz alta", description: "En una reunión, clase o conversación grupal.", xp: 25 },
  { key: "con-journal", goal: "confianza", title: "Escribe 3 logros de hoy", description: "Pequeños cuentan. Anótalos antes de dormir.", xp: 15 },
  { key: "hab-sleep", goal: "habitos", title: "Acuéstate antes de las 23:30", description: "Sin pantallas los últimos 20 minutos.", xp: 20 },
  { key: "hab-phone", goal: "habitos", title: "Primera hora sin móvil", description: "Al despertar, nada de redes ni correo.", xp: 20 },
  { key: "hab-read", goal: "habitos", title: "Lee 15 minutos", description: "Papel o e-reader, sin notificaciones.", xp: 15 },
  { key: "hab-plan", goal: "habitos", title: "Planifica tu día en 5 minutos", description: "Tres prioridades, por escrito.", xp: 10 },
];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic set of challenges for a given user/date, balanced across chosen goals. */
export function generateChallenges(goals: Goal[], intensity: Intensity, date: string, seed = "") {
  const count = INTENSITIES.find((i) => i.id === intensity)?.count ?? 4;
  const chosen = goals.length ? goals : (GOALS.map((g) => g.id) as Goal[]);
  const pools = chosen.map((g) =>
    CHALLENGE_TEMPLATES.filter((t) => t.goal === g).sort(
      (a, b) => hash(seed + date + a.key) - hash(seed + date + b.key),
    ),
  );
  const out: Template[] = [];
  let round = 0;
  while (out.length < count && pools.some((p) => p.length > round)) {
    for (const p of pools) {
      if (out.length >= count) break;
      if (p[round]) out.push(p[round]);
    }
    round++;
  }
  const mult = intensity === "intensa" ? 1.2 : intensity === "suave" ? 0.8 : 1;
  return out.map((t) => ({ ...t, xp: Math.max(5, Math.round(t.xp * mult)) }));
}
