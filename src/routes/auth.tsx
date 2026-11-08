import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — EVOLVE" },
      { name: "description", content: "Inicia sesión o crea tu cuenta en EVOLVE." },
      { property: "og:title", content: "Entrar — EVOLVE" },
      { property: "og:description", content: "Inicia sesión o crea tu cuenta en EVOLVE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function translate(msg: string) {
  if (/Invalid login/i.test(msg)) return "Email o contraseña incorrectos.";
  if (/Email not confirmed/i.test(msg)) return "Confirma tu email antes de entrar. Revisa tu bandeja de entrada.";
  if (/already registered/i.test(msg)) return "Ya existe una cuenta con este email.";
  if (/Password should be/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres.";
  return msg;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/onboarding" });
        else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(translate((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-hero px-5">
      <div className="w-full max-w-sm">
        <Logo />
        {sent ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6" role="status">
            <h1 className="text-2xl font-semibold">Revisa tu email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Te hemos enviado un enlace de confirmación a <strong className="text-foreground">{email}</strong>. Ábrelo
              para activar tu cuenta.
            </p>
            <Button variant="ghost" className="mt-4 px-0" onClick={() => { setSent(false); setMode("login"); }}>
              Volver a iniciar sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-10 space-y-5 rounded-2xl border border-border bg-card p-6">
            <div>
              <h1 className="text-2xl font-semibold">{mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "login" ? "Continúa donde lo dejaste." : "Empieza a evolucionar hoy."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Entrar" : "Crear cuenta"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
              <button type="button" className="font-semibold text-primary" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}>
                {mode === "login" ? "Regístrate" : "Inicia sesión"}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
