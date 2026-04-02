import * as satellite from "satellite.js";

export type EciKm = { x: number; y: number; z: number };

function vecKm(pv: unknown): EciKm | null {
  if (!pv || typeof pv !== "object") return null;
  const p = (pv as { position?: { x: number; y: number; z: number } })
    .position;
  if (!p) return null;
  return { x: p.x, y: p.y, z: p.z };
}

export function propagateEciKm(
  line1: string,
  line2: string,
  date: Date
): EciKm | null {
  const satrec = satellite.twoline2satrec(line1, line2);
  const pv = satellite.propagate(satrec, date);
  return vecKm(pv);
}

export function distanceKm3D(a: EciKm, b: EciKm): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Great-circle distance on Earth surface (km) from lat/lon degrees. */
export function greatCircleKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
