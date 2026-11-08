import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AiBanner, CoachFrame } from "@/components/CoachLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendCoachMessage } from "@/lib/server.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/coach/$threadId")({
  head: () => ({
    meta: [
      { title: "Conversación — Coach EVOLVE" },
      { name: "description", content: "Tu conversación con el coach de EVOLVE." },
      { property: "og:title", content: "Conversación — Coach EVOLVE" },
      { property: "og:description", content: "Tu conversación con el coach de EVOLVE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Thread,
});

type Msg = { id: string; role: string; content: string };

function Thread() {
  const { threadId } = Route.useParams();
  return (
    <AppShell>
      <AiBanner />
      <CoachFrame activeId={threadId}>
        <ChatWindow key={threadId} threadId={threadId} />
      </CoachFrame>
    </AppShell>
  );
}

function ChatWindow({ threadId }: { threadId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const msgs = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, role, content")
        .eq("conversation_id", threadId)
        .order("created_at");
      if (error) throw error;
      return data as Msg[];
    },
  });

  const send = useMutation({
    mutationFn: (content: string) => sendCoachMessage({ data: { conversationId: threadId, content } }),
    onMutate: (content) => { setPending(content); setNotice(null); },
    onSuccess: (r) => {
      if (r.status === "not_configured") setNotice("AI no configurada");
      if (r.status === "error") setNotice(r.message);
    },
    onError: () => toast.error("No se pudo enviar el mensaje."),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["messages", threadId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setPending(null);
      inputRef.current?.focus();
    },
  });

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.data, pending]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || send.isPending) return;
    setText("");
    send.mutate(t);
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  const list = msgs.data ?? [];
  const showPending = pending && !list.some((m) => m.role === "user" && m.content === pending && m === list[list.length - 1]);

  return (
    <div className="flex h-[calc(100dvh-14rem)] flex-col md:h-[calc(100dvh-10rem)]">
      <Link to="/coach" className="mb-3 flex items-center gap-1 text-sm text-muted-foreground md:hidden">
        <ArrowLeft className="h-4 w-4" /> Conversaciones
      </Link>
      <div className="flex-1 space-y-4 overflow-y-auto pr-1" aria-live="polite">
        {msgs.isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />}
        {msgs.error && <p className="text-center text-sm text-destructive">No se pudo cargar la conversación.</p>}
        {!msgs.isLoading && !list.length && !pending && (
          <p className="pt-10 text-center text-sm text-muted-foreground">Escribe tu primer mensaje. Por ejemplo: “Quiero dormir mejor, ¿por dónde empiezo?”</p>
        )}
        {list.map((m) => <Bubble key={m.id} role={m.role} content={m.content} />)}
        {showPending && <Bubble role="user" content={pending!} />}
        {send.isPending && (
          <div className="flex gap-1.5 px-1" aria-label="El coach está escribiendo">
            {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${i * 120}ms` }} />)}
          </div>
        )}
        {notice && (
          <p role="alert" className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{notice}</p>
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="mt-3 flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
        <label htmlFor="msg" className="sr-only">Mensaje</label>
        <Textarea
          id="msg"
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          maxLength={4000}
          placeholder="Escribe a tu coach…"
          className="max-h-40 min-h-10 resize-none border-0 bg-transparent focus-visible:ring-0"
        />
        <Button type="submit" size="icon" aria-label="Enviar" disabled={!text.trim() || send.isPending} className="shrink-0 rounded-xl bg-gradient-primary">
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

function Bubble({ role, content }: { role: string; content: string }) {
  const user = role === "user";
  return (
    <div className={cn("flex", user && "justify-end")}>
      <div className={cn("max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed", user ? "rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground" : "px-1 text-foreground")}>
        {content}
      </div>
    </div>
  );
}
