import { useMemo } from "react";

export type IssSnapshot = {
  source: string;
  latitude_deg: number;
  longitude_deg: number;
  timestamp_unix: number;
  note: string;
};

function projectToGlobe(lat: number, lon: number) {
  const λ = (lon * Math.PI) / 180;
  const φ = (lat * Math.PI) / 180;
  const cx = 50;
  const cy = 50;
  const R = 36;
  const x = cx + R * Math.cos(φ) * Math.sin(λ);
  const y = cy - R * Math.sin(φ);
  return { x, y };
}

type Props = {
  iss: IssSnapshot | null;
  issError: string | null;
};

export function GlobePanel({ iss, issError }: Props) {
  const pos = useMemo(() => {
    if (!iss) return { x: 50, y: 50 };
    return projectToGlobe(iss.latitude_deg, iss.longitude_deg);
  }, [iss]);

  return (
    <section className="glass-panel relative flex min-h-[320px] flex-col rounded-2xl p-6 lg:min-h-0">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-glow/80">
            Live track
          </p>
          <h2 className="font-sans text-xl font-semibold text-white">
            ISS over Earth
          </h2>
        </div>
        <div className="rounded-full border border-cyan-glow/25 bg-cyan-glow/5 px-3 py-1 text-[10px] font-mono text-cyan-glow/90">
          Open Notify
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_40%,rgba(0,212,255,0.12),transparent_55%)] blur-2xl" />
        <svg
          viewBox="0 0 100 100"
          className="relative z-[1] h-[min(52vw,320px)] w-[min(52vw,320px)] max-w-full drop-shadow-glow"
          role="img"
          aria-label="Simplified Earth globe with ISS position"
        >
          <defs>
            <radialGradient id="earthGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#1a3a52" />
              <stop offset="45%" stopColor="#0d2133" />
              <stop offset="100%" stopColor="#050810" />
            </radialGradient>
            <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(0,212,255,0.55)" />
              <stop offset="100%" stopColor="rgba(0,168,204,0.15)" />
            </linearGradient>
            <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="url(#earthGrad)"
            stroke="url(#rim)"
            strokeWidth="0.6"
          />
          <ellipse
            cx="50"
            cy="50"
            rx="38"
            ry="14"
            fill="none"
            stroke="rgba(0,212,255,0.12)"
            strokeWidth="0.25"
            transform="rotate(-8 50 50)"
          />
          <ellipse
            cx="50"
            cy="50"
            rx="14"
            ry="38"
            fill="none"
            stroke="rgba(0,212,255,0.1)"
            strokeWidth="0.25"
            transform="rotate(18 50 50)"
          />
          <path
            d="M 20 48 Q 50 44 80 52"
            fill="none"
            stroke="rgba(0,212,255,0.08)"
            strokeWidth="0.35"
          />
          <circle
            cx={pos.x}
            cy={pos.y}
            r="2.4"
            fill="#00d4ff"
            filter="url(#glow)"
            className="transition-all duration-[2s] ease-out"
          />
          <circle
            cx={pos.x}
            cy={pos.y}
            r="5"
            fill="none"
            stroke="rgba(0,212,255,0.35)"
            strokeWidth="0.4"
            className="animate-pulse-slow"
          />
        </svg>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="card-glow rounded-xl bg-void/60 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">
            Latitude
          </p>
          <p className="font-mono text-lg text-cyan-glow">
            {iss ? `${iss.latitude_deg.toFixed(4)}°` : "—"}
          </p>
        </div>
        <div className="card-glow rounded-xl bg-void/60 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">
            Longitude
          </p>
          <p className="font-mono text-lg text-cyan-glow">
            {iss ? `${iss.longitude_deg.toFixed(4)}°` : "—"}
          </p>
        </div>
      </div>

      {issError && (
        <p className="mt-3 text-center text-sm text-rose-300/90">{issError}</p>
      )}

      {iss && (
        <div className="mt-3 space-y-1 text-center">
          <p className="font-mono text-[11px] text-white/35">
            Updated{" "}
            {new Date(iss.timestamp_unix * 1000).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}{" "}
            local
          </p>
          <p className="text-xs leading-relaxed text-white/40">{iss.note}</p>
        </div>
      )}
    </section>
  );
}
