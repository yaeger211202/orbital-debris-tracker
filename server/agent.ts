import Anthropic from "@anthropic-ai/sdk";
import { enrichIssForAgent, fetchIssPosition } from "./iss.js";
import { distanceKm3D, greatCircleKm, propagateEciKm } from "./orbital.js";
import {
  SpaceTrackClient,
  countDebrisByRegime,
  getGpByNoradIds,
  getRecentDebrisSample,
  recordToTle,
} from "./spacetrack.js";
import { tools } from "./tools.js";

const MODEL = "claude-sonnet-4-6";

const SYSTEM = `You are the Orbital Debris Tracker agent for a technical audience and portfolio demo.
- Use tools for factual orbital data; do not invent NORAD IDs, positions, or counts.
- Open Notify gives ISS lat/lon only; remind users altitude/velocity are approximate unless TLE tools were used.
- Space-Track-derived proximity is SGP4 + geometric separation in an Earth-centered inertial frame — screening / educational only, not for launch safety or operational decisions.
- When discussing "safe to launch", cite debris counts/regimes from tools, note weather/NOTAM/policy are out of scope, and avoid definitive flight-safety claims.
- Be concise; use short paragraphs and bullets when listing objects.`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withAnthropicRetries<T>(
  fn: () => Promise<T>,
  retries = 4
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      const retryable =
        /529|503|502|429|rate|overloaded|timeout/i.test(msg) ||
        (e &&
          typeof e === "object" &&
          "status" in e &&
          [429, 502, 503, 529].includes(
            Number((e as { status?: number }).status)
          ));
      if (!retryable || i === retries - 1) break;
      await sleep(600 * 2 ** i + Math.random() * 400);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

type ToolInput = Record<string, unknown>;

export async function runAgent(
  userQuestion: string,
  deps: {
    anthropicApiKey: string;
    spaceTrackIdentity?: string;
    spaceTrackPassword?: string;
  }
): Promise<{ text: string; error?: string }> {
  const client = new Anthropic({ apiKey: deps.anthropicApiKey });
  let st: SpaceTrackClient | null = null;
  if (deps.spaceTrackIdentity && deps.spaceTrackPassword) {
    st = new SpaceTrackClient(deps.spaceTrackIdentity, deps.spaceTrackPassword);
  }

  const runTool = async (name: string, input: ToolInput): Promise<string> => {
    try {
      if (name === "get_iss_position") {
        const raw = await fetchIssPosition();
        return JSON.stringify(
          { ...enrichIssForAgent(raw), raw_open_notify: raw },
          null,
          2
        );
      }
      if (name === "get_debris_count") {
        if (!st) {
          return JSON.stringify({
            error:
              "Space-Track credentials not configured (SPACE_TRACK_IDENTITY / SPACE_TRACK_PASSWORD).",
          });
        }
        const regime = String(input.regime ?? "LEO").toUpperCase() as
          | "LEO"
          | "MEO"
          | "GEO"
          | "ALL";
        const result = await countDebrisByRegime(st, regime, {
          pageSize: 1000,
          maxPages: 30,
        });
        return JSON.stringify(
          {
            ...result,
            disclaimer:
              "Count is the number of GP records returned for DEBRIS with DECAYED=false and regime heuristics; Space-Track may update cataloging. Large totals are paginated and may be capped (see capped flag).",
          },
          null,
          2
        );
      }
      if (name === "get_tle_data") {
        if (!st) {
          return JSON.stringify({
            error:
              "Space-Track credentials not configured (SPACE_TRACK_IDENTITY / SPACE_TRACK_PASSWORD).",
          });
        }
        const noradIds = Array.isArray(input.norad_ids)
          ? (input.norad_ids as unknown[]).map((n) => Number(n)).filter(Number.isFinite)
          : [];
        const sampleLimit = Math.min(
          50,
          Math.max(
            1,
            Number(input.debris_sample_limit ?? 15) || 15
          )
        );
        const compareToIss = Boolean(input.compare_to_iss);

        let records =
          noradIds.length > 0
            ? await getGpByNoradIds(st, noradIds)
            : await getRecentDebrisSample(st, sampleLimit);

        const now = new Date();
        const tles = records
          .map((r) => ({ gp: r, tle: recordToTle(r) }))
          .filter((x): x is typeof x & { tle: NonNullable<typeof x.tle> } =>
            Boolean(x.tle)
          );

        let issTle: (typeof tles)[number]["tle"] | null = null;
        if (compareToIss) {
          const issRows = await getGpByNoradIds(st, [25544]);
          issTle = issRows.length ? recordToTle(issRows[0]!) : null;
        }

        const issEci =
          issTle && compareToIss
            ? propagateEciKm(issTle.line1, issTle.line2, now)
            : null;

        const openNotify = compareToIss ? await fetchIssPosition(2) : null;
        const lat = openNotify
          ? Number.parseFloat(openNotify.iss_position.latitude)
          : null;
        const lon = openNotify
          ? Number.parseFloat(openNotify.iss_position.longitude)
          : null;

        let enriched = tles.map(({ gp, tle }) => {
          const base = {
            norad: tle.norad,
            name: tle.name,
            object_type: gp.OBJECT_TYPE,
            epoch: gp.EPOCH,
            apogee_km: gp.APOGEE,
            perigee_km: gp.PERIGEE,
            inclination_deg: gp.INCLINATION,
            tle_line1: tle.line1,
            tle_line2: tle.line2,
          };
          if (!compareToIss || !issEci) return base;
          const objEci = propagateEciKm(tle.line1, tle.line2, now);
          if (!objEci) {
            return { ...base, separation_km_3d_approx: null as number | null };
          }
          const separation_km = distanceKm3D(issEci, objEci);
          let subsatellite_great_circle_km_to_iss_ground: number | undefined;
          if (lat != null && lon != null && Number.isFinite(lat + lon)) {
            const satLatLon = eciToLatLonKm(objEci, now);
            if (satLatLon) {
              subsatellite_great_circle_km_to_iss_ground =
                Math.round(
                  greatCircleKm(lat, lon, satLatLon.lat, satLatLon.lon) * 10
                ) / 10;
            }
          }
          return {
            ...base,
            separation_km_3d_approx: Math.round(separation_km * 10) / 10,
            subsatellite_great_circle_km_to_iss_ground,
            note:
              "ECI Euclidean distance at tool execution time; subsatellite vs ISS ground point is illustrative. Not conjunction analysis.",
          };
        });

        if (compareToIss) {
          enriched = [...enriched].sort((a, b) => {
            const da =
              typeof (a as { separation_km_3d_approx?: number })
                .separation_km_3d_approx === "number"
                ? (a as { separation_km_3d_approx: number })
                    .separation_km_3d_approx
                : Number.POSITIVE_INFINITY;
            const db =
              typeof (b as { separation_km_3d_approx?: number })
                .separation_km_3d_approx === "number"
                ? (b as { separation_km_3d_approx: number })
                    .separation_km_3d_approx
                : Number.POSITIVE_INFINITY;
            return da - db;
          });
        }

        return JSON.stringify(
          {
            query_time_utc: now.toISOString(),
            iss_tle_available: Boolean(issTle),
            open_notify_iss_lat_lon: openNotify?.iss_position ?? null,
            objects: enriched,
          },
          null,
          2
        );
      }
      return JSON.stringify({ error: `Unknown tool: ${name}` });
    } catch (e) {
      return JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  type Msg = Anthropic.MessageParam;
  const messages: Msg[] = [{ role: "user", content: userQuestion }];

  for (let step = 0; step < 24; step++) {
    const response = await withAnthropicRetries(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: SYSTEM,
        tools,
        tool_choice: { type: "auto" },
        messages,
      })
    );

    const blocks = response.content;
    const textFrom = (content: typeof blocks) =>
      content
        .filter((b) => b.type === "text")
        .map((b) => (b as Anthropic.TextBlock).text)
        .join("\n");

    const toolBlocks = blocks.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    const shouldRunTools =
      response.stop_reason === "tool_use" ||
      (response.stop_reason == null && toolBlocks.length > 0);

    if (!shouldRunTools) {
      if (
        response.stop_reason === "end_turn" ||
        response.stop_reason === "max_tokens"
      ) {
        const text = textFrom(blocks);
        if (response.stop_reason === "max_tokens" && !text.trim()) {
          return {
            text: "",
            error:
              "Model hit max_tokens before producing a user-visible answer; retry with a shorter question or raise max_tokens.",
          };
        }
        return {
          text:
            text ||
            (response.stop_reason === "max_tokens"
              ? "(truncated — increase max_tokens if needed)"
              : "(no text response)"),
        };
      }
      if (response.stop_reason === "stop_sequence") {
        const text = textFrom(blocks);
        return { text: text || "(stop sequence)" };
      }
      return {
        text: "",
        error: `Unexpected stop_reason: ${String(response.stop_reason)}`,
      };
    }

    messages.push({ role: "assistant", content: blocks });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolBlocks) {
      const result = await runTool(block.name, block.input as ToolInput);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }

    if (toolResults.length === 0) {
      messages.push({
        role: "user",
        content:
          "The API returned tool_use but no tool_use blocks were found in the message. Reply with a normal answer or call a tool again.",
      });
      continue;
    }

    messages.push({ role: "user", content: toolResults });
  }

  return { text: "", error: "Tool loop limit exceeded" };
}

/** Rough subsatellite point from ECI (km) — demo use only. */
function eciToLatLonKm(
  eci: { x: number; y: number; z: number },
  date: Date
): { lat: number; lon: number } | null {
  const gmst = greenwichMeanSiderealTime(date);
  const cos = Math.cos(gmst);
  const sin = Math.sin(gmst);
  const x = eci.x * cos + eci.y * sin;
  const y = -eci.x * sin + eci.y * cos;
  const z = eci.z;
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < 1) return null;
  const lat = (Math.asin(z / r) * 180) / Math.PI;
  const lon = (Math.atan2(y, x) * 180) / Math.PI;
  return { lat, lon: ((lon + 540) % 360) - 180 };
}

function greenwichMeanSiderealTime(date: Date): number {
  const jd = julianDate(date);
  const t = (jd - 2451545) / 36525;
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545) +
    0.000387933 * t * t -
    (t * t * t) / 38710000;
  gmst = ((gmst % 360) + 360) % 360;
  return (gmst * Math.PI) / 180;
}

function julianDate(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d =
    date.getUTCDate() +
    date.getUTCHours() / 24 +
    date.getUTCMinutes() / 1440 +
    date.getUTCSeconds() / 86400;
  let Y = y;
  let M = m;
  if (M <= 2) {
    Y -= 1;
    M += 12;
  }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const jd0 =
    Math.floor(365.25 * (Y + 4716)) +
    Math.floor(30.6001 * (M + 1)) +
    d +
    B -
    1524.5;
  return jd0;
}
