import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "./api";
import { ChatPanel, type ChatMessage } from "./components/ChatPanel";
import { GlobePanel, type IssSnapshot } from "./components/GlobePanel";
import { StarField } from "./components/StarField";

async function fetchIss(): Promise<IssSnapshot> {
  const res = await fetch(apiUrl("/api/iss"));
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as IssSnapshot;
}

export default function App() {
  const [iss, setIss] = useState<IssSnapshot | null>(null);
  const [issError, setIssError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshIss = useCallback(async () => {
    try {
      setIssError(null);
      const data = await fetchIss();
      setIss(data);
    } catch (e) {
      setIssError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refreshIss();
    const t = window.setInterval(() => void refreshIss(), 5000);
    return () => window.clearInterval(t);
  }, [refreshIss]);

  async function onSend(text: string) {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/query"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      const content =
        data.answer ||
        data.error ||
        (res.ok ? "(empty response)" : `Request failed (${res.status})`);
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: e instanceof Error ? e.message : String(e),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-full overflow-x-hidden bg-void">
      <StarField />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,212,255,0.08),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(90,60,180,0.06),transparent_45%)]"
        aria-hidden
      />

      <div className="relative z-[1] mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:px-8 lg:py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-cyan-glow/70">
              Portfolio build
            </p>
            <h1 className="mt-1 bg-gradient-to-r from-white via-cyan-glow to-cyan-dim bg-clip-text font-sans text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
              Orbital Debris Tracker
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/50">
              Full-stack AI agent: React + Express + Anthropic tool calling.
              Real ISS telemetry and optional Space-Track TLE workflows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono text-white/55">
              Claude Sonnet 4
            </span>
            <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono text-white/55">
              Open Notify
            </span>
            <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono text-white/55">
              Space-Track
            </span>
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_minmax(280px,380px)] lg:items-start">
          <ChatPanel messages={messages} loading={loading} onSend={onSend} />
          <GlobePanel iss={iss} issError={issError} />
        </div>

        <footer className="border-t border-white/5 pt-6 text-center text-xs text-white/35">
          Educational demo — not for operational spaceflight or conjunction
          decisions. Configure <code className="font-mono text-cyan-glow/60">.env</code>{" "}
          with <span className="font-mono">ANTHROPIC_API_KEY</span> and optional
          Space-Track credentials.
        </footer>
      </div>
    </div>
  );
}
