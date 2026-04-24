import type { Station, Connection, Graph } from "./types";

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

    return graph;
}