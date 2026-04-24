import type { NumberValue } from "d3";

export interface Station {
    id: string; // NaPTAN code
    name: string;
    lines: string[]; // TFL line ids 
    lat: number;
    lng: number;
    zone: string;
}

export interface Connection {
    from: string; // NaPTAN id
    to: string; // NaPTAN id
    line: string; // Tfl line id
    travelTime: number;
}

export interface Edge {
    to: string;
    line: string;
    travelTime: number;
}

export interface GraphNode {
    station: Station;
    edges: Edge[];
}

// Keyed by NaPTAN id
export type Graph = Map<string, GraphNode>;

export interface DijkstraResult {
    distances: Map<string, number>; // station id -> mins from source
    previous: Map<string, string | null>; // station id -> previous station id
}

export interface MeetingPointResult {
    station: Station;
    timeFromA: number;
    timeFromB: number;
    totalTime: number;
}