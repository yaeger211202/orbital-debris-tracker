import { type FormEvent, useEffect, useRef } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => void;
};

const SUGGESTIONS = [
  "Where is the ISS right now?",
  "How many debris objects are in low earth orbit?",
  "Is it safe to launch to 400km orbit today?",
  "What are the top 10 closest debris objects to ISS?",
];

export function ChatPanel({ messages, loading, onSend }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function transmit() {
    const el = inputRef.current;
    const v = el?.value.trim();
    if (!v || loading) return;
    onSend(v);
    el!.value = "";
    el!.style.height = "auto";
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    transmit();
  }

  return (
    <section className="glass-panel flex min-h-[480px] flex-col rounded-2xl p-0 lg:max-h-[calc(100vh-8rem)]">
      <header className="border-b border-white/5 px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-glow/80">
          Claude agent
        </p>
        <h2 className="font-sans text-xl font-semibold text-white">
          Orbital debris copilot
        </h2>
        <p className="mt-1 max-w-xl text-sm text-white/45">
          Natural language queries with tool calling — ISS via Open Notify, TLEs
          and catalog context via Space-Track when configured.
        </p>
      </header>

      <div className="scroll-thin flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-6">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-white/50">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={loading}
                  onClick={() => onSend(s)}
                  className="rounded-full border border-cyan-glow/20 bg-cyan-glow/5 px-3 py-1.5 text-left text-xs text-cyan-dim transition hover:border-cyan-glow/45 hover:bg-cyan-glow/10 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <article
            key={m.id}
            className={`animate-slide-up rounded-xl border px-4 py-3 ${
              m.role === "user"
                ? "ml-6 border-white/10 bg-white/[0.03]"
                : "mr-4 border-cyan-glow/25 bg-cyan-glow/[0.04] shadow-glow-sm"
            }`}
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
              {m.role === "user" ? "You" : "Agent"}
            </p>
            <div
              className={`whitespace-pre-wrap text-sm leading-relaxed ${
                m.role === "assistant"
                  ? "font-sans text-white/90"
                  : "text-white/80"
              }`}
            >
              {m.content}
            </div>
          </article>
        ))}

        {loading && (
          <div className="mr-4 flex items-center gap-2 rounded-xl border border-cyan-glow/20 bg-nebula/80 px-4 py-3 text-sm text-cyan-glow/90">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-glow opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-glow" />
            </span>
            Running tools and reasoning…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={submit}
        className="border-t border-white/5 p-4 sm:p-5"
      >
        <label htmlFor="q" className="sr-only">
          Ask the agent
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <textarea
            id="q"
            ref={inputRef}
            rows={2}
            placeholder="Ask about ISS position, debris counts, TLEs, proximity…"
            disabled={loading}
            className="min-h-[52px] flex-1 resize-none rounded-xl border border-white/10 bg-void/80 px-4 py-3 font-sans text-sm text-white outline-none ring-cyan-glow/30 placeholder:text-white/30 focus:border-cyan-glow/40 focus:ring-2 disabled:opacity-50"
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                transmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={loading}
            className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-cyan-glow to-cyan-dim px-6 font-medium text-void shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Transmit
          </button>
        </div>
      </form>
    </section>
  );
}
