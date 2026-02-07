
import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore - The library doesn't have types yet
import '@khmyznikov/pwa-install';

const PWAInstall: React.FC = () => {
    const pwaInstallRef = useRef<any>(null);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        // 1. Check if already running in standalone mode (installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;

        if (isStandalone) {
            return;
        }

        // 2. Platform Check: Disable for Android (Use Native)
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid) {
            return;
        }

        // 3. Cool-down Check
        const lastDismissed = localStorage.getItem('nomad_pwa_dismissed');
        if (lastDismissed) {
            const dismissedDate = new Date(parseInt(lastDismissed, 10));
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - dismissedDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 7) {
                return;
            }
        }

        setShouldRender(true);
    }, []);

    useEffect(() => {
        if (!shouldRender || !pwaInstallRef.current) return;

        const handleUserChoice = (event: any) => {
            console.log("PWA Choice Result:", event.detail.message);
            // If user dismisses, set cool-down
            if (event.detail.message === 'dismissed') {
                localStorage.setItem('nomad_pwa_dismissed', Date.now().toString());
            }
        };

        const element = pwaInstallRef.current;
        element.addEventListener('pwa-user-choice-result-event', handleUserChoice);

        // Trigger the dialog to show automatically on iOS/other platforms
        // Use a small delay to ensure the element is fully registered
        const timer = setTimeout(() => {
            if (element && typeof element.showDialog === 'function') {
                element.showDialog(true); // force=true to show even if previously dismissed by library
            }
        }, 500);

        return () => {
            clearTimeout(timer);
            element.removeEventListener('pwa-user-choice-result-event', handleUserChoice);
        };
    }, [shouldRender]);

    if (!shouldRender) return null;

    return (
        // @ts-ignore
        <pwa-install
            ref={pwaInstallRef}
            manual-apple="true"
            manual-chrome="false"
            disable-chrome="true"
            icon="/logo.png"
            manifest-url="/manifest.json"
            name="NomadSync"
            description="Anchor your journey to your home screen for access even in the farthest reaches of the globe."
        ></pwa-install>
    );
};

export default PWAInstall;
