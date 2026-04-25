import { useState, useMemo, useRef, useEffect } from "react";
import type { Station } from "../lib/types";

interface Props {
    stations: Station[];
    value: Station | null;
    onChange: (station: Station | null) => void;
    placeholder: string;
    accentColor: string;
}

export default function StationSearch({
    stations,
    value,
    onChange,
    placeholder,
    accentColor
}: Props) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        if(!query.trim()) return [];
        const q = query.toLowerCase();
        return stations
            .filter((s) => s.name.toLowerCase().includes(q))
            .slice(0, 8);
    }, [query, stations])

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent){
            if(!containerRef.current?.contains(e.target as Node)){
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick)
    }, [])

    function handleSelect(station: Station){

        onChange(station);
        setQuery(station.name);
        setOpen(false);

    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {

        setQuery(e.target.value);
        onChange(null);
        setOpen(true);

    }

    function handleClear(){

        setQuery("");
        onChange(null);
        setOpen(false);

    }

    // Sync input when value is set externally
    useEffect(() => {

        if(value) setQuery(value.name);

    }, [value])

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => query && setOpen(true)}
                    placeholder={placeholder}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm outline-none transition-all focus:border-opacity-100"
                    style={{
                        borderColor: open || value ? accentColor : undefined,
                        boxShadow: open || value ? `0 0 0 1px ${accentColor}22` : undefined
                    }}
                />
                {query && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors text-lg leading-none"
                    >
                        x
                    </button>
                )}
            </div>
            {open && filtered.length > 0 && (
                <ul
                    className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-2xl"
                >
                    {filtered.map((station) => (
                        <li key={station.id}>
                            <button
                                onMouseDown={() => handleSelect(station)}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center justify-between gap-2"
                            >
                                <span>{station.name}</span>
                                <span className="text-xs text-gray-600 shrink-0">
                                    Zone {station.zone}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {open && query.trim() && filtered.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-500">
                    No stations found
                </div>
            )}
        </div>
    )
}