import type Anthropic from "@anthropic-ai/sdk";

export type ToolDefinition = Anthropic.Tool;

export const tools: ToolDefinition[] = [
  {
    name: "get_iss_position",
    description:
      "Returns the current geographic position of the International Space Station (latitude, longitude, altitude, velocity) from Open Notify. Use for 'where is the ISS' style questions. Data is public and near real-time.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_debris_count",
    description:
      "Estimates how many trackable debris objects exist in a given orbital regime using Space-Track GP (general perturbation) catalog data. Requires Space-Track credentials. LEO uses apogee/perigee heuristics; results may be capped by API pagination with a note.",
    input_schema: {
      type: "object",
      properties: {
        regime: {
          type: "string",
          enum: ["LEO", "MEO", "GEO", "ALL"],
          description:
            "Orbital regime filter. LEO ~ <2000 km; MEO ~ 2000–35000 km; GEO ~ near 35786 km; ALL is debris regardless of altitude band.",
        },
      },
      required: ["regime"],
    },
  },
  {
    name: "get_tle_data",
    description:
      "Fetches two-line element sets (TLEs) from Space-Track for specific NORAD catalog IDs, or searches recent debris TLEs. When compare_to_iss is true, propagates orbits with SGP4 and returns great-circle ground distance and approximate 3D separation in km for each object vs ISS at the query time (educational / screening-level, not flight safety). ISS NORAD ID is 25544.",
    input_schema: {
      type: "object",
      properties: {
        norad_ids: {
          type: "array",
          items: { type: "integer" },
          description:
            "NORAD catalog numbers to fetch TLEs for (e.g. 25544 for ISS). Max 20 per call.",
        },
        debris_sample_limit: {
          type: "integer",
          description:
            "If norad_ids empty, fetch this many recent debris GP records (default 15, max 50) for overview or proximity ranking.",
        },
        compare_to_iss: {
          type: "boolean",
          description:
            "If true, compute approximate separation vs ISS for each returned object.",
        },
      },
      required: [],
    },
  },
];
