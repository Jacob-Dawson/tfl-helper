import type { Station, Connection, Graph } from "./types";

// Walking interchange time in minutes between platforms at the same station.
// A flat penalty is a reasonable approximation for a portfolio project
const INTERCHANGE_TIME = 3;

// Some major stations have longer walks between platforms.'
const INTERCHANGE_OVERRIDES: Record<string, number> = {
    "paddington": 5,
    "king's cross st. pancras": 8,
    "moorgate": 4,
    "liverpool street": 6,
    "waterloo": 7,
    "bank": 8,
    "stratford": 5
}

export function buildGraph(
    stations: Station[],
    connections: Connection[]
): Graph {
    const graph: Graph = new Map();

    // Initialise every station as a node with no edges
    for(const station of stations){
        graph.set(station.id, { station, edges: []});
    }

    // Add edges from connections
    for(const conn of connections){

        const node = graph.get(conn.from)
        if(!node) continue;
        node.edges.push({
            to: conn.to,
            line: conn.line,
            travelTime: conn.travelTime
        })

    }

    // Add interchange edges between stations sharing the same name but having different NaPTAN IDs (eg Paddington tube vs Elizabeth line). Without these, cross-line journeys through such stations are impossible.

    // Group stations by normalised name
    const byName = new Map<string, Station[]>();
    for(const station of stations){

        const key = station.name.toLowerCase().trim();
        const group = byName.get(key) ?? [];
        group.push(station);
        byName.set(key, group);

    }

    for(const [name, group] of byName.entries()){

        if(group.length < 2) continue;

        const walkTime = INTERCHANGE_OVERRIDES[name] ?? INTERCHANGE_TIME;

        // Add bidirectional interchange edges between every pair in the group
        for(let i=0; i < group.length; i++){

            for(let j = i + 1; j < group.length; j++){

                const a = group[i];
                const b = group[j];

                const nodeA = graph.get(a.id);
                const nodeB = graph.get(b.id);
                if(!nodeA || !nodeB) continue;

                // Only add if not already connected
                const alreadyAtoB = nodeA.edges.some((e) => e.to === b.id);
                const alreadyBtoA = nodeB.edges.some((e) => e.to === a.id);

                if(!alreadyAtoB){

                    nodeA.edges.push({
                        to: b.id,
                        line: "interchange",
                        travelTime: walkTime
                    })

                }

                if(!alreadyBtoA){

                    nodeB.edges.push({
                        to: a.id,
                        line: "interchange",
                        travelTime: walkTime
                    })

                }

            }

        }

    }

    return graph;
}