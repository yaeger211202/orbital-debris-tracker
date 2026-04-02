import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent } from "./agent.js";
import { enrichIssForAgent, fetchIssPosition } from "./iss.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

function resolveClientDist(): string {
  const base = __dirname.endsWith(`${path.sep}dist`)
    ? path.resolve(__dirname, "../..")
    : path.resolve(__dirname, "..");
  return path.join(base, "client", "dist");
}

const PORT = Number(process.env.PORT) || 8787;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
app.use(
  cors({
    origin: [CLIENT_ORIGIN, /^http:\/\/localhost:\d+$/],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json({ limit: "256kb" }));

app.get("/api/iss", async (_req, res) => {
  try {
    const raw = await fetchIssPosition();
    res.json(enrichIssForAgent(raw));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: message });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    hasSpaceTrack: Boolean(
      process.env.SPACE_TRACK_IDENTITY && process.env.SPACE_TRACK_PASSWORD
    ),
  });
});

const clientDist = resolveClientDist();

if (process.env.NODE_ENV === "production") {
  app.use(express.static(clientDist, { index: false }));
}

app.post("/api/query", async (req, res) => {
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

if (process.env.NODE_ENV === "production") {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Orbital Debris Agent API http://localhost:${PORT}`);
  if (process.env.NODE_ENV === "production") {
    console.log(`Serving SPA from ${clientDist}`);
  }
});
