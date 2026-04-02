export type IssNowResponse = {
  message: string;
  timestamp: number;
  iss_position: {
    latitude: string;
    longitude: string;
  };
};

const OPEN_NOTIFY_ISS = "http://api.open-notify.org/iss-now.json";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchIssPosition(retries = 3): Promise<IssNowResponse> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(OPEN_NOTIFY_ISS, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(t);
      if (!res.ok) {
        throw new Error(`Open Notify HTTP ${res.status}`);
      }
      const data = (await res.json()) as IssNowResponse;
      if (data.message !== "success") {
        throw new Error(`Open Notify: ${data.message}`);
      }
      return data;
    } catch (e) {
      lastErr = e;
      if (attempt < retries - 1) {
        await sleep(400 * 2 ** attempt + Math.random() * 200);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Approximate altitude (km) — Open Notify does not provide altitude; use nominal ISS band for agent context. */
export function enrichIssForAgent(data: IssNowResponse) {
  return {
    source: "Open Notify (http://api.open-notify.org/iss-now.json)",
    latitude_deg: Number.parseFloat(data.iss_position.latitude),
    longitude_deg: Number.parseFloat(data.iss_position.longitude),
    timestamp_unix: data.timestamp,
    note:
      "Altitude and velocity are not in the Open Notify payload; cite ~400–420 km LEO and ~7.7 km/s for ISS unless another tool supplies TLE-derived state.",
  };
}
