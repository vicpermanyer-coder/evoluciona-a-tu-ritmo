import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, StateBox } from "@/components/AppShell";
import { useCompletions, useXpEvents } from "@/lib/data";
import { currentStreak, lastNDays, levelFromXp, localDate, longestStreak } from "@/lib/evolve";

export const Route = createFileRoute("/_authenticated/progreso")({
  head: () => ({
    meta: [
      { title: "Progreso — EVOLVE" },
      { name: "description", content: "Gráficas de XP, retos completados, nivel y rachas." },
      { property: "og:title", content: "Progreso — EVOLVE" },
      { property: "og:description", content: "Gráficas de XP, retos completados, nivel y rachas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgressPage,
});

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" };

function ProgressPage() {
  const xp = useXpEvents();
  const comp = useCompletions();
  const today = localDate();
  const days = lastNDays(today, 14);

  if (xp.isLoading || comp.isLoading) return <AppShell title="Progreso"><div className="h-64 animate-pulse rounded-2xl bg-card" /></AppShell>;
  if (xp.error || comp.error) return <AppShell title="Progreso"><StateBox>No pudimos cargar tu progreso.</StateBox></AppShell>;

  const events = xp.data ?? [];
  const completions = comp.data ?? [];
  const total = events.reduce((s, e) => s + e.amount, 0);
  const lvl = levelFromXp(total);
  const daily = days.map((d) => ({
    day: d.slice(5).split("-").reverse().join("/"),
    xp: events.filter((e) => e.event_date === d).reduce((s, e) => s + e.amount, 0),
    retos: completions.filter((c) => c === d).length,
  }));
  let acc = events.filter((e) => e.event_date < days[0]).reduce((s, e) => s + e.amount, 0);
  const cumulative = daily.map((d, i) => {
    acc += d.xp;
    return { day: d.day, nivel: levelFromXp(acc).level, xp: acc, i };
  });

  return (
    <AppShell title="Progreso">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["XP total", total],
          ["Nivel", lvl.level],
          ["Racha actual", currentStreak(completions, today)],
          ["Mejor racha", longestStreak(completions)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-2xl font-semibold">{v}</p>
            <p className="text-xs text-muted-foreground">{l}</p>
          </div>
        ))}
      </section>

      {events.length === 0 ? (
        <div className="mt-6"><StateBox>Completa tu primer reto para empezar a ver gráficas.</StateBox></div>
      ) : (
        <>
          <Chart title="XP por día (14 días)">
            <BarChart data={daily}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} width={30} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="xp" name="XP" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </Chart>
          <Chart title="Retos completados por día">
            <BarChart data={daily}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} width={30} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="retos" name="Retos" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </Chart>
          <Chart title="XP acumulada">
            <LineChart data={cumulative}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} width={40} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="xp" name="XP" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </Chart>
        </>
      )}
    </AppShell>
  );
}

function Chart({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </section>
  );
}
