import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import { useGraph } from "../lib/GraphContext";
import type { MeetingPointResult } from "../lib/types";

interface Props {

    result: MeetingPointResult;

}

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
    lioness: "#FC9B0A",
    mildmay: "#0060A8",
    windrush: "#E51836",
    weaver: "#9B0058",
    suffragette: "#00853D",
    liberty: "#747678",
    interchange: "#9ca3af",
};

function makeCircleMarker(color: string, size: number = 10): L.DivIcon{

    return L.divIcon({
        className: "",
        html: `<div style="
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border: 2px solid #111827;
            border-radius: 50%;
            box-shadow: 0 0 6px ${color}88;
        "></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    })

}

function makeLabel(name: string, color: string, isMeeting: boolean): L.DivIcon {
 
    return L.divIcon({
        className: "",
        html: `
            <div style="
                display:flex;
                flex-direction: column;
                align-items: center;
                gap: 3px;"
            >
                <div style="
                    width: ${isMeeting ? 14 : 10}px;
                    height: ${isMeeting ? 14 : 10}px;
                    background: ${color};
                    border: 2px solid #111827;
                    border-radius: 50%;
                    box-shadow: 0 0 ${isMeeting ? 10 : 6}px ${color}88;
                "></div>
                <div style="
                    background: #111827cc;
                    color: ${color};
                    font-size: ${isMeeting ? 11 : 9}px;
                    font-weight: ${isMeeting ? "bold" : "normal"};
                    font-family: sans-serif;
                    padding: 2px 5px;
                    border-radius: 4px;
                    white-space: nowrap;
                    border: 1px solid ${color}44;
                    backdrop-filter: blur(4px);
                ">${name}</div>
            </div>`,
        iconSize: [120, 40],
        iconAnchor: [60, 8]
    })

}

// London lat/lng bounds with a small margin
const BOUNDS = {
    minLng: -0.56,
    maxLng: -0.32,
    minLat: 51.28,
    maxLat: 51.72
};

const MARGIN = 24;
const HEIGHT = 480;

export default function TubeMap({ result }: Props){

    const {stations, connections } = useGraph();
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

    // Build station lookup
    const stationMap = useMemo(
        () => new Map(stations.map((s) => [s.id, s])),
        [stations]
    )

    // Build scales based on container width
    useEffect(() => {

        if(!containerRef.current || mapRef.current) return;

        // Initialise map
        const map = L.map(containerRef.current, {
            zoomControl: true,
            attributionControl: true
        })

        mapRef.current = map;

        // CartoDB Dark Matter tile layer
        L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
            {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
                subdomains: "abcd",
                maxZoom: 19
            }
        ).addTo(map)

        // Collect all coordinates for bounds fitting

        const allLatLngs: L.LatLngTuple[] = []

        // Draw journey paths per person
        for(const person of result.people){

            const path = person.path;

            for(let i = 1; i < path.length; i++){

                const fromStep = path[i - 1]
                const toStep = path[i]

                const fromStation = stationMap.get(fromStep.stationId)
                const toStation = stationMap.get(toStep.stationId)
                if(!fromStation || !toStation) continue

                const from: L.LatLngTuple = [fromStation.lat, fromStation.lng]
                const to: L.LatLngTuple = [toStation.lat, toStation.lng]

                allLatLngs.push(from, to)

                const isInterchange = toStep.line === "interchange"
                const lineColour = isInterchange
                    ? person.accentColor
                    : (LINE_COLOURS[toStep.line] ?? person.accentColor)

                L.polyline([from, to], {
                    color: person.accentColor,
                    weight: isInterchange ? 2 : 4,
                    opacity: isInterchange ? 0.6 : 0.9,
                    dashArray: isInterchange ? "6 5" : undefined
                }).addTo(map)

            }

        }

        // Collect labelled stations: origins, meeting point, interchanges

        type LabelledStation = {
            stationId: string;
            label: string;
            color: string;
            isMeeting: boolean;
        }

        const labelled = new Map<string, LabelledStation>()

        // Meeting point - always white
        labelled.set(result.station.id, {
            stationId: result.station.id,
            label: result.station.name,
            color: "#ffffff",
            isMeeting: true
        })

        for(const person of result.people){

            // Origin station
            const originId = person.path[0]?.stationId
            if(originId && !labelled.has(originId)){

                labelled.set(originId, {
                    stationId: originId,
                    label: person.path[0].stationName,
                    color: person.accentColor,
                    isMeeting: false
                })

            }

            for(const step of person.path){

                if(step.isChange && !labelled.has(step.stationId)){

                    labelled.set(step.stationId, {
                        stationId: step.stationId,
                        label: step.stationName,
                        color: person.accentColor,
                        isMeeting: false
                    })

                }

            }

        }

        // Place labelled markers
        for(const entry of labelled.values()){

            const s = stationMap.get(entry.stationId)
            if(!s) continue

            L.marker([s.lat, s.lng], {
                icon: makeLabel(entry.label, entry.color, entry.isMeeting),
                zIndexOffset: entry.isMeeting ? 1000 : 500
            }).addTo(map)

        }

        // Fit map to journey bounds with padding

        if(allLatLngs.length > 0){

            map.fitBounds(L.latLngBounds(allLatLngs), { padding: [48, 48]})

        } else {

            // Fallback to central London
            map.setView([51.505, -0.09], 11)

        }

        return () => {

            map.remove();
            mapRef.current = null

        }

    }, [result, stationMap, connections])


    return (
        <div className="w-full rounded-lg overflow-hidden border border-gray-800">
            <div 
                ref={containerRef}
                style={{height: "420px", width: "100%"}}
            />
            <p className="text-xs text-gray-600 px-3 py-2 bg-gray-950">
                Scroll to zoom · drag to pan
            </p>
        </div>
    )

}