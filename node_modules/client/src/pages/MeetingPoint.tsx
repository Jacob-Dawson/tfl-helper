import { useState } from "react"
import { useGraph } from "../lib/GraphContext"
import { useTflStatus } from "../hooks/useTflStatus"
import { findMeetingPoint } from "../lib/meetingPoint"
import StationSearch from "../components/StationSearch"
import type { Station, MeetingPointResult } from "../lib/types"

// Tfl line brand colours - used for status pills
const LINE_COLOURS: Record<string, string> = {
    bakerloo: "#AE6017",
    central: "#F15B2E",
    circle: "#FFE02B",
    district: "#00A166",
    "hammersmith-city": "#F491A8",
    jubilee: "#949699",
    metropolitan: "#91005A",
    northern: "#000000",
    piccadilly: "#094FA3",
    victoria: "#0A9CDA",
    "waterloo-city": "#88D0C4",
    "elizabeth-line": "#6950A1",
    // Overground - 6 named lines (rebrand 2024)
    lioness: "#FC9B0A",
    mildmay: "#0060A8",
    windrush: "#E51836",
    weaver: "#9B0058",
    suffragette: "#00853D",
    liberty: "#747678"
    //"london-overground": "#EF7B10"
}

function SeverityBadge({ description, severity }: {description: string; severity: number}){

    const color = 
        severity <= 1
            ? "#ef4444"
            : severity <= 6
            ? "#f97316"
            : severity <= 9
            ? "#eab308"
            : "#22c55e";

    return (
        <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: `${color}22`, color }}
        >
            {description}
        </span>
    )

}

function ResultCard({result}: {result: MeetingPointResult}){

    const fairnessDiff = Math.abs(result.timeFromA - result.timeFromB)

    return (
        <div className="mt-8 rounded-2xl border border-gray-700 bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-950 to-gray-900 px-6 py-5 border-b border-gray-700">
                <p className="text-xs text-blue-400 uppercase tracking-widest font-medium mb-1">
                    Optimal Meeting Point
                </p>
                <h2 className="text-2xl font-boold text-white">{result.station.name}</h2>
                <p className="text-sm text-gray-400 mt-1">Zone {result.station.zone}</p>
            </div>

            {/* Travel times */}
            <div className="grid grid-cols-2 divide-x divide-gray-700">
                <div className="px-6 py-5">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Person A
                    </p>
                    <p className="text-3xl font-bold text-blue-400">
                        {result.timeFromA}
                        <span className="text-base font-normal text-gray-500 ml-1">min</span>
                    </p>
                </div>
                <div className="px-6 py-5">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Person B
                    </p>
                    <p className="text-3xl font-bold text-violet-400">
                        {result.timeFromB}
                        <span className="text-base font-normal text-gray-500 ml-1">min</span>
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-950 border-t border-gray-700 flex items-center justify-between">
                <p className="text-sm text-gray-400">
                    Total travel time:{" "}
                    <span className="text-white font-medium">{result.totalTime} min</span>
                </p>
                <p className="text-sm text-gray-400">
                    Fairness offset:{" "}
                    <span
                        className={`font-medium ${
                            fairnessDiff <= 2
                                ? "text-green-400"
                                : fairnessDiff <= 5
                                ? "text-yellow-400"
                                : "text-orange-400"
                        }`}
                    >
                        {fairnessDiff === 0 ? "Perfect" : `±${fairnessDiff} min`}
                    </span>
                </p>
            </div>
        </div>
    )

}

export default function MeetingPoint(){

    const { graph, stations, loading: graphLoading } = useGraph();
    const { statuses, disruptions, loading: statusLoading } = useTflStatus();

    const [stationA, setStationA] = useState<Station | null>(null);
    const [stationB, setStationB] = useState<Station | null>(null);
    const [result, setResult] = useState<MeetingPointResult | null>(null);
    const [calculating, setCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function handleFind(){

        if(!graph || !stationA || !stationB) return;
        if(stationA.id === stationB.id) {

            setError("Please choose two different stations.")
            return

        }

        setCalculating(true);
        setError(null);
        setResult(null);

        // Small timeout so the loading state renders before the synchronous Dijkstra calculation blocks the thread
        setTimeout(() => {

            const found = findMeetingPoint(graph, stationA.id, stationB.id, disruptions)
            if(!found){

                setError("No meeting point found between those stations.")

            } else {

                setResult(found);

            }
            setCalculating(false);

        }, 50)

    }

    const canFind = !!graph && !!stationA && !!stationB && !calculating;

    // Disrupted lines (severity < 10 = not good service)
    const disruptedLines = Array.from(statuses.values()).filter(
        (s) => s.severity < 10
    )

    return(
        <main className="min-h-screen bg-gray-950 text-white">
            {/* Top bar */}
            <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold tracking-tight">TfL Meeting Point</h1>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Dijkstra-optimised · Live disruption aware
                    </p>
                </div>
                <div className="text-xs text-gray-600">
                    {statusLoading ? (
                        "Fetching live status..."
                    ) : (
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>
                            Live
                        </span>
                    )}
                </div>
            </header>

            <div className="max-w-lg mx-auto px-6 py-10">
                {graphLoading ? (
                    <div className="text-center text-gray-500 py-20">
                        Loading network graph...
                    </div>
                ) : (
                    <>
                        {/* Station inputs */}
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-blue-400 uppercase tracking-widest font-medium block mb-2">
                                    Person A
                                </label>
                                <StationSearch
                                    stations={stations}
                                    value={stationA}
                                    onChange={(s) => {setStationA(s); setResult(null);}}
                                    placeholder="Search for a station..."
                                    accentColor="#60a5fa"
                                />
                            </div>

                            <div className="flex items-center gap-3 py-1">
                                <div className="flex-1 h-px bg-gray-800"/>
                                <span className="text-xs text-gray-600">meets</span>
                                <div className="flex-1 h-px bg-gray-800"/>
                            </div>

                            <div>
                                <label className="text-xs text-violet-400 uppercase tracking-widest font-medium block mb-2">
                                    Person B
                                </label>
                                <StationSearch
                                    stations={stations}
                                    value={stationB}
                                    onChange={(s) => {setStationB(s); setResult(null);}}
                                    placeholder="Search for a station..."
                                    accentColor="#a78bfa"
                                />
                            </div>
                        </div>

                        {/* Find button */}
                        <button
                            onClick={handleFind}
                            disabled={!canFind}
                            className="mt-6 w-full py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 active:scale-95"
                        >
                            {calculating ? "Calculating..." : "Find Meeting Point"}
                        </button>

                        {/* Error */}
                        {error && (
                            <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
                        )}

                        {/* Result */}
                        {result && <ResultCard result={result} />}

                        {/* Live disruptions */}
                        {disruptedLines.length > 0 && (
                            <div className="mt-8">
                                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                                    Live Disruptions · affecting route weights
                                </p>
                                <div className="space-y-2">
                                    {disruptedLines.map((line) => (
                                        <div
                                            key={line.id}
                                            className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-800"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                                    style={{
                                                        backgroundColor:
                                                            LINE_COLOURS[line.id] ?? "#666"
                                                    }}
                                                />
                                                <span className="text-sm text-gray-300">{line.name}</span>
                                            </div>
                                            <SeverityBadge
                                                description={line.description}
                                                severity={line.severity}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    )
}