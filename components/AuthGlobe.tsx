import React, { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';

const AuthGlobe: React.FC = () => {
    const globeEl = useRef<any>();
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Globe Focus & Auto-rotation
    useEffect(() => {
        if (globeEl.current) {
            // Start with a nice angled view of Earth
            globeEl.current.pointOfView({
                lat: 25,
                lng: 0,
                altitude: 2.2
            }, 1000);

            // Enable smooth auto-rotation
            globeEl.current.controls().autoRotate = true;
            globeEl.current.controls().autoRotateSpeed = 0.6;
            globeEl.current.controls().enableZoom = false;
        }
    }, []);

    return (
        <div className="absolute inset-0 z-0 animate-fade-in opacity-40 mix-blend-screen pointer-events-none">
            <Globe
                ref={globeEl}
                width={dimensions.width}
                height={dimensions.height}
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                backgroundColor="rgba(0,0,0,0)" // Transparent background
                atmosphereColor="rgba(100,149,237,0.2)"
                atmosphereAltitude={0.15}
            />
        </div>
    );
};

export default AuthGlobe;
