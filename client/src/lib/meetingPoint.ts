import type { Graph, DijkstraResult, MeetingPointResult, PersonResult } from "./types";
import { dijkstra, reconstructPath } from "./dijkstra";
import { PERSON_COLORS } from "./types";

// Distruption weight multipliers by Tfl severity code.
// Lower severity code = worse disruption in Tfl's scheme.

const SEVERITY_MULTIPLIERS: Record<number, number> = {
    0: Infinity,    // Suspended - treat as impassable
    1: 10,          // Closed
    5: 3,           // Part Suspended
    6: 2,           // Severe Delays
    9: 1.5,         // Minor Delays
    10: 1,          // Good Service
    20: 1           // Service Closed (planned)
}

function getMultiplier(severity: number): number{

    return SEVERITY_MULTIPLIERS[severity] ?? 1;

}

// Apply live disruption data to edge weights before running Dijkstra
// Returns a new graph with adjusted travel times - does not mutate the original.

export function applyDisruptions(
    graph: Graph,
    // Map of lineId -> Tfl severity code
    disruptions: Map<string, number>
): Graph {

    const adjusted: Graph = new Map();

    for(const [id, node] of graph.entries()){

        adjusted.set(id, {
            station: node.station,
            edges: node.edges.map((edge) => {
                const severity = disruptions.get(edge.line);
                const multiplier = 
                    severity !== undefined ? getMultiplier(severity) : 1;
                return {
                    ...edge,
                    travelTime:
                        multiplier === Infinity
                            ? 999999
                            : Math.round(edge.travelTime * multiplier)
                }
            })
        })

    }

    return adjusted;

}

// Find the optimal meeting point between two stations,

// Strategy: minimise max(timeFromA, timeFromB) - the "fairness" metric.
// This ensures neither person travels significantly more than the other.
// Falls back to minimising total time if no fair station exists.

export function findMeetingPoint(
    graph: Graph,
    stationIds: string[],
    disruptions: Map<string, number> = new Map()
): MeetingPointResult | null {

    if(stationIds.length < 2) return null;

    const adjustedGraph = applyDisruptions(graph, disruptions);

    // Run Dijkstra from every person's station
    const results: DijkstraResult[] = stationIds.map((id) => dijkstra(adjustedGraph, id))

    let best: MeetingPointResult | null = null;

    for(const [id, node] of adjustedGraph.entries()){

        const times = results.map((r) => r.distances.get(id) ?? Infinity)
        if(times.some((t) => t === Infinity)) continue;

        // Skip source stations
        if(stationIds.includes(id)) continue;

        const maxTime = Math.max(...times);
        const totalTime = times.reduce((a, b) => a + b, 0)

        if(
            best === null ||
            maxTime < best.maxTime ||
            (maxTime === best.maxTime && 
            totalTime < best.totalTime)
        ) {
            best = {
                station: node.station,
                totalTime,
                maxTime,
                people: times.map((time, i) => ({
                    label: `Person ${String.fromCharCode(65 + i)}`,
                    accentColor: PERSON_COLORS[i] ?? "#fff",
                    stationName: "", // filled below
                    travelTime: time,
                    path: []
                }))
            };
        }

    }

    if(best){

        // Attach station names and reconstruct paths
        best.people = best.people.map((person, i) => ({
            ...person,
            stationName: graph.get(stationIds[i])?.station.name ?? stationIds[i],
            path: reconstructPath(adjustedGraph, results[i], best!.station.id)
        }))

    }

    return best;

}