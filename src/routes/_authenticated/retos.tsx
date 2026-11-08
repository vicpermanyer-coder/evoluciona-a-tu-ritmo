import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ChallengeList } from "@/components/ChallengeList";

export const Route = createFileRoute("/_authenticated/retos")({
  head: () => ({
    meta: [
      { title: "Retos diarios — EVOLVE" },
      { name: "description", content: "Tus retos de hoy según tus objetivos e intensidad." },
      { property: "og:title", content: "Retos diarios — EVOLVE" },
      { property: "og:description", content: "Tus retos de hoy según tus objetivos e intensidad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell title="Retos de hoy">
      <p className="-mt-4 mb-6 text-sm text-muted-foreground">
        Se renuevan cada día a medianoche (tu hora local). Cada reto otorga XP una sola vez.
      </p>
      <ChallengeList />
    </AppShell>
  ),
});
