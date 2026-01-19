import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet + React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
    locationName: string;
    className?: string;
}

// Helper to update map view when center changes
const RecenterMap: React.FC<{ center: [number, number] }> = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, 13);
    }, [center, map]);
    return null;
};

const MapComponent: React.FC<MapComponentProps> = ({ locationName, className = "h-64 w-full rounded-xl overflow-hidden border border-tactical-muted/30" }) => {
    const [coords, setCoords] = useState<[number, number] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const geocode = async () => {
            if (!locationName) return;
            setLoading(true);
            try {
                // Using Nominatim for free geocoding
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`);
                const data = await response.json();
                if (data && data.length > 0) {
                    setCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
                }
            } catch (err) {
                console.error('Geocoding failed:', err);
            } finally {
                setLoading(false);
            }
        };

        geocode();
    }, [locationName]);

    if (!locationName) return null;

    return (
        <div className={className}>
            {loading ? (
                <div className="w-full h-full bg-tactical-card flex items-center justify-center animate-pulse">
                    <div className="text-[10px] font-bold text-tactical-accent uppercase tracking-widest">
                        Initializing Sat-Link...
                    </div>
                </div>
            ) : coords ? (
                <MapContainer
                    center={coords}
                    zoom={13}
                    style={{ height: '100%', width: '100%', filter: 'grayscale(0.5) contrast(1.2)' }}
                    zoomControl={false}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    <Marker position={coords}>
                        <Popup>
                            <span className="font-bold text-black">{locationName}</span>
                        </Popup>
                    </Marker>
                    <RecenterMap center={coords} />
                </MapContainer>
            ) : (
                <div className="w-full h-full bg-tactical-card flex flex-col items-center justify-center p-6 text-center">
                    <div className="text-red-500 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
                    </div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Coordinates Unresolved
                    </div>
                    <div className="text-[8px] text-gray-600 mt-1 uppercase">
                        Manual Extraction Required
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapComponent;
