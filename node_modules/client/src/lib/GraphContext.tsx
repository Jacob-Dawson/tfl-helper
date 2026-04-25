import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { buildGraph } from "./graph";
import type { Graph, Station, Connection } from "./types";

interface GraphContextValue{
    graph: Graph | null;
    stations: Station[];
    loading: boolean;
    error: string | null;
}

const GraphContext = createContext<GraphContextValue>({
    graph: null,
    stations: [],
    loading: true,
    error: null
})

export function GraphProvider({ children, }: {children: ReactNode }){
    const [graph, setGraph] = useState<Graph | null>(null);
    const [stations, setStations] = useState<Station[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load(){
            try{
                // Vite handles JSON imports natively - no fetch needed
                const [stationsModule, connectionsModule] = await Promise.all([
                    import("../data/stations.json"),
                    import("../data/connections.json")
                ])

                const stationsData = stationsModule.default as Station[];
                const connectionsData = connectionsModule.default as Connection[];

                const built = buildGraph(stationsData, connectionsData);
                setStations(stationsData);
                setGraph(built);

            } catch (err){

                setError(
                    err instanceof Error ? err.message : "Failed to load graph data"
                );

            } finally {

                setLoading(false);

            }
        }

        load();

    }, [])

    return (
        <GraphContext.Provider value={{ graph, stations, loading, error }}>
            {children}
        </GraphContext.Provider>
    )
}

export function useGraph(): GraphContextValue{

    return useContext(GraphContext)

}