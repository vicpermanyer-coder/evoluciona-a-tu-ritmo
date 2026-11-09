import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Zap, Trophy, MessageCircle, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ChallengeList } from "@/components/ChallengeList";
import { Progress } from "@/components/ui/progress";
import { useCompletions, useProfile, useTodayChallenges, useXpEvents } from "@/lib/data";
import { countCompleted, currentStreak, levelFromXp, localDate } from "@/lib/evolve";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Inicio — EVOLVE" },
      { name: "description", content: "Tu resumen diario: XP, nivel, racha y retos de hoy." },
      { property: "og:title", content: "Inicio — EVOLVE" },
      { property: "og:description", content: "Tu resumen diario: XP, nivel, racha y retos de hoy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  return h < 13 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: xp = [] } = useXpEvents();
  const { data: completions = [] } = useCompletions();
  const { data: challenges = [] } = useTodayChallenges();
  const today = localDate();
  const total = xp.reduce((s, e) => s + e.amount, 0);
  const todayXp = xp.filter((e) => e.event_date === today).reduce((s, e) => s + e.amount, 0);
  const lvl = levelFromXp(total);
  const streak = currentStreak(completions, today);
  const done = countCompleted(challenges);

  return (
    <AppShell>
      <p className="text-sm text-muted-foreground">{greeting()},</p>
      <h1 className="text-3xl font-semibold md:text-4xl">{profile?.display_name || "hola"}</h1>

      <section className="mt-6 grid grid-cols-3 gap-3" aria-label="Resumen">
        <Stat icon={Zap} label="XP hoy" value={todayXp} />
        <Stat icon={Trophy} label="Nivel" value={lvl.level} />
        <Stat icon={Flame} label="Racha" value={`${streak} ${streak === 1 ? "día" : "días"}`} />
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex justify-between text-sm">
          <span>Nivel {lvl.level}</span>
          <span className="text-muted-foreground">{lvl.into}/{lvl.next} XP</span>
        </div>
        <Progress value={lvl.pct} className="mt-3 h-2" aria-label="Progreso de nivel" />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">Retos de hoy</h2>
            <p className="text-sm text-muted-foreground">{done} de {challenges.length} completados</p>
          </div>
          <Link to="/retos" className="text-sm font-semibold text-primary">Ver todos</Link>
        </div>
        <Progress value={challenges.length ? (done / challenges.length) * 100 : 0} className="mb-4 h-1.5" aria-label="Retos completados" />
        <ChallengeList limit={3} />
      </section>

      <Link to="/coach" className="mt-8 flex items-center gap-4 rounded-2xl bg-gradient-primary p-5 text-primary-foreground shadow-glow">
        <MessageCircle className="h-6 w-6" aria-hidden />
        <div className="flex-1">
          <p className="font-semibold">Habla con tu coach</p>
          <p className="text-sm opacity-85">Pide ideas, ajusta tu plan o desahógate.</p>
        </div>
        <ArrowRight className="h-5 w-5" aria-hidden />
      </Link>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      <p className="mt-3 text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
