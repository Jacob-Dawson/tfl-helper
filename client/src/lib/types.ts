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
    // Tracks which line was used to reach each station
    lineUsed: Map<string, string>;
}

export interface JourneyStep {
    stationId: string;
    stationName: string;
    line: string;           // line taken FROM this station to the next
    isChange: boolean;      // true if line changes at this station
    travelTime: number;     // minutes to reach this step from the previous 
}

export interface PersonResult {
    label: string;          // "Person A", "Person B", etc
    accentColor: string;
    stationName: string;    // their origin station name
    travelTime: number;     // total minutes to meeting point
    path: JourneyStep[];
}

export interface MeetingPointResult {
    station: Station;
    totalTime: number;
    maxTime: number;        // the fairness metric - lowest max across all candidates
    people: PersonResult[];
}