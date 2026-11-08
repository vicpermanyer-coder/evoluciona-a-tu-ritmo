import { Check } from "lucide-react";
import { GOALS, INTENSITIES, type Goal, type Intensity } from "@/lib/evolve";
import { cn } from "@/lib/utils";

export function GoalPicker({ value, onChange }: { value: Goal[]; onChange: (v: Goal[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Objetivos">
      {GOALS.map((g) => {
        const on = value.includes(g.id);
        return (
          <button
            key={g.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== g.id) : [...value, g.id])}
            className={cn(
              "flex items-center justify-between rounded-xl border p-4 text-left transition-all",
              on ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/50",
            )}
          >
            <span>
              <span className="block font-semibold">{g.label}</span>
              <span className="text-sm text-muted-foreground">{g.desc}</span>
            </span>
            {on && <Check className="h-5 w-5 text-primary" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

export function IntensityPicker({ value, onChange }: { value: Intensity; onChange: (v: Intensity) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Intensidad">
      {INTENSITIES.map((i) => (
        <button
          key={i.id}
          type="button"
          role="radio"
          aria-checked={value === i.id}
          onClick={() => onChange(i.id)}
          className={cn(
            "rounded-xl border p-4 text-center transition-all",
            value === i.id ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/50",
          )}
        >
          <span className="block font-semibold">{i.label}</span>
          <span className="text-xs text-muted-foreground">{i.desc}</span>
        </button>
      ))}
    </div>
  );
}
