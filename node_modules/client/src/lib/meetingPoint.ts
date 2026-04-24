import type { Graph, DijkstraResult, MeetingPointResult } from "./types";
import { dijkstra } from "./dijkstra";

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
    stationAId: string,
    stationBId: string,
    disruptions: Map<string, number> = new Map()
): MeetingPointResult | null {

    const adjustedGraph = applyDisruptions(graph, disruptions);

    const resultA: DijkstraResult = dijkstra(adjustedGraph, stationAId);
    const resultB: DijkstraResult = dijkstra(adjustedGraph, stationBId);

    let best: MeetingPointResult | null = null;

    for(const [id, node] of adjustedGraph.entries()){

        const timeFromA = resultA.distances.get(id) ?? Infinity;
        const timeFromB = resultB.distances.get(id) ?? Infinity;

        // Skip unreachable stations
        if(timeFromA === Infinity || timeFromB === Infinity) continue;

        // Skip source stations themselves
        if(id === stationAId || id === stationBId) continue;

        const totalTime = timeFromA + timeFromB;
        const maxTime = Math.max(timeFromA, timeFromB);

        if(
            best === null ||
            maxTime < Math.max(best.timeFromA, best.timeFromB) ||
            (maxTime === Math.max(best.timeFromA, best.timeFromB) && 
            totalTime < best.totalTime)
        ) {
            best = {
                station: node.station,
                timeFromA,
                timeFromB,
                totalTime
            };
        }

    }

    return best;

}