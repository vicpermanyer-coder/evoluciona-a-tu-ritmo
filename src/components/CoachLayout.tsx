import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/data";
import { getAiStatus } from "@/lib/server.functions";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export function useAiStatus() {
  return useQuery({ queryKey: ["ai-status"], queryFn: () => getAiStatus(), staleTime: 300_000 });
}

export function useConversations() {
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, updated_at")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useNewConversation() {
  const { data: user } = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("conversations").insert({ user_id: user!.id }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ to: "/coach/$threadId", params: { threadId: id } });
    },
    onError: () => toast.error("No se pudo crear la conversación."),
  });
}

export function AiBanner() {
  const { data } = useAiStatus();
  if (!data || data.configured) return null;
  return (
    <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
      <AlertTriangle className="h-4 w-4" aria-hidden /> AI no configurada. Tus mensajes se guardan, pero el coach no responderá.
    </div>
  );
}

export function ThreadList({ activeId }: { activeId?: string }) {
  const { data, isLoading } = useConversations();
  const create = useNewConversation();
  return (
    <div className="space-y-2">
      <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full bg-gradient-primary">
        {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Nueva conversación
      </Button>
      {isLoading ? (
        <div className="h-12 animate-pulse rounded-xl bg-card" />
      ) : !data?.length ? (
        <p className="p-3 text-sm text-muted-foreground">Sin conversaciones todavía.</p>
      ) : (
        <ul className="space-y-1" aria-label="Conversaciones">
          {data.map((c) => (
            <li key={c.id}>
              <Link
                to="/coach/$threadId"
                params={{ threadId: c.id }}
                className={cn("block truncate rounded-lg px-3 py-2.5 text-sm hover:bg-secondary", c.id === activeId && "bg-accent font-semibold")}
              >
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CoachFrame({ activeId, children }: { activeId?: string; children: ReactNode }) {
  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <aside className={cn(activeId && "hidden md:block")}><ThreadList activeId={activeId} /></aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
