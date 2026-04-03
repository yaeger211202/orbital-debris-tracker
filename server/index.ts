import cors from "cors";
import type { CorsOptions } from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent } from "./agent.js";
import { enrichIssForAgent, fetchIssPosition } from "./iss.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

/** Resolve built SPA folder; try several layouts (monorepo, cwd, nested). */
function resolveClientDist(): string | null {
  const serverRoot = path.resolve(__dirname, "..");
  const candidates = [
    path.join(serverRoot, "..", "client", "dist"),
    path.join(serverRoot, "client", "dist"),
    path.join(process.cwd(), "client", "dist"),
    path.join(process.cwd(), "dist"),
  ];
  for (const p of candidates) {
    const indexHtml = path.join(p, "index.html");
    try {
      if (fs.existsSync(indexHtml)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

const PORT = Number(process.env.PORT) || 8787;

/** Match browser Origin header (no trailing slash). */
function normalizeOrigin(url: string): string {
  return url.trim().replace(/^['"]|['"]$/g, "").replace(/\/+$/, "");
}

const VERCEL_CLIENT = "https://orbital-debris-tracker-client.vercel.app";

const allowedOrigins = new Set<string>([
  normalizeOrigin(VERCEL_CLIENT),
  ...(process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => normalizeOrigin(s))
    .filter(Boolean),
]);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    const o = normalizeOrigin(origin);
    if (allowedOrigins.has(o)) {
      callback(null, true);
      return;
    }
    if (/^http:\/\/localhost:\d+$/.test(o)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  methods: ["GET", "POST", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
  ],
  optionsSuccessStatus: 204,
  maxAge: 86_400,
  preflightContinue: false,
};

const app = express();
app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.use(express.json({ limit: "256kb" }));

// --- API: register first, always, so static/SPA never intercept /api/* ---
const api = express.Router();

api.get("/iss", async (_req, res) => {
  try {
    const raw = await fetchIssPosition();
    res.json(enrichIssForAgent(raw));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: message });
  }
});

api.get("/health", (_req, res) => {
  res.json({
    ok: true,
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    hasSpaceTrack: Boolean(
      process.env.SPACE_TRACK_IDENTITY && process.env.SPACE_TRACK_PASSWORD
    ),
  });
});

api.post("/query", async (req, res) => {
  const question =
    typeof req.body?.question === "string" ? req.body.question.trim() : "";
  if (!question) {
    res.status(400).json({ error: "Missing string body.question" });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });
    return;
  }
  try {
    const out = await runAgent(question, {
      anthropicApiKey: key,
      spaceTrackIdentity: process.env.SPACE_TRACK_IDENTITY,
      spaceTrackPassword: process.env.SPACE_TRACK_PASSWORD,
    });
    if (out.error) {
      res.status(502).json(out);
      return;
    }
    res.json({ answer: out.text });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

api.use((_req, res) => {
  res.status(404).json({ error: "Unknown API route" });
});

app.use("/api", api);

// --- Production: static + SPA only after API, and only if dist exists ---
const clientDist = resolveClientDist();
const isProd = process.env.NODE_ENV === "production";

if (isProd && clientDist) {
  app.use(
    express.static(clientDist, {
      index: false,
      fallthrough: true,
    })
  );
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    const indexHtml = path.join(clientDist, "index.html");
    res.sendFile(indexHtml, (err) => {
      if (err) next(err);
    });
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Orbital Debris Agent API listening on port ${PORT}`);
  console.log(`NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}`);
  console.log(`CORS allowlist: ${[...allowedOrigins].join(", ")}`);
  console.log(
    `API routes: GET /api/iss, GET /api/health, POST /api/query (via /api router)`
  );
  if (isProd) {
    console.log(
      clientDist
        ? `Serving SPA from ${clientDist}`
        : "No client dist found — API-only mode (static/SPA disabled)"
    );
  }
});
