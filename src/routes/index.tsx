import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Target, Repeat, MessageCircle, LineChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EVOLVE — Tu mejor versión, un día a la vez" },
      { name: "description", content: "Retos diarios personalizados, hábitos, XP y un coach con IA. Todo en español." },
      { property: "og:title", content: "EVOLVE — Tu mejor versión, un día a la vez" },
      { property: "og:description", content: "Retos diarios personalizados, hábitos, XP y un coach con IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Target, t: "Retos diarios", d: "Adaptados a tus objetivos y a tu ritmo." },
  { icon: Repeat, t: "Hábitos", d: "Marca cada día y mira tu semana de un vistazo." },
  { icon: MessageCircle, t: "Coach IA", d: "Conversaciones guardadas, consejos concretos." },
  { icon: LineChart, t: "Progreso real", d: "XP, niveles y rachas calculados con tus datos." },
];

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Logo />
        <Button asChild variant="ghost">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-20 pt-12 md:pt-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Mejora personal</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.05] md:text-7xl">
          Tu mejor versión, <span className="text-gradient">un día a la vez.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Pequeños retos, hábitos que se sostienen y un coach que te conoce. Gana XP, sube de nivel y no rompas la racha.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg" className="bg-gradient-primary shadow-glow">
            <Link to="/auth">Empezar gratis</Link>
          </Button>
        </div>
        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-border bg-card/60 p-5">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold">{t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
