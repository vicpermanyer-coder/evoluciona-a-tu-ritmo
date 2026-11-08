import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AiBanner, CoachFrame } from "@/components/CoachLayout";

export const Route = createFileRoute("/_authenticated/coach/")({
  head: () => ({
    meta: [
      { title: "Coach IA — EVOLVE" },
      { name: "description", content: "Conversa con tu coach de mejora personal." },
      { property: "og:title", content: "Coach IA — EVOLVE" },
      { property: "og:description", content: "Conversa con tu coach de mejora personal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell title="Coach">
      <AiBanner />
      <CoachFrame>
        <div className="hidden h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border p-10 text-center md:flex">
          <MessageCircle className="h-8 w-8 text-primary" aria-hidden />
          <p className="mt-3 text-muted-foreground">Elige una conversación o empieza una nueva.</p>
        </div>
      </CoachFrame>
    </AppShell>
  ),
});
