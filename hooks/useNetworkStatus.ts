import { useState, useEffect } from 'react';

/**
 * Custom hook to detect network status (online/offline)
 * Uses the browser's Navigator.onLine API and listens to network events
 */
export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(
        typeof window !== 'undefined' ? window.navigator.onLine : true
    );

    useEffect(() => {
        // Handler for online event
        const handleOnline = () => {
            setIsOnline(true);
        };

        // Handler for offline event
        const handleOffline = () => {
            setIsOnline(false);
        };

        // Add event listeners
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Cleanup listeners on unmount
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};
