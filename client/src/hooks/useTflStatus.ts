import { useState, useEffect } from "react";

export interface LineStatus{
    id: string;
    name: string;
    severity: number;       // TfL severity code
    description: string;    // eg. "Good service", "Minor Delays"
    reason: string; // full description reason from TfL
}

interface TflLineStatus{
    id: string;
    name: string;
    lineStatuses: Array<{
        statusSeverity: number;
        statusSeverityDescription: string;
        reason?: string;
    }>;
}

const MODES = "tube,elizabeth-line,overground";

export function useTflStatus(): {
    statuses: Map<string, LineStatus>;
    disruptions: Map<string, number>;
    loading: boolean;
    error: string | null;
} {

    const [statuses, setStatuses] = useState<Map<string, LineStatus>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {

        let cancelled = false;

        async function fetchStatus(){

            try {

                setLoading(true);
                setError(null);

                const apiKey = import.meta.env.VITE_TFL_API_KEY ?? "";
                const url = `/tfl/Line/Mode/${MODES}/Status${
                    apiKey ? `?app_key=${apiKey}` : ""
                }`;

                const res = await fetch(url);
                if(!res.ok) throw new Error(`TFL API error: ${res.status}`);

                const data: TflLineStatus[] = await res.json();

                if(cancelled) return;

                const map = new Map<string, LineStatus>();
                for(const line of data){

                    if(!line.lineStatuses?.length) continue;
                    // Takes the worst status
                    const worstStatus = line.lineStatuses.reduce((worst, current) => 
                        current.statusSeverity < worst.statusSeverity ? current : worst
                    );

                    // collect all unique reasons across all statuses
                    const allReasons = line.lineStatuses
                        .map((s) => s.reason ?? "")
                        .filter(Boolean)
                        .filter((r, i, arr) => arr.indexOf(r) === i) // deduplicate
                
                    map.set(line.id, {
                        id: line.id,
                        name: line.name,
                        severity: worstStatus.statusSeverity,
                        description: worstStatus.statusSeverityDescription,
                        reason: allReasons.join("\n\n")
                    });

                }

                setStatuses(map);

            } catch (err){

                if(!cancelled){

                    setError(err instanceof Error ? err.message : "Unknown error");

                }

            } finally {

                if(!cancelled) setLoading(false);

            }

        }

        fetchStatus();

        // Refresh every 60 seconds
        const interval = setInterval(fetchStatus, 60_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        }

    }, []);

    // Derive a disruptions map: lineId -> severity code
    // This is what gets passed into findMeetingPoint
    const disruptions = new Map<string, number>(
        Array.from(statuses.values()).map((s) => [s.id, s.severity])
    );

    return { statuses, disruptions, loading, error };

}