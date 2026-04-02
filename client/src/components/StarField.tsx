import { useMemo } from "react";

type Star = { id: number; x: number; y: number; s: number; d: number };

export function StarField() {
  const stars = useMemo(() => {
    const out: Star[] = [];
    for (let i = 0; i < 140; i++) {
      out.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: Math.random() * 1.8 + 0.4,
        d: Math.random() * 6,
      });
    }
    return out;
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute inset-[-40px] animate-drift opacity-90"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,0.55), transparent),
            radial-gradient(1px 1px at 40% 80%, rgba(0,212,255,0.5), transparent),
            radial-gradient(1px 1px at 90% 20%, rgba(255,255,255,0.45), transparent)
          `,
          backgroundSize: "280px 280px",
        }}
      />
      {stars.map((st) => (
        <span
          key={st.id}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: st.s,
            height: st.s,
            animationDelay: `${st.d}s`,
            boxShadow: `0 0 ${st.s * 2}px rgba(255,255,255,0.35)`,
          }}
        />
      ))}
    </div>
  );
}
