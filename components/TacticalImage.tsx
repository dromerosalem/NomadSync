import React, { useState, useEffect } from 'react';

interface TacticalImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    fallbackColor?: string;
    grainOpacity?: number;
}

const TacticalImage: React.FC<TacticalImageProps> = ({
    src,
    alt,
    className = '',
    fallbackColor = '#2A2A2A', // Dark tactical grey
    grainOpacity = 0.05,
    ...props
}) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        // Reset state when src changes
        setLoaded(false);
        setError(false);

        if (!src) return;

        const img = new Image();
        img.src = src;
        img.onload = () => setLoaded(true);
        img.onerror = () => setError(true);
    }, [src]);

    return (
        <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: fallbackColor }}>
            {/* 1. Placeholder / Blur Effect */}
            <div
                className={`absolute inset-0 bg-tactical-card transition-opacity duration-700 ease-out ${loaded ? 'opacity-0' : 'opacity-100'}`}
                style={{ backgroundColor: fallbackColor }}
            />

            {/* 2. Main Image */}
            {src && !error && (
                <img
                    src={src}
                    alt={alt}
                    className={`w-full h-full object-cover transition-opacity duration-700 ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
                    {...props}
                />
            )}

            {/* 3. Film Grain Overlay */}
            <div
                className="absolute inset-0 pointer-events-none z-10 mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='${grainOpacity}'/%3E%3C/svg%3E")`,
                    opacity: 1 // Controlling opacity via SVG opacity param above mostly, but this ensures layer visibility
                }}
            />

            {/* 4. Vignette (Optional, adds to 'tactical' feel) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-10" />
        </div>
    );
};

export default TacticalImage;
