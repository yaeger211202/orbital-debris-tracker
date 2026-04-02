/**
 * Space-Track.org REST API (GP class).
 * Requires account: https://www.space-track.org/auth/createAccount
 */

const BASE = "https://www.space-track.org";

export type GpRecord = {
  NORAD_CAT_ID: number;
  OBJECT_NAME?: string;
  OBJECT_TYPE?: string;
  TLE_LINE0?: string;
  TLE_LINE1?: string;
  TLE_LINE2?: string;
  EPOCH?: string;
  MEAN_MOTION?: number;
  ECCENTRICITY?: number;
  INCLINATION?: number;
  RA_OF_ASC_NODE?: number;
  ARG_OF_PERICENTER?: number;
  MEAN_ANOMALY?: number;
  EPHEMERIS_TYPE?: number;
  CLASSIFICATION_TYPE?: string;
  ELEMENT_SET_NO?: number;
  REV_AT_EPOCH?: number;
  BSTAR?: number;
  MEAN_MOTION_DOT?: number;
  MEAN_MOTION_DDOT?: number;
  SEMIMAJOR_AXIS?: number;
  PERIOD?: number;
  APOGEE?: number;
  PERIGEE?: number;
  DECAYED?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseCookies(setCookie: string[] | undefined): string {
  if (!setCookie?.length) return "";
  return setCookie
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

export class SpaceTrackClient {
  private cookie = "";
  private identity: string;
  private password: string;

  constructor(identity: string, password: string) {
    this.identity = identity;
    this.password = password;
  }

  async login(): Promise<void> {
    const res = await fetch(`${BASE}/ajaxauth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: this.identity,
        password: this.password,
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`Space-Track login failed: ${res.status} ${raw.slice(0, 200)}`);
    }
    const rawSet =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [];
    const single = res.headers.get("set-cookie");
    const setCookie =
      rawSet.length > 0
        ? rawSet
        : single
          ? [single]
          : [];
    this.cookie = parseCookies(setCookie);
    if (!this.cookie) {
      throw new Error("Space-Track login: no session cookie returned");
    }
  }

  private async ensureCookie(): Promise<void> {
    if (!this.cookie) await this.login();
  }

  async request(path: string, retries = 3): Promise<unknown> {
    await this.ensureCookie();
    let lastErr: unknown;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const url = path.startsWith("http") ? path : `${BASE}${path}`;
        const res = await fetch(url, {
          headers: {
            Cookie: this.cookie,
            Accept: "application/json",
          },
        });
        if (res.status === 401 || res.status === 403) {
          this.cookie = "";
          await this.login();
          continue;
        }
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`Space-Track ${res.status}: ${text.slice(0, 300)}`);
        }
        if (!text || text === "[]") return [];
        return JSON.parse(text) as unknown;
      } catch (e) {
        lastErr = e;
        if (attempt < retries - 1) {
          await sleep(500 * 2 ** attempt + Math.random() * 300);
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}

function regimePredicates(regime: "LEO" | "MEO" | "GEO" | "ALL"): string {
  switch (regime) {
    case "LEO":
      return "/APOGEE/<2000/PERIGEE/>120";
    case "MEO":
      return "/PERIGEE/>2000/APOGEE/<35000";
    case "GEO":
      return "/PERIGEE/>33000/APOGEE/<38000";
    case "ALL":
    default:
      return "";
  }
}

export async function countDebrisByRegime(
  client: SpaceTrackClient,
  regime: "LEO" | "MEO" | "GEO" | "ALL",
  options: { pageSize?: number; maxPages?: number } = {}
): Promise<{ totalFetched: number; capped: boolean; regime: string }> {
  const pageSize = Math.min(options.pageSize ?? 1000, 1000);
  const maxPages = options.maxPages ?? 25;
  const regimePath = regimePredicates(regime);
  let total = 0;
  let capped = false;

  for (let page = 0; page < maxPages; page++) {
    const offset = page * pageSize;
    const path =
      `/basicspacedata/query/class/gp/OBJECT_TYPE/DEBRIS/DECAYED/false` +
      regimePath +
      `/orderby/NORAD_CAT_ID%20asc` +
      `/limit/${pageSize}/offset/${offset}/format/json`;

    const chunk = (await client.request(path)) as GpRecord[];
    if (!Array.isArray(chunk)) {
      throw new Error("Unexpected Space-Track response shape");
    }
    total += chunk.length;
    if (chunk.length < pageSize) break;
    if (page === maxPages - 1) capped = true;
  }

  return { totalFetched: total, capped, regime };
}

export async function getGpByNoradIds(
  client: SpaceTrackClient,
  noradIds: number[]
): Promise<GpRecord[]> {
  if (!noradIds.length) return [];
  const unique = [...new Set(noradIds)].slice(0, 20);
  const ids = unique.join(",");
  const path = `/basicspacedata/query/class/gp/NORAD_CAT_ID/${ids}/format/json`;
  const data = (await client.request(path)) as GpRecord[];
  return Array.isArray(data) ? data : [];
}

export async function getRecentDebrisSample(
  client: SpaceTrackClient,
  limit: number
): Promise<GpRecord[]> {
  const lim = Math.min(Math.max(limit, 1), 50);
  const path =
    `/basicspacedata/query/class/gp/OBJECT_TYPE/DEBRIS/DECAYED/false` +
    `/orderby/EPOCH%20desc/limit/${lim}/format/json`;
  const data = (await client.request(path)) as GpRecord[];
  return Array.isArray(data) ? data : [];
}

export function recordToTle(record: GpRecord): {
  norad: number;
  name: string;
  line1: string;
  line2: string;
} | null {
  const l1 = record.TLE_LINE1?.trim();
  const l2 = record.TLE_LINE2?.trim();
  if (!l1 || !l2) return null;
  return {
    norad: record.NORAD_CAT_ID,
    name: record.OBJECT_NAME ?? `NORAD-${record.NORAD_CAT_ID}`,
    line1: l1,
    line2: l2,
  };
}
