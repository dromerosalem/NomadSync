import React from 'react';
import { Trip } from '../types';
import { getThemeForTrip } from '../utils/themeUtils';

interface AtmosphericGradientProps {
    trip: Trip;
    className?: string;
}

const AtmosphericGradient: React.FC<AtmosphericGradientProps> = ({ trip, className = '' }) => {
    const theme = getThemeForTrip(trip);
    const ThemeIcon = theme.icon;

    return (
        <div
            className={`relative overflow-hidden ${className}`}
            style={{ background: theme.gradient }}
        >
            {/* SVG Noise Texture for Premium Feel */}
            <div
                className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
                }}
            />

            {/* Giant Line Art Watermark */}
            <div
                className="absolute -bottom-20 -right-20 transform -rotate-12 opacity-30 mix-blend-overlay pointer-events-none"
                aria-hidden="true"
            >
                <ThemeIcon
                    size={420}
                    strokeWidth={2}
                    className="text-white"
                />
            </div>

            {/* Optional: Add a subtle inner shadow/vignette for depth */}
            <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.1)] pointer-events-none"></div>
        </div>
    );
};

export default AtmosphericGradient;
