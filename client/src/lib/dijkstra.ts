import type { Graph, DijkstraResult, JourneyStep} from "./types";

// Min-heap priority queue - Each entry is [priority, stationId]

type HeapEntry = [number, string]

class MinHeap {
    private heap: HeapEntry[] = [];

    push(entry: HeapEntry): void {
        this.heap.push(entry);
        this.bubbleUp(this.heap.length - 1);
    }

    pop(): HeapEntry | undefined {
        if(this.heap.length === 0) return undefined;
        const top = this.heap[0]
        const last = this.heap.pop()!;
        if(this.heap.length > 0){

            this.heap[0] = last;
            this.sinkDown(0);

        }
        return top;
    }

    get size(): number {

        return this.heap.length;

    }

    private bubbleUp(i: number): void {

        while(i > 0){
            const parent = Math.floor((i - 1) / 2);
            if(this.heap[parent][0] <= this.heap[i][0]) break;
            [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
            i = parent
        }

    }

    private sinkDown(i: number): void {

        const n = this.heap.length;
        while(true){

            let smallest = i;
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            if(left < n && this.heap[left][0] < this.heap[smallest][0])
                smallest = left
            if(right < n && this.heap[right][0] < this.heap[smallest][0])
                smallest = right;
            if(smallest === i) break;
            [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
            i = smallest

        }

    }
}

// Dijkstra's algorithm - O(E + V log V) - Returns the shortest distances and previous node map from a single source.

export function dijkstra(graph: Graph, sourceId: string): DijkstraResult {
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const lineUsed = new Map<string, string>();
    const visited = new Set<string>();
    const pq = new MinHeap();

    // Initialize all distances to Infinity
    for(const id of graph.keys()){

        distances.set(id, Infinity);
        previous.set(id, null);

    }

    distances.set(sourceId, 0);
    pq.push([0, sourceId]);
    
    while(pq.size > 0){

        const [currentDist, currentId] = pq.pop()!;

        if(visited.has(currentId)) continue;
        visited.add(currentId);

        const node = graph.get(currentId);
        if(!node) continue;

        for(const edge of node.edges){

            if(visited.has(edge.to)) continue;

            const newDist = currentDist + edge.travelTime;
            const known = distances.get(edge.to) ?? Infinity;

            if(newDist < known){

                distances.set(edge.to, newDist);
                previous.set(edge.to, currentId);
                lineUsed.set(edge.to, edge.line);
                pq.push([newDist, edge.to])

            }

        }

    }

    return { distances, previous, lineUsed };
}

// Reconstruct the path from source to target using the previous node map

export function reconstructPath(

    graph: Graph,
    result: DijkstraResult,
    targetId: string

): JourneyStep[] {

    const { previous, lineUsed } = result;
    const steps: JourneyStep[] = [];

    let current: string | null = targetId;

    while(current !== null){

        const node = graph.get(current)
        if(!node) break;

        const line = lineUsed.get(current) ?? "";
        steps.unshift({
            stationId: current,
            stationName: node.station.name,
            line,
            isChange: false // calculated below
        })

        current = previous.get(current) ?? null;

    }

    // Annotate line changes
    for(let i = 1; i < steps.length; i++){

        steps[i].isChange = steps[i].line !== steps[i - 1].line && steps[i - 1].line !== "";

    }

    return steps;
}