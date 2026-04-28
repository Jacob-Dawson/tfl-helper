import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { useGraph } from "../lib/GraphContext"
import { useTflStatus } from "../hooks/useTflStatus"
import { findMeetingPoint } from "../lib/meetingPoint"
import StationSearch from "../components/StationSearch"
import TubeMap from "../components/TubeMap"
import type { Station, MeetingPointResult, JourneyStep, PersonResult } from "../lib/types"

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
    liberty: "#747678",
    //"london-overground": "#EF7B10"
    interchange: "#6b7280"
}

const LINE_NAMES: Record<string, string> = {
    bakerloo: "Bakerloo",
    central: "Central",
    circle: "Circle",
    district: "District",
    "hammersmith-city": "Hammersmith & City",
    jubilee: "Jubilee",
    metropolitan: "Metropolitan",
    northern: "Northern",
    piccadilly: "Piccadilly",
    victoria: "Victoria",
    "waterloo-city": "Waterloo & City",
    "elizabeth-line": "Elizabeth line",
    lioness: "Lioness",
    mildmay: "Mildmay",
    windrush: "Windrush",
    weaver: "Weaver",
    suffragette: "Suffragette",
    liberty: "Liberty",
    interchange: "Walk"
}

const MAX_PEOPLE = 6;
const MIN_PEOPLE = 2;

const PERSON_COLORS = [
  "#60a5fa",
  "#a78bfa",
  "#34d399",
  "#f97316",
  "#f43f5e",
  "#facc15"
];

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

function JourneyBreakdown({
    steps,
    label,
    accentColor
}: {
    steps: JourneyStep[];
    label: string;
    accentColor: string;
}){

    if(!steps.length) return null;

    // Group consecutive steps by line into segments
    type Segment = { 
        line: string; 
        stations: string[];
        towards: string;
        totalMins: number;
    };
    const segments: Segment[] = [];

    for(let i = 0; i < steps.length; i++){

        const step = steps[i];
        const last = segments[segments.length - 1];

        if(!last || (step.isChange && step.line !== "")){

            // When changing lines, include the previous station as the boarding point for the new segment so theres no gap
            const boardAt = step.isChange && i > 0 ? steps[i - 1].stationName : step.stationName;

            segments.push({
                line: step.line,
                stations: step.isChange && i > 0
                    ? [boardAt, step.stationName]
                    : [step.stationName],
                towards: "", // filled in below
                totalMins: step.travelTime
            })

        } else {

            last.stations.push(step.stationName)
            last.totalMins += step.travelTime

        }

    }

    // "towards" = last station in each segment (interchange or destination)

    for(const seg of segments){

        seg.towards = seg.stations[seg.stations.length - 1]

    }

    return (
        <div className="mt-4">
            <p 
                className="text-xs uppercase tracking-widest font-medium mb-3"
                style={{color: accentColor}}
            >
                {label}'s Journey
            </p>
            <div className="space-y-4">
                {segments.map((seg, i) => (
                    <div key={i} className="flex gap-3">
                        {/* Line indicator */}
                        <div className="flex flex-col items-center gap-1 pt-1">
                            <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{
                                    backgroundColor: LINE_COLOURS[seg.line] ?? "#666"
                                }}
                            />
                            {i < segments.length - 1 && (
                                <div
                                    className="w-0.5 flex-1 min-h-4"
                                    style={{
                                        backgroundColor: LINE_COLOURS[seg.line] ?? "#666"
                                    }}
                                />
                            )}
                        </div>

                        {/* Segment content */}
                        <div className="pb-3 flex-1">
                            <div className="flex items-center justify-between mb-1">
                                {/*Line name + direction */}
                                <p className="text-xs font-semibold text-gray-300 mb-1">
                                    {LINE_NAMES[seg.line] ?? seg.line}
                                    <span className="text-gray-500 font-normal">
                                        {" "}· towards {seg.towards}
                                    </span>
                                </p>
                                <span className="text-xs text-gray-500 shrink-0 ml-2">
                                    {seg.totalMins} min
                                </span>
                            </div>

                            {/* Stations */}
                            {seg.stations.map((name, j) => {
                                const isFirst = j === 0;
                                const isLast = j === seg.stations.length - 1;
                                const isIntermediate = !isFirst && !isLast;
                                const isCollapsed = isIntermediate && seg.stations.length > 3 && j !== 1
                                const isCollapseLabel = isIntermediate && seg.stations.length > 3 && j === 1

                                return(
                                    <p
                                        key={j}
                                        className={`text-sm ${
                                            isFirst || isLast
                                                ? "text-white font-medium"
                                                : "text-gray-500"
                                        }`}
                                    >
                                        {isCollapsed
                                            ? null
                                            : isCollapseLabel
                                            ? ` ${seg.stations.length - 2} stops`
                                            : name}
                                    </p>
                                )
                            })}

                            {/* Change indicator */}
                            {i < segments.length - 1 && (
                                <p className="text-xs text-amber-500 mt-1.5 font-medium">
                                    ⇄ Change at {seg.stations[seg.stations.length - 1]}
                                </p>
                            )}

                        </div>
                    </div>
                ))}
            </div>
        </div>
    )

}

function ResultCard({
    result
}: {
    result: MeetingPointResult
}){

    const [showJourney, setShowJourney] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const fairnessDiff = result.maxTime - Math.min(...result.people.map((p) => p.travelTime))

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

            {/* Per Person Travel times */}
            <div className="divide-y divide-gray-800">
                {result.people.map((person) => (
                    <div
                        key={person.label}
                        className="px-6 py-4 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2.5">
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{backgroundColor: person.accentColor}}
                            />
                            <div>
                                <p className="text-xs text-gray-500">
                                    {person.label}
                                </p>
                                <p className="text-sm text-gray-300">
                                    {person.stationName}
                                </p>
                            </div>
                        </div>
                        <p 
                            className="font-bold"
                            style={{ color: person.accentColor}}
                        >
                            {person.travelTime}
                            <span className="text-sm font-normal text-gray-500 ml-1">
                                min
                            </span>
                        </p>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-950 border-t border-gray-700 flex items-center justify-between">
                <p className="text-sm text-gray-400">
                    Total:{" "}
                    <span className="text-white font-medium">{result.totalTime} min</span>
                </p>
                <p className="text-sm text-gray-400">
                    Fairness:{" "}
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

            {/* Journey breakdown toggle */}
            <div className="border-t border-gray-700">
                <button
                    onClick={() => setShowJourney((v) => !v)}
                    className="w-full px-6 py-3 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center justify-between"
                >
                    <span>Show journey breakdown</span>
                    <span className="text-lg leading-none">{showJourney ? "↑" : "↓"}</span>
                </button>

                {showJourney && (
                    <div className="px-6 pb-6 border-t border-gray-800 pt-4 space-y-6">
                        {result.people.map((person) => (
                            <JourneyBreakdown
                                key={person.label}
                                steps={person.path}
                                label={person.label}
                                accentColor={person.accentColor}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Map toggle */}
            <div className="border-t border-gray-700">
                <button
                    onClick={() => setShowMap((v) => !v)}
                    className="w-full px-6 py-3 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center justify-between"
                >
                    <span>Show route map</span>
                    <span className="text-lg leading-none">
                        {showMap ? "↑" : "↓"}
                    </span>
                </button>

                {showMap && (
                    <div className="px-4 pb-4 border-t border-gray-800 pt-4">
                        <TubeMap result={result} />
                    </div>
                )}
            </div>
        </div>
    )

}

export default function MeetingPoint(){

    const { graph, stations, loading: graphLoading } = useGraph();
    const { statuses, disruptions, loading: statusLoading } = useTflStatus();
    const [searchParams, setSearchParams] = useSearchParams();

    const [people, setPeople] = useState<(Station | null)[]>([null, null])
    const [result, setResult] = useState<MeetingPointResult | null>(null);
    const [calculating, setCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedLine, setExpandedLine] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Restore stations from URL params on load
    useEffect(() => {
        if(!stations.length || !graph) return;

        const ids: string[] = [];
        let i = 0;
        while(true){

            const id = searchParams.get(`p${i}`)
            if(!id) break;
            ids.push(id);
            i++;

        }

        if(ids.length < 2) return

        const resolved = ids.map((id) => stations.find((s) => s.id === id) ?? null)
        setPeople(resolved)

        const validIds = resolved
            .filter((s): s is Station => s !== null)
            .map((s) => s.id)

        if(validIds.length >= 2){

            setCalculating(true);
            setTimeout(() => {

                const found = findMeetingPoint(graph, validIds, disruptions)
                if(!found){

                    setError("No meeting point found.")

                } else {

                    setResult(found);

                }

                setCalculating(false);

            }, 50)

        }

    }, [stations, graph])

    function handleFind(){

        if(!graph) return;

        const validStations = people.filter((s): s is Station => s !== null)

        if(validStations.length < 2) {

            setError("Please choose two different stations.")
            return

        }

        const uniqueIds = new Set(validStations.map((s) => s.id));
        if(uniqueIds.size !== validStations.length){

            setError("Please choose different stations for each person.")
            return

        }

        // Update URL params
        const params: Record<string, string> = {}
        validStations.forEach((s, i) => { params[`p${i}`] = s.id})
        setSearchParams(params)

        setCalculating(true);
        setError(null);
        setResult(null);

        // Small timeout so the loading state renders before the synchronous Dijkstra calculation blocks the thread
        setTimeout(() => {

            const found = findMeetingPoint(
                graph, 
                validStations.map((s) => s.id),
                disruptions
            )

            if(!found){

                setError("No meeting point found between those stations.")

            } else {

                setResult(found);

            }
            setCalculating(false);

        }, 50)

    }

    function handleCopyLink(){

        navigator.clipboard.writeText(window.location.href).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });

    }

    function addPerson(){

        if(people.length >= MAX_PEOPLE) return
        setPeople((prev) => [...prev, null])
        setResult(null)

    }

    function removePerson(index: number){

        if(people.length <= MIN_PEOPLE) return;
        setPeople((prev) => prev.filter((_,i) => i !== index))
        setResult(null)

    }

    function updatePerson(index: number, station: Station | null){

        setPeople((prev) => prev.map((s, i) => (i === index ? station : s)))
        setResult(null);

    }

    const canFind = !!graph && people.filter((s) => s !== null).length >= 2 && !calculating;

    // Disrupted lines (severity < 10 = not good service)
    const disruptedLines = Array.from(statuses.values()).filter(
        (s) => s.severity < 10
    )

    return (
        <main className="min-h-screen bg-gray-950 text-white">
            <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                <div>
                <h1 className="text-lg font-bold tracking-tight">TfL Meeting Point</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                    Dijkstra-optimised · Live disruption aware
                </p>
                </div>
                <div className="text-xs text-gray-600">
                {statusLoading ? (
                    "Fetching live status…"
                ) : (
                    <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    Live
                    </span>
                )}
                </div>
            </header>

            <div className="max-w-lg mx-auto px-6 py-10">
                {graphLoading ? (
                <div className="text-center text-gray-500 py-20">
                    Loading network graph…
                </div>
                ) : (
                <>
                    {/* Person inputs */}
                    <div className="space-y-3">
                    {people.map((station, i) => (
                        <div key={i}>
                        <div className="flex items-center justify-between mb-2">
                            <label
                            className="text-xs uppercase tracking-widest font-medium"
                            style={{ color: PERSON_COLORS[i] ?? "#fff" }}
                            >
                            Person {String.fromCharCode(65 + i)}
                            </label>
                            {i >= MIN_PEOPLE && (
                            <button
                                onClick={() => removePerson(i)}
                                className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                            >
                                Remove
                            </button>
                            )}
                        </div>
                        <StationSearch
                            stations={stations}
                            value={station}
                            onChange={(s) => updatePerson(i, s)}
                            placeholder="Search for a station…"
                            accentColor={PERSON_COLORS[i] ?? "#fff"}
                        />
                        </div>
                    ))}
                    </div>

                    {/* Add person */}
                    {people.length < MAX_PEOPLE && (
                    <button
                        onClick={addPerson}
                        className="mt-3 w-full py-2 rounded-lg text-sm text-gray-500
                                border border-dashed border-gray-700 hover:border-gray-500
                                hover:text-gray-300 transition-colors"
                    >
                        + Add person
                    </button>
                    )}

                    {/* Actions */}
                    <div className="mt-6 flex gap-3">
                    <button
                        onClick={handleFind}
                        disabled={!canFind}
                        className="flex-1 py-3 rounded-lg font-semibold text-sm transition-all
                                disabled:opacity-40 disabled:cursor-not-allowed
                                bg-blue-600 hover:bg-blue-500 active:scale-95"
                    >
                        {calculating ? "Calculating…" : "Find Meeting Point"}
                    </button>

                    {result && (
                        <button
                        onClick={handleCopyLink}
                        className="px-4 py-3 rounded-lg text-sm font-medium transition-all
                                    bg-gray-800 hover:bg-gray-700 active:scale-95 shrink-0"
                        >
                        {copied ? "Copied ✓" : "Share"}
                        </button>
                    )}
                    </div>

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
                            className="rounded-lg bg-gray-900 border border-gray-800 overflow-hidden"
                            >
                            <button
                                onClick={() =>
                                setExpandedLine(
                                    expandedLine === line.id ? null : line.id
                                )
                                }
                                className="w-full flex items-center justify-between px-4 py-2.5
                                        hover:bg-gray-800 transition-colors"
                            >
                                <div className="flex items-center gap-2.5">
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{
                                    backgroundColor: LINE_COLOURS[line.id] ?? "#666",
                                    }}
                                />
                                <span className="text-sm text-gray-300">
                                    {line.name}
                                </span>
                                </div>
                                <div className="flex items-center gap-2">
                                <SeverityBadge
                                    description={line.description}
                                    severity={line.severity}
                                />
                                <span className="text-gray-600 text-sm">
                                    {expandedLine === line.id ? "↑" : "↓"}
                                </span>
                                </div>
                            </button>

                            {expandedLine === line.id && line.reason && (
                                <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-400 leading-relaxed space-y-2">
                                {line.reason.split("\n\n").map((r, i) => (
                                    <p key={i}>{r}</p>
                                ))}
                                </div>
                            )}

                            {expandedLine === line.id && !line.reason && (
                                <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500 italic">
                                No further details available.
                                </div>
                            )}
                            </div>
                        ))}
                        </div>
                    </div>
                    )}
                </>
                )}
            </div>
        </main>
    );
}