// Client-safe rules for the food analyzer and diary (shared by the screens and the server).

/**
 * Average values per 100 g (edible portion) from USDA FoodData Central, SR Legacy.
 * Real foods vary with brand, variety and cooking, so even these are approximations.
 */
export const REFERENCE_SOURCE = "USDA FoodData Central (SR Legacy)";

export type Per100 = { kcal: number; protein: number; carbs: number; fat: number };
export type ReferenceFood = Per100 & { key: string; name: string };

const R = (key: string, name: string, kcal: number, protein: number, carbs: number, fat: number): ReferenceFood => ({
  key, name, kcal, protein, carbs, fat,
});

export const REFERENCE_FOODS: ReferenceFood[] = [
  // Cereales y tubérculos
  R("arroz_blanco_cocido", "Arroz blanco cocido", 130, 2.7, 28.2, 0.3),
  R("arroz_integral_cocido", "Arroz integral cocido", 112, 2.3, 23.5, 0.8),
  R("pasta_cocida", "Pasta cocida", 158, 5.8, 30.9, 0.9),
  R("cuscus_cocido", "Cuscús cocido", 112, 3.8, 23.2, 0.2),
  R("quinoa_cocida", "Quinoa cocida", 120, 4.4, 21.3, 1.9),
  R("pan_blanco", "Pan blanco", 266, 7.6, 50.6, 3.3),
  R("pan_integral", "Pan integral", 252, 12.4, 42.7, 3.5),
  R("croissant", "Cruasán de mantequilla", 406, 8.2, 45.8, 21.0),
  R("copos_avena", "Copos de avena (en crudo)", 389, 16.9, 66.3, 6.9),
  R("cereales_maiz", "Copos de maíz (cereales)", 357, 7.5, 84.0, 0.4),
  R("patata_cocida", "Patata cocida", 87, 1.9, 20.1, 0.1),
  R("patatas_fritas", "Patatas fritas", 312, 3.4, 41.4, 14.7),
  R("boniato_asado", "Boniato asado", 90, 2.0, 20.7, 0.2),
  R("maiz_dulce_cocido", "Maíz dulce cocido", 96, 3.4, 21.0, 1.5),
  // Proteínas
  R("pechuga_pollo", "Pechuga de pollo cocinada (sin piel)", 165, 31.0, 0, 3.6),
  R("muslo_pollo", "Muslo de pollo cocinado (sin piel)", 209, 26.0, 0, 10.9),
  R("carne_picada_ternera", "Carne picada de ternera (90 % magra), cocinada", 217, 26.1, 0, 11.8),
  R("lomo_cerdo", "Solomillo de cerdo asado", 143, 26.2, 0, 3.5),
  R("jamon_cocido", "Jamón cocido", 163, 16.6, 3.8, 8.6),
  R("salmon", "Salmón cocinado", 206, 22.1, 0, 12.4),
  R("pescado_blanco", "Bacalao o pescado blanco cocinado", 105, 22.8, 0, 0.9),
  R("atun_al_natural", "Atún en lata al natural (escurrido)", 116, 25.5, 0, 0.8),
  R("atun_en_aceite", "Atún en lata en aceite (escurrido)", 198, 29.1, 0, 8.2),
  R("gambas_cocidas", "Gambas cocidas", 99, 24.0, 0.2, 0.3),
  R("huevo_cocido", "Huevo cocido", 155, 12.6, 1.1, 10.6),
  R("huevo_frito", "Huevo frito", 196, 13.6, 0.8, 14.8),
  R("tofu_firme", "Tofu firme", 144, 17.3, 2.8, 8.7),
  R("lentejas_cocidas", "Lentejas cocidas", 116, 9.0, 20.1, 0.4),
  R("garbanzos_cocidos", "Garbanzos cocidos", 164, 8.9, 27.4, 2.6),
  R("alubias_cocidas", "Alubias negras cocidas", 132, 8.9, 23.7, 0.5),
  R("hummus", "Hummus", 166, 7.9, 14.3, 9.6),
  // Lácteos
  R("leche_entera", "Leche entera", 61, 3.2, 4.8, 3.3),
  R("leche_semidesnatada", "Leche semidesnatada", 50, 3.3, 4.8, 2.0),
  R("yogur_natural", "Yogur natural", 61, 3.5, 4.7, 3.3),
  R("yogur_griego_desnatado", "Yogur griego natural desnatado", 59, 10.2, 3.6, 0.4),
  R("queso_curado", "Queso curado (tipo cheddar)", 403, 24.9, 1.3, 33.1),
  R("mozzarella", "Mozzarella", 300, 22.2, 2.2, 22.4),
  R("queso_cottage", "Queso cottage", 98, 11.1, 3.4, 4.3),
  // Verduras
  R("lechuga", "Lechuga", 17, 1.2, 3.3, 0.3),
  R("tomate", "Tomate", 18, 0.9, 3.9, 0.2),
  R("pepino", "Pepino", 15, 0.7, 3.6, 0.1),
  R("zanahoria", "Zanahoria cruda", 41, 0.9, 9.6, 0.2),
  R("brocoli_cocido", "Brócoli cocido", 35, 2.4, 7.2, 0.4),
  R("espinacas", "Espinacas crudas", 23, 2.9, 3.6, 0.4),
  R("pimiento_rojo", "Pimiento rojo crudo", 31, 1.0, 6.0, 0.3),
  R("cebolla", "Cebolla cruda", 40, 1.1, 9.3, 0.1),
  R("calabacin", "Calabacín", 17, 1.2, 3.1, 0.3),
  R("champinones", "Champiñones", 22, 3.1, 3.3, 0.3),
  R("judias_verdes_cocidas", "Judías verdes cocidas", 35, 1.9, 7.9, 0.3),
  R("aguacate", "Aguacate", 160, 2.0, 8.5, 14.7),
  // Frutas
  R("manzana", "Manzana", 52, 0.3, 13.8, 0.2),
  R("platano", "Plátano", 89, 1.1, 22.8, 0.3),
  R("naranja", "Naranja", 47, 0.9, 11.8, 0.1),
  R("fresas", "Fresas", 32, 0.7, 7.7, 0.3),
  R("uvas", "Uvas", 69, 0.7, 18.1, 0.2),
  R("arandanos", "Arándanos", 57, 0.7, 14.5, 0.3),
  R("pera", "Pera", 57, 0.4, 15.2, 0.1),
  R("pina", "Piña", 50, 0.5, 13.1, 0.1),
  R("sandia", "Sandía", 30, 0.6, 7.6, 0.2),
  R("kiwi", "Kiwi", 61, 1.1, 14.7, 0.5),
  // Grasas, frutos secos y otros
  R("aceite_oliva", "Aceite de oliva", 884, 0, 0, 100),
  R("mantequilla", "Mantequilla", 717, 0.9, 0.1, 81.1),
  R("mayonesa", "Mayonesa", 680, 1.0, 0.6, 74.9),
  R("almendras", "Almendras", 579, 21.2, 21.6, 49.9),
  R("nueces", "Nueces", 654, 15.2, 13.7, 65.2),
  R("crema_cacahuete", "Crema de cacahuete", 588, 25.1, 19.6, 50.4),
  R("chocolate_negro", "Chocolate negro (70–85 %)", 598, 7.8, 45.9, 42.6),
  R("miel", "Miel", 304, 0.3, 82.4, 0),
  R("azucar", "Azúcar", 387, 0, 100, 0),
  R("pizza_queso", "Pizza de queso (masa normal)", 266, 11.4, 33.3, 9.7),
  R("zumo_naranja", "Zumo de naranja", 45, 0.7, 10.4, 0.2),
  R("cerveza", "Cerveza", 43, 0.5, 3.6, 0),
  R("vino_tinto", "Vino tinto", 85, 0.1, 2.6, 0),
];

const BY_KEY = new Map(REFERENCE_FOODS.map((f) => [f.key, f]));
export const REFERENCE_KEYS = REFERENCE_FOODS.map((f) => f.key) as [string, ...string[]];
export const referenceFood = (key: string | null | undefined) => (key ? BY_KEY.get(key) : undefined);

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function searchReferenceFoods(q: string, limit = 8): ReferenceFood[] {
  const t = fold(q.trim());
  if (!t) return [];
  return REFERENCE_FOODS.filter((f) => fold(f.name).includes(t)).slice(0, limit);
}

// ---------- Meal items and totals ----------

export type FoodSource = "referencia" | "ia" | "manual";
export type Confidence = "alta" | "media" | "baja";
export type MealItem = {
  id: string;
  name: string;
  grams: number;
  source: FoodSource;
  referenceKey: string | null;
  /** How sure the AI was about the portion; null for foods the user added. */
  confidence: Confidence | null;
  /** True once the user has typed the grams themselves. */
  gramsEdited: boolean;
  per100: Per100;
};

export const MAX_GRAMS = 2000;
export const MAX_ITEMS = 40;

export const SOURCE_LABEL: Record<FoodSource, string> = {
  referencia: "Dato de referencia",
  ia: "Estimación de la IA",
  manual: "Valores tuyos",
};
export const CONFIDENCE_LABEL: Record<Confidence, string> = { alta: "alta", media: "media", baja: "baja" };

const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

export function itemNutrition(item: Pick<MealItem, "grams" | "per100">): Per100 {
  const f = clamp(item.grams, 0, MAX_GRAMS) / 100;
  return {
    kcal: r1(item.per100.kcal * f),
    protein: r1(item.per100.protein * f),
    carbs: r1(item.per100.carbs * f),
    fat: r1(item.per100.fat * f),
  };
}

const PORTION_UNCERTAINTY: Record<Confidence, number> = { alta: 0.15, media: 0.25, baja: 0.4 };
const DATA_UNCERTAINTY: Record<FoodSource, number> = { referencia: 0.05, ia: 0.2, manual: 0 };

/**
 * Rough relative uncertainty of an item's calories: how sure we are about the grams
 * (zero once the user typed them) plus how reliable the per-100 g values are.
 */
export function itemUncertainty(item: Pick<MealItem, "source" | "confidence" | "gramsEdited">): number {
  const portion = item.gramsEdited ? 0 : PORTION_UNCERTAINTY[item.confidence ?? "media"];
  return portion + DATA_UNCERTAINTY[item.source];
}

export type MealTotals = Per100 & { kcalLow: number; kcalHigh: number };

export function mealTotals(items: MealItem[]): MealTotals {
  let kcal = 0, protein = 0, carbs = 0, fat = 0, low = 0, high = 0;
  for (const it of items) {
    const n = itemNutrition(it);
    const u = itemUncertainty(it);
    kcal += n.kcal; protein += n.protein; carbs += n.carbs; fat += n.fat;
    low += n.kcal * Math.max(0, 1 - u);
    high += n.kcal * (1 + u);
  }
  return {
    kcal: Math.round(kcal), protein: r1(protein), carbs: r1(carbs), fat: r1(fat),
    kcalLow: Math.round(low), kcalHigh: Math.round(high),
  };
}

const sanePer100 = (p: Per100): Per100 => ({
  kcal: r1(clamp(p.kcal, 0, 900)),
  protein: r1(clamp(p.protein, 0, 100)),
  carbs: r1(clamp(p.carbs, 0, 100)),
  fat: r1(clamp(p.fat, 0, 100)),
});

/** Uses the verified reference values whenever the food matches one; otherwise keeps (sane) estimates. */
export function withReferenceData(item: MealItem): MealItem {
  const ref = item.source === "referencia" ? referenceFood(item.referenceKey) : undefined;
  if (item.source === "referencia" && !ref) {
    return { ...item, source: "manual", referenceKey: null, per100: sanePer100(item.per100) };
  }
  const grams = Math.round(clamp(item.grams, 0, MAX_GRAMS));
  if (ref) return { ...item, grams, per100: { kcal: ref.kcal, protein: ref.protein, carbs: ref.carbs, fat: ref.fat } };
  return { ...item, grams, referenceKey: null, per100: sanePer100(item.per100) };
}

export type AiFoodItem = {
  name: string;
  reference_key: string | null;
  grams: number;
  confidence: Confidence;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
};

/** Turns the model's answer into editable items, preferring reference data over AI guesses. */
export function itemsFromAi(raw: AiFoodItem[], makeId: () => string): MealItem[] {
  return raw
    .filter((r) => r.name?.trim() && Number.isFinite(r.grams) && r.grams > 0)
    .slice(0, 15)
    .map((r) => {
      const ref = referenceFood(r.reference_key);
      return withReferenceData({
        id: makeId(),
        name: r.name.trim().slice(0, 80),
        grams: r.grams,
        source: ref ? "referencia" : "ia",
        referenceKey: ref?.key ?? null,
        confidence: r.confidence,
        gramsEdited: false,
        per100: { kcal: r.kcal_100g, protein: r.protein_100g, carbs: r.carbs_100g, fat: r.fat_100g },
      });
    });
}

export function itemFromReference(key: string, id: string, grams = 100): MealItem | null {
  const ref = referenceFood(key);
  if (!ref) return null;
  return {
    id, name: ref.name, grams, source: "referencia", referenceKey: ref.key, confidence: null, gramsEdited: false,
    per100: { kcal: ref.kcal, protein: ref.protein, carbs: ref.carbs, fat: ref.fat },
  };
}

// ---------- Meals ----------

export const MEAL_TYPES = [
  { id: "desayuno", label: "Desayuno" },
  { id: "almuerzo", label: "Almuerzo" },
  { id: "comida", label: "Comida" },
  { id: "merienda", label: "Merienda" },
  { id: "cena", label: "Cena" },
  { id: "otro", label: "Otro / picoteo" },
] as const;
export type MealType = (typeof MEAL_TYPES)[number]["id"];
export const mealTypeLabel = (id: string) => MEAL_TYPES.find((m) => m.id === id)?.label ?? "Comida";

export function defaultMealType(hour: number): MealType {
  if (hour >= 5 && hour < 11) return "desayuno";
  if (hour >= 11 && hour < 13) return "almuerzo";
  if (hour >= 13 && hour < 17) return "comida";
  if (hour >= 17 && hour < 20) return "merienda";
  if (hour >= 20 || hour < 1) return "cena";
  return "otro";
}

/** Food photos live flat in the user's own private folder: `<userId>/food-<uuid>.jpg`. */
export function foodPath(userId: string, id: string) {
  return `${userId}/food-${id}.jpg`;
}
export function isOwnFoodPath(path: string, userId: string) {
  const m = /^([0-9a-f-]{36})\/food-[0-9a-f-]{36}\.jpg$/i.exec(path);
  return !!m && m[1] === userId;
}
