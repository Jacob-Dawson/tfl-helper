/**
 * buildDataset.ts
 *
 * One-time script to generate stations.json and connections.json
 * from the TfL Unified API, with travel times sourced from:
 *   - nicola/tubemaps CSV (tube lines, FOI-derived)
 *   - Haversine approximation (Elizabeth line + Overground)
 *
 * Usage:
 *   npx ts-node scripts/buildDataset.ts
 *
 * Requires:
 *   TFL_API_KEY env variable (or pass as --key <key>)
 *   Node 18+ (uses built-in fetch)
 */

import fs from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TFL_BASE = "https://api.tfl.gov.uk";
const API_KEY = process.env.TFL_API_KEY ?? "";

// Modes to include
const MODES = ["tube", "elizabeth-line", "overground"];

// Lines whose travel times come from the nicola/tubemaps CSV (FOI-derived).
// All other lines will use haversine approximation.
const TUBE_LINE_IDS = new Set([
  "bakerloo",
  "central",
  "circle",
  "district",
  "hammersmith-city",
  "jubilee",
  "metropolitan",
  "northern",
  "piccadilly",
  "victoria",
  "waterloo-city",
]);

// nicola/tubemaps raw CSV URLs
const NICOLA_STATIONS_URL =
  "https://raw.githubusercontent.com/nicola/tubemaps/master/datasets/london.stations.csv";
const NICOLA_CONNECTIONS_URL =
  "https://raw.githubusercontent.com/nicola/tubemaps/master/datasets/london.connections.csv";

// Average tube speed (km/min) used for haversine fallback.
// ~33 km/h is a reasonable inter-peak average for surface lines.
const FALLBACK_KM_PER_MIN = 33 / 60;

// Minimum travel time between adjacent stations (minutes)
const MIN_TRAVEL_TIME = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Station {
  id: string; // NaPTAN code e.g. "940GZZLUGPK"
  name: string;
  lines: string[]; // TfL line ids e.g. ["jubilee", "victoria"]
  lat: number;
  lng: number;
  zone: string; // e.g. "1", "2-3"
}

interface Connection {
  from: string; // NaPTAN id
  to: string; // NaPTAN id
  line: string; // TfL line id
  travelTime: number; // minutes (integer)
}

// Raw shape returned by /Line/{id}/Route/Sequence/{direction}
interface TflRouteSequence {
  lineId: string;
  lineName: string;
  stopPointSequences: Array<{
    stopPoint: Array<{
      id: string; // NaPTAN
      name: string;
      lat: number;
      lon: number;
      zone?: string;
      lines?: Array<{ id: string }>;
    }>;
  }>;
}

// Raw shape returned by /Line/Mode/{modes}
interface TflLine {
  id: string;
  name: string;
  modeName: string;
}

// nicola/tubemaps internal types
interface NicolaStation {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

interface NicolaConnection {
  station1: number;
  station2: number;
  line: number;
  time: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tflUrl(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return API_KEY
    ? `${TFL_BASE}${path}${sep}app_key=${API_KEY}`
    : `${TFL_BASE}${path}`;
}

async function tflGet<T>(path: string): Promise<T> {
  const res = await fetch(tflUrl(path));
  if (!res.ok) {
    throw new Error(`TfL API error ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

/** Haversine distance in km between two lat/lng points */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Derive travel time in minutes from distance, with a minimum floor */
function approxTravelTime(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const km = haversineKm(lat1, lng1, lat2, lng2);
  return Math.max(MIN_TRAVEL_TIME, Math.round(km / FALLBACK_KM_PER_MIN));
}

/** Minimal CSV parser — handles quoted fields */
function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.trim().split("\n");
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

/** Normalise a station name for fuzzy matching (lowercase, strip suffixes) */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*underground\s*station\s*$/i, "")
    .replace(/\s*station\s*$/i, "")
    .replace(/\s*\(.*?\)\s*/g, "") // remove parenthetical e.g. "(H&C Line)"
    .replace(/['']/g, "'")
    .trim();
}

// ---------------------------------------------------------------------------
// Load nicola/tubemaps reference data
// ---------------------------------------------------------------------------

async function loadNicolaData(): Promise<{
  stationMap: Map<number, NicolaStation>;
  connections: NicolaConnection[];
}> {
  console.log("  Fetching nicola/tubemaps reference CSVs…");

  const [stationsRaw, connectionsRaw] = await Promise.all([
    fetch(NICOLA_STATIONS_URL).then((r) => r.text()),
    fetch(NICOLA_CONNECTIONS_URL).then((r) => r.text()),
  ]);

  const stationRows = parseCSV(stationsRaw);
  const stationMap = new Map<number, NicolaStation>(
    stationRows.map((row) => [
      Number(row.id),
      {
        id: Number(row.id),
        name: row.name,
        lat: Number(row.latitude),
        lng: Number(row.longitude),
      },
    ])
  );

  const connections: NicolaConnection[] = parseCSV(connectionsRaw).map(
    (row) => ({
      station1: Number(row.station1),
      station2: Number(row.station2),
      line: Number(row.line),
      time: Number(row.time),
    })
  );

  console.log(
    `  Loaded ${stationMap.size} nicola stations, ${connections.length} connections`
  );
  return { stationMap, connections };
}

/**
 * Build a lookup: "normalised name A|normalised name B" → travel time (mins)
 * Direction-agnostic (both orderings keyed).
 */
function buildNicolaLookup(
  stationMap: Map<number, NicolaStation>,
  connections: NicolaConnection[]
): Map<string, number> {
  const lookup = new Map<string, number>();
  for (const conn of connections) {
    const a = stationMap.get(conn.station1);
    const b = stationMap.get(conn.station2);
    if (!a || !b) continue;
    const keyAB = `${normaliseName(a.name)}|${normaliseName(b.name)}`;
    const keyBA = `${normaliseName(b.name)}|${normaliseName(a.name)}`;
    // Keep the minimum if duplicates exist (multiple routes)
    const existing = lookup.get(keyAB);
    if (existing === undefined || conn.time < existing) {
      lookup.set(keyAB, conn.time);
      lookup.set(keyBA, conn.time);
    }
  }
  return lookup;
}

// ---------------------------------------------------------------------------
// Fetch TfL data
// ---------------------------------------------------------------------------

async function fetchAllLines(): Promise<TflLine[]> {
  console.log(`  Fetching lines for modes: ${MODES.join(", ")}…`);
  const lines = await tflGet<TflLine[]>(
    `/Line/Mode/${MODES.join(",")}`
  );
  console.log(`  Found ${lines.length} lines`);
  return lines;
}

async function fetchRouteSequence(
  lineId: string
): Promise<TflRouteSequence | null> {
  try {
    return await tflGet<TflRouteSequence>(
      `/Line/${lineId}/Route/Sequence/inbound`
    );
  } catch (err) {
    console.warn(`  Warning: could not fetch sequence for ${lineId}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core build logic
// ---------------------------------------------------------------------------

async function build(): Promise<void> {
  if (!API_KEY) {
    console.warn(
      "Warning: TFL_API_KEY not set. Requests may be rate-limited.\n"
    );
  }

  // 1. Load reference data
  console.log("\n[1/4] Loading nicola/tubemaps reference data…");
  const { stationMap: nicolaStations, connections: nicolaConnections } =
    await loadNicolaData();
  const nicolaLookup = buildNicolaLookup(nicolaStations, nicolaConnections);
  console.log(`  Built ${nicolaLookup.size / 2} unique segment lookup pairs`);

  // 2. Fetch all TfL lines
  console.log("\n[2/4] Fetching TfL line list…");
  const allLines = await fetchAllLines();

  // 3. Fetch route sequences and build graph
  console.log("\n[3/4] Fetching route sequences and building graph…");

  const stationsMap = new Map<string, Station>(); // keyed by NaPTAN id
  const connectionsMap = new Map<string, Connection>(); // keyed by "from|to|line"

  let nicolaHits = 0;
  let haversineHits = 0;

  for (const line of allLines) {
    process.stdout.write(`  Processing: ${line.name.padEnd(40)}`);

    const seq = await fetchRouteSequence(line.id);
    if (!seq) {
      console.log("SKIPPED");
      continue;
    }

    // Collect the longest stop sequence for this line (most complete route)
    const longestSequence = seq.stopPointSequences.reduce(
      (best, current) =>
        current.stopPoint.length > best.stopPoint.length ? current : best,
      seq.stopPointSequences[0]
    );

    if (!longestSequence) {
      console.log("NO SEQUENCE");
      continue;
    }

    const stops = longestSequence.stopPoint;
    let lineNicolaHits = 0;
    let lineHaversineHits = 0;

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];

      // Register station
      if (!stationsMap.has(stop.id)) {
        stationsMap.set(stop.id, {
          id: stop.id,
          name: stop.name
            .replace(/\s*Underground\s*Station\s*$/i, "")
            .replace(/\s*Station\s*$/i, "")
            .trim(),
          lines: [],
          lat: stop.lat,
          lng: stop.lon,
          zone: stop.zone ?? "unknown",
        });
      }

      // Add line to station's line list
      const station = stationsMap.get(stop.id)!;
      if (!station.lines.includes(line.id)) {
        station.lines.push(line.id);
      }

      // Register edge to next stop
      if (i < stops.length - 1) {
        const next = stops[i + 1];
        const edgeKey = `${stop.id}|${next.id}|${line.id}`;

        if (!connectionsMap.has(edgeKey)) {
          let travelTime: number;

          if (TUBE_LINE_IDS.has(line.id)) {
            // Try nicola/tubemaps lookup
            const lookupKey = `${normaliseName(stop.name)}|${normaliseName(next.name)}`;
            const nicolaTime = nicolaLookup.get(lookupKey);

            if (nicolaTime !== undefined) {
              travelTime = nicolaTime;
              lineNicolaHits++;
              nicolaHits++;
            } else {
              // Fallback to haversine even for tube lines
              travelTime = approxTravelTime(
                stop.lat,
                stop.lon,
                next.lat,
                next.lon
              );
              lineHaversineHits++;
              haversineHits++;
            }
          } else {
            // Elizabeth line / Overground: always haversine
            travelTime = approxTravelTime(
              stop.lat,
              stop.lon,
              next.lat,
              next.lon
            );
            lineHaversineHits++;
            haversineHits++;
          }

          connectionsMap.set(edgeKey, {
            from: stop.id,
            to: next.id,
            line: line.id,
            travelTime,
          });

          // Add reverse edge (same weight — trains run both directions)
          const reverseKey = `${next.id}|${stop.id}|${line.id}`;
          if (!connectionsMap.has(reverseKey)) {
            connectionsMap.set(reverseKey, {
              from: next.id,
              to: stop.id,
              line: line.id,
              travelTime,
            });
          }
        }
      }
    }

    console.log(
      `OK (${stops.length} stops, ${lineNicolaHits} FOI / ${lineHaversineHits} approx)`
    );

    // Avoid hammering the API
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // 4. Write output files
  console.log("\n[4/4] Writing output files…");

  const stations = Array.from(stationsMap.values());
  const connections = Array.from(connectionsMap.values());

  const outDir = path.resolve("client/src/data");
  await fs.mkdir(outDir, { recursive: true });

  await fs.writeFile(
    path.join(outDir, "stations.json"),
    JSON.stringify(stations, null, 2)
  );

  await fs.writeFile(
    path.join(outDir, "connections.json"),
    JSON.stringify(connections, null, 2)
  );

  // Summary
  console.log("\n========================================");
  console.log("Build complete");
  console.log(`  Stations  : ${stations.length}`);
  console.log(`  Connections: ${connections.length}`);
  console.log(
    `  Travel times: ${nicolaHits} FOI-derived, ${haversineHits} haversine approximations`
  );
  console.log(`  Output: ${outDir}/`);
  console.log("========================================\n");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
