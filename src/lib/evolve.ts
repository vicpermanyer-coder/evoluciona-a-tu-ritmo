// Pure domain logic for EVOLVE (dates, levels, streaks, challenge generation).

export type Goal = "fitness" | "nutricion" | "confianza" | "estilo" | "disciplina" | "bienestar";
export type Intensity = "suave" | "media" | "intensa";

export const GOALS: { id: Goal; label: string; desc: string }[] = [
  { id: "fitness", label: "Fitness", desc: "Moverte más y ganar fuerza" },
  { id: "nutricion", label: "Alimentación saludable", desc: "Comer con intención" },
  { id: "confianza", label: "Confianza social", desc: "Hablar y actuar con seguridad" },
  { id: "estilo", label: "Estilo", desc: "Cuidar tu imagen" },
  { id: "disciplina", label: "Disciplina", desc: "Rutinas y foco que se sostienen" },
  { id: "bienestar", label: "Bienestar emocional", desc: "Calma, gratitud y conexión" },
];

/** Intensity sets how long each daily challenge takes and the XP it awards. */
export const INTENSITIES: { id: Intensity; label: string; desc: string; xp: number }[] = [
  { id: "suave", label: "Fácil", desc: "5–10 min por reto", xp: 10 },
  { id: "media", label: "Media", desc: "15–25 min por reto", xp: 20 },
  { id: "intensa", label: "Difícil", desc: "30–45 min por reto", xp: 30 },
];

export const DAILY_CHALLENGE_COUNT = 4;

const GOAL_IDS = new Set<string>(GOALS.map((g) => g.id));
/** Keeps only known goals; the retired "habitos" goal is read as "disciplina". */
export function normalizeGoals(goals: Iterable<string>): Goal[] {
  const out = new Set<Goal>();
  for (const g of goals) {
    const id = g === "habitos" ? "disciplina" : g;
    if (GOAL_IDS.has(id)) out.add(id as Goal);
  }
  return [...out];
}

export function goalLabel(id: string) {
  return GOALS.find((g) => g.id === (id === "habitos" ? "disciplina" : id))?.label ?? id;
}

export function intensityInfo(id: string) {
  return INTENSITIES.find((i) => i.id === id) ?? INTENSITIES[1]!;
}

export const XP_PER_LEVEL = 100;

/** Local calendar date (YYYY-MM-DD) in the user's timezone. */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, n: number): string {
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
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

/** Flags each challenge as done when a persisted completion exists for it. */
export function markCompleted<T extends { id: string }>(challenges: T[], completedIds: Iterable<string>) {
  const set = new Set(completedIds);
  return challenges.map((c) => ({ ...c, done: set.has(c.id) }));
}

export function countCompleted(challenges: { done: boolean }[]) {
  return challenges.filter((c) => c.done).length;
}

type Step = { title: string; description: string };
type Template = { key: string; goal: Goal; levels: Record<Intensity, Step> };

const t = (key: string, goal: Goal, suave: Step, media: Step, intensa: Step): Template => ({
  key,
  goal,
  levels: { suave, media, intensa },
});

/**
 * Curated challenge library (written by the EVOLVE team, not AI-generated).
 * Each challenge has a Fácil (5–10 min), Media (15–25 min) and Difícil (30–45 min) version.
 */
export const CHALLENGE_LIBRARY: Template[] = [
  // Fitness
  t("fit-walk", "fitness",
    { title: "Paseo de 10 minutos", description: "Sal a caminar a paso cómodo, con el móvil en el bolsillo." },
    { title: "Camina 20 minutos a paso vivo", description: "Un ritmo que te permita hablar, pero no cantar." },
    { title: "Caminata rápida de 40 minutos", description: "Incluye cuestas o escaleras si puedes." }),
  t("fit-strength", "fitness",
    { title: "5 minutos de fuerza básica", description: "2 rondas: 10 sentadillas y 5 flexiones (apoya las rodillas si lo necesitas)." },
    { title: "Circuito de fuerza de 20 minutos", description: "Sentadillas, flexiones, zancadas y plancha. 4 rondas con 1 minuto de descanso." },
    { title: "Entrenamiento de fuerza de 40 minutos", description: "Calienta, haz 5 ejercicios de cuerpo completo a 4 series y estira al final." }),
  t("fit-mobility", "fitness",
    { title: "8 minutos de movilidad", description: "Cuello, hombros, caderas y tobillos, con movimientos lentos." },
    { title: "15 minutos de estiramientos", description: "Mantén cada postura 30 segundos respirando con calma." },
    { title: "Sesión de yoga o movilidad de 30 minutos", description: "Sigue una clase guiada o tu propia rutina, sin prisas." }),
  t("fit-cardio", "fitness",
    { title: "Activa el pulso 5 minutos", description: "30 s de saltos o rodillas arriba, 30 s de descanso. Repite 5 veces." },
    { title: "Cardio de 20 minutos", description: "Bici, carrera suave, comba o natación a ritmo constante." },
    { title: "Intervalos de 35 minutos", description: "Tras calentar, 8 series de 1 min intenso y 2 min suave. Enfría al final." }),

  // Alimentación saludable
  t("nut-water", "nutricion",
    { title: "Prepara tu agua del día", description: "Llena una botella de 1,5–2 litros y déjala a la vista." },
    { title: "Planifica las comidas de mañana", description: "Desayuno, comida y cena con verdura y proteína. Apunta lo que falte." },
    { title: "Cocina en lote 40 minutos", description: "Prepara una proteína y una guarnición de verduras para varios días." }),
  t("nut-veg", "nutricion",
    { title: "Prepara un tentempié de fruta o verdura", description: "Corta fruta o crudités y llévalos contigo." },
    { title: "Comida con medio plato de verdura", description: "Salteado, horno o crema: la verdura es la protagonista." },
    { title: "Cocina una receta saludable nueva", description: "Con ingredientes frescos. Guarda una ración para mañana." }),
  t("nut-mindful", "nutricion",
    { title: "Una comida sin pantallas", description: "Mastica despacio y presta atención a los sabores." },
    { title: "Comida consciente de 20 minutos", description: "Deja los cubiertos entre bocados y para cuando estés saciado al 80 %." },
    { title: "Revisa tu despensa 30 minutos", description: "Aparta ultraprocesados, ordena y escribe una lista de compra saludable." }),
  t("nut-breakfast", "nutricion",
    { title: "Desayuno con proteína", description: "Huevos, yogur natural, queso fresco o legumbres." },
    { title: "Prepara tu táper de mañana", description: "Un plato equilibrado para no improvisar: verdura, proteína y cereal integral." },
    { title: "Compra saludable de la semana", description: "Con lista: verdura, fruta, proteína y legumbres. Evita el pasillo de bollería." }),

  // Confianza social
  t("con-talk", "confianza",
    { title: "Saluda a alguien nuevo", description: "Un saludo y una pregunta sencilla a un vecino, compañero o dependiente." },
    { title: "Conversación de 15 minutos", description: "Habla con alguien con quien normalmente no hablarías y haz preguntas abiertas." },
    { title: "Acude a un plan social", description: "Una clase, quedada o evento de grupo. Habla al menos con dos personas." }),
  t("con-voice", "confianza",
    { title: "Practica tu presentación", description: "Di en voz alta quién eres y a qué te dedicas en 30 segundos. Repite 5 veces." },
    { title: "Grábate hablando 2 minutos", description: "Sobre un tema que domines. Repite 3 veces mejorando ritmo y mirada." },
    { title: "Prepara y ensaya una mini charla", description: "Escribe un guion de 5 minutos y ensáyalo ante el espejo o alguien de confianza." }),
  t("con-opinion", "confianza",
    { title: "Da tu opinión una vez", description: "En una reunión, clase o chat de grupo, aporta tu punto de vista con calma." },
    { title: "Haz una petición que sueles evitar", description: "Pide un favor, un cambio o feedback. Prepara antes qué vas a decir." },
    { title: "Lidera un plan", description: "Propón y organiza una actividad, o modera una conversación de grupo." }),
  t("con-journal", "confianza",
    { title: "Anota 3 logros de hoy", description: "Los pequeños también cuentan. Escríbelos antes de dormir." },
    { title: "Repasa una situación social", description: "Qué pasó, qué hiciste bien y qué probarías la próxima vez." },
    { title: "Exposición gradual de 30 minutos", description: "Elige algo que te incomode un poco, como preguntar en una tienda, y repítelo varias veces." }),

  // Estilo
  t("sty-outfit", "estilo",
    { title: "Prepara tu outfit de mañana", description: "Elige la ropa completa y comprueba que está limpia y planchada." },
    { title: "Crea 3 combinaciones nuevas", description: "Con prendas que ya tienes. Haz una foto de cada look." },
    { title: "Planifica los looks de la semana", description: "5 conjuntos completos, con calzado y accesorios." }),
  t("sty-groom", "estilo",
    { title: "Rutina de cuidado básica", description: "Limpieza facial e hidratación." },
    { title: "Rutina de cuidado completa", description: "Piel, pelo, uñas y barba o maquillaje, sin prisa." },
    { title: "Sesión de autocuidado de 40 minutos", description: "Exfoliación, mascarilla, pelo y uñas. Deja lista la semana." }),
  t("sty-closet", "estilo",
    { title: "Retira 3 prendas que no usas", description: "Sepáralas para donar o vender." },
    { title: "Ordena un cajón o una balda", description: "Dobla, agrupa por colores y retira lo que no te queda bien." },
    { title: "Auditoría de armario", description: "Separa lo que usas, lo que hay que arreglar y lo que sobra. Anota los básicos que faltan." }),
  t("sty-care", "estilo",
    { title: "Limpia tus zapatos de diario", description: "Un paño húmedo y, si hace falta, crema o cepillo." },
    { title: "Arregla o plancha 3 prendas", description: "Botones, dobladillos o planchado de lo que llevas tiempo sin ponerte." },
    { title: "Define tu estilo en 30 minutos", description: "Guarda referencias de looks que te gusten y compara colores y cortes con tu armario." }),

  // Disciplina
  t("dis-plan", "disciplina",
    { title: "Planifica tu día en 5 minutos", description: "Tres prioridades, por escrito." },
    { title: "Revisión semanal de 20 minutos", description: "Repasa pendientes, agenda y define las 3 metas de la semana." },
    { title: "Bloque de concentración de 40 minutos", description: "Una sola tarea importante, con el móvil en otra habitación." }),
  t("dis-focus", "disciplina",
    { title: "10 minutos con la tarea que evitas", description: "Solo empezar. Pon un temporizador y no pares hasta que suene." },
    { title: "Un pomodoro de 25 minutos", description: "Trabajo sin interrupciones y 5 minutos de descanso al final." },
    { title: "Termina esa tarea pendiente", description: "Dedica 30–45 minutos a un trámite o tarea que llevas semanas aplazando." }),
  t("dis-phone", "disciplina",
    { title: "Limpia tu pantalla de inicio", description: "Mueve las apps que te distraen fuera de la primera pantalla." },
    { title: "20 minutos de lectura sin móvil", description: "Papel o e-reader, con las notificaciones silenciadas." },
    { title: "40 minutos sin pantallas", description: "Lee, ordena o sal a caminar con el móvil en modo avión." }),
  t("dis-tidy", "disciplina",
    { title: "Ordena tu espacio 10 minutos", description: "Mesa, escritorio o mesilla: deja solo lo que usas." },
    { title: "Limpieza a fondo de una zona", description: "20 minutos en una zona concreta: cocina, baño o escritorio." },
    { title: "Prepara tu rutina de mañana", description: "Deja listos ropa, comida y agenda, y acuéstate a una hora fija." }),

  // Bienestar emocional
  t("bie-breath", "bienestar",
    { title: "Respiración 4-6 durante 5 minutos", description: "Inhala 4 segundos y exhala 6, sentado y con los ojos cerrados." },
    { title: "Meditación guiada de 15 minutos", description: "Busca un lugar tranquilo y sigue una meditación guiada." },
    { title: "Meditación y escaneo corporal de 30 minutos", description: "Recorre el cuerpo de pies a cabeza soltando tensión." }),
  t("bie-journal", "bienestar",
    { title: "Escribe cómo te sientes", description: "Nombra la emoción y qué la provocó, sin juzgarla." },
    { title: "Diario de gratitud de 15 minutos", description: "Tres cosas por las que dar las gracias y por qué importan." },
    { title: "Escritura reflexiva de 30 minutos", description: "Escribe sin filtro sobre algo que te preocupa y termina con un paso pequeño que sí controlas." }),
  t("bie-nature", "bienestar",
    { title: "10 minutos de luz natural", description: "Sal fuera o ponte junto a una ventana, sin pantallas." },
    { title: "Paseo consciente de 20 minutos", description: "Fíjate en 5 cosas que ves, 4 que oyes y 3 que sientes." },
    { title: "40 minutos en la naturaleza", description: "Parque, playa o montaña, sin auriculares." }),
  t("bie-connect", "bienestar",
    { title: "Envía un mensaje de cariño", description: "A alguien que te importa, solo porque sí." },
    { title: "Llama a alguien querido", description: "15–20 minutos de conversación sin hacer otra cosa a la vez." },
    { title: "Haz algo que te recargue", description: "Música, dibujo, cocina o un baño: 30–40 minutos solo por disfrutar." }),
];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type GeneratedChallenge = { key: string; goal: Goal; title: string; description: string; xp: number };

/**
 * Picks the daily challenges from the library: always 4, spread across the chosen goals
 * (round-robin, goal order rotates by date) at the chosen intensity. Deterministic per seed/date.
 */
export function generateChallenges(goals: Iterable<string>, intensity: Intensity, date: string, seed = ""): GeneratedChallenge[] {
  const level = intensityInfo(intensity);
  const normalized = normalizeGoals(goals);
  const chosen = (normalized.length ? normalized : GOALS.map((g) => g.id)).sort(
    (a, b) => hash(seed + date + a) - hash(seed + date + b),
  );
  const pools = chosen.map((g) =>
    CHALLENGE_LIBRARY.filter((tpl) => tpl.goal === g).sort(
      (a, b) => hash(seed + date + a.key) - hash(seed + date + b.key),
    ),
  );
  const out: GeneratedChallenge[] = [];
  for (let round = 0; out.length < DAILY_CHALLENGE_COUNT && pools.some((p) => p.length > round); round++) {
    for (const p of pools) {
      if (out.length >= DAILY_CHALLENGE_COUNT) break;
      const tpl = p[round];
      if (!tpl) continue;
      const step = tpl.levels[level.id];
      out.push({ key: `${tpl.key}:${level.id}`, goal: tpl.goal, title: step.title, description: step.description, xp: level.xp });
    }
  }
  return out;
}

/** A client-supplied "local date" is plausible only within one day of the server's UTC date. */
export function isPlausibleLocalDate(date: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const utc = now.toISOString().slice(0, 10);
  return date === utc || date === addDays(utc, -1) || date === addDays(utc, 1);
}
