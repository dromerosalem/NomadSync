import React, { useEffect, useRef, useState, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { Trip, ItineraryItem } from '../types';
import * as THREE from 'three';

interface MissionGlobeProps {
    trip: Trip;
    onClose: () => void;
}

const MissionGlobe: React.FC<MissionGlobeProps> = ({ trip, onClose }) => {
    const globeEl = useRef<any>();
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 1. Prepare Data: Items + Trip Destination
    const missionPoints = useMemo(() => {
        const points: any[] = [];

        // Helper to validate coords
        const isValid = (lat: any, lng: any) => {
            const nLat = Number(lat);
            const nLng = Number(lng);
            return !isNaN(nLat) && !isNaN(nLng) && nLat !== 0 && nLng !== 0;
        };

        trip.items
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
            .forEach((item, index) => {
                const lat = Number(item.latitude);
                const lng = Number(item.longitude);

                // Point A: Standard Location or Transport Origin
                if (isValid(lat, lng)) {
                    points.push({
                        id: item.id,
                        order: points.length + 1, // Dynamic ordering
                        name: item.title,
                        city: item.location || 'Unknown',
                        lat: lat,
                        lng: lng,
                        color: item.type === 'TRANSPORT' ? 'orange' : '#FCD34D', // Tactical Yellow
                        type: item.type
                    });
                }

                // Point B: Transport Destination (if exists and differs)
                if (item.type === 'TRANSPORT') {
                    const endLat = Number(item.endLatitude);
                    const endLng = Number(item.endLongitude);

                    if (isValid(endLat, endLng)) {
                        // Avoid duplicates if end == start (within small margin)
                        if (Math.abs(endLat - lat) > 0.001 || Math.abs(endLng - lng) > 0.001) {
                            points.push({
                                id: `${item.id}-end`,
                                order: points.length + 1,
                                name: `Arrival: ${item.endLocation || 'Destination'}`,
                                city: item.endLocation || 'Destination',
                                lat: endLat,
                                lng: endLng,
                                color: 'orange',
                                type: 'TRANSPORT_END'
                            });
                        }
                    }
                }
            });

        // Add Trip Destination as "HQ" or Base if coordinates exist
        if (isValid(trip.latitude, trip.longitude)) {
            points.unshift({
                id: 'mission-base',
                order: 0, // 0 for HQ/Base
                name: 'TRIP BASE',
                city: trip.destination,
                lat: Number(trip.latitude),
                lng: Number(trip.longitude),
                color: '#EF4444', // Red for Target
                type: 'STAY' // treated as location
            });
        }

        console.log('[MissionGlobe] Generated Points:', points);
        return points;
    }, [trip]);

    // 2. Prepare Arcs (Sequential Pathing)
    const missionArcs = useMemo(() => {
        const arcs = [];
        for (let i = 0; i < missionPoints.length - 1; i++) {
            arcs.push({
                startLat: missionPoints[i].lat,
                startLng: missionPoints[i].lng,
                endLat: missionPoints[i + 1].lat,
                endLng: missionPoints[i + 1].lng,
                color: ['rgba(252, 211, 77, 0.5)', 'rgba(255, 100, 0, 0.8)'] // Gradient
            });
        }
        return arcs;
    }, [missionPoints]);

    // 3. Auto-Focus Logic
    useEffect(() => {
        if (globeEl.current && missionPoints.length > 0) {
            // Initial fly-to view of the first point or center of points
            globeEl.current.pointOfView({ lat: missionPoints[0].lat, lng: missionPoints[0].lng, altitude: 2.5 }, 2000);

            // Enable auto-rotation
            globeEl.current.controls().autoRotate = true;
            globeEl.current.controls().autoRotateSpeed = 0.5;
        }
    }, [missionPoints]);

    return (
        <div className="fixed inset-0 z-50 bg-tactical-bg flex flex-col items-center justify-center animate-fade-in">
            {/* Mission HUD Header */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
                <div>
                    <div className="text-[10px] font-bold text-tactical-accent/80 uppercase tracking-widest">
                        TRIP OVERVIEW
                    </div>
                    <h1 className="font-display text-4xl font-bold text-white mt-1 drop-shadow-lg">
                        {trip.name}
                    </h1>
                    <div className="text-sm text-gray-400 font-mono mt-1">
                        {trip.destination} • {missionPoints.length} WAYPOINTS
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/20 hover:bg-white/10 text-white rounded-full p-3 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <Globe
                ref={globeEl}
                width={dimensions.width}
                height={dimensions.height}
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                backgroundColor="#0F172A" // tactical-bg hex approx
                atmosphereColor="rgba(100,149,237,0.2)"
                atmosphereAltitude={0.15}

                // Objects: HTML Markers (Rich UI)
                htmlElementsData={missionPoints}
                htmlLat={d => d.lat}
                htmlLng={d => d.lng}
                htmlElement={(d: any) => {
                    const el = document.createElement('div');
                    el.className = 'mission-marker-container';
                    el.style.transform = 'translate(-50%, -100%)'; // Pin bottom-center
                    el.style.cursor = 'pointer';
                    el.style.display = 'flex';
                    el.style.flexDirection = 'column';
                    el.style.alignItems = 'center';

                    // 1. City Label (Pill)
                    const label = document.createElement('div');
                    label.textContent = d.city || d.name;
                    Object.assign(label.style, {
                        background: 'white',
                        color: 'black',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                        fontFamily: 'system-ui, sans-serif',
                        fontSize: '12px',
                        marginBottom: '4px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                        pointerEvents: 'none' // Click passes through to container
                    });
                    el.appendChild(label);

                    // 2. Numbered Dot
                    const dot = document.createElement('div');
                    dot.textContent = d.order.toString();
                    Object.assign(dot.style, {
                        width: '24px',
                        height: '24px',
                        background: d.color, // Dynamic color (Yellow/Orange/Red)
                        color: 'black',  // Black text on color
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                        border: '2px solid white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    });
                    el.appendChild(dot);

                    // 3. Interaction
                    el.onclick = () => {
                        if (navigator.vibrate) navigator.vibrate(10);
                        globeEl.current.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.5 }, 1000);
                    };

                    return el;
                }}

                // Arcs (Paths)
                arcsData={missionArcs}
                arcStartLat={d => d.startLat}
                arcStartLng={d => d.startLng}
                arcEndLat={d => d.endLat}
                arcEndLng={d => d.endLng}
                arcColor={d => d.color}
                arcDashLength={0.4}
                arcDashGap={0.2}
                arcDashAnimateTime={2000} // Animated dash
                arcStroke={0.5}

            />

            {/* Footer Legend */}
            <div className="absolute bottom-10 left-0 w-full flex justify-center pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md rounded-full px-6 py-2 flex items-center gap-4 border border-white/10">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-tactical-accent"></span>
                        <span className="text-[10px] text-white font-bold uppercase tracking-widest">Waypoint</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                        <span className="text-[10px] text-white font-bold uppercase tracking-widest">Transport</span>
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono pl-4 border-l border-white/20">
                        TRIP HIGHLIGHTS
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MissionGlobe;
