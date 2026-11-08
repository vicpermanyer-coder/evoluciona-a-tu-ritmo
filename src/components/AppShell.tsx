import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Home, Target, Repeat, MessageCircle, LineChart, User, Camera, LogOut, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/data";
import { Logo } from "./Logo";

const NAV = [
  { to: "/dashboard", label: "Inicio", icon: Home },
  { to: "/retos", label: "Retos", icon: Target },
  { to: "/habitos", label: "Hábitos", icon: Repeat },
  { to: "/coach", label: "Coach", icon: MessageCircle },
  { to: "/progreso", label: "Progreso", icon: LineChart },
  { to: "/analisis", label: "Análisis", icon: Camera },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

const MOBILE = ["/dashboard", "/retos", "/habitos", "/coach", "/perfil"];

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { data: profile, isLoading, error } = useProfile();
  const signOut = useSignOut();

  if (isLoading || (!profile && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Cargando">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (error) {
    return <div className="p-8 text-center text-destructive">No pudimos cargar tu perfil. Recarga la página.</div>;
  }
  if (profile && !profile.onboarded) return <Navigate to="/onboarding" />;

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-5 md:flex">
        <Logo />
        <nav className="mt-10 flex flex-1 flex-col gap-1" aria-label="Principal">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" }}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Cerrar sesión
        </button>
      </aside>

      <div className="flex-1 pb-24 md:pb-10">
        <header className="flex items-center justify-between px-5 pt-6 md:hidden">
          <Logo />
          <Link to="/analisis" aria-label="Análisis de imagen" className="rounded-full bg-secondary p-2">
            <Camera className="h-4 w-4" />
          </Link>
        </header>
        <main className="mx-auto w-full max-w-4xl px-5 pt-6 md:px-10 md:pt-10">
          {title && <h1 className="mb-6 text-3xl font-semibold md:text-4xl">{title}</h1>}
          {children}
        </main>
      </div>

      <nav
        aria-label="Principal móvil"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
      >
        {NAV.filter((n) => MOBILE.includes(n.to)).map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1 py-3 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary font-semibold" }}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function StateBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
