
import React, { useEffect, useState } from 'react';
import { Trip } from '../types';
import { tripService } from '../services/tripService';
import { ArrowRightIcon, ChevronLeftIcon } from './Icons';

interface JoinMissionProps {
    tripId: string;
    currentUser: any; // Using any for brevity in this specific isolated component
    onJoin: () => void;
    onCancel: () => void;
}

const JoinMission: React.FC<JoinMissionProps> = ({ tripId, currentUser, onJoin, onCancel }) => {
    const [trip, setTrip] = useState<Trip | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        // Simple delay to simulate decryption as data is fetched via RPC in real flow
        // For MVP we just show the prompt immediately
        const timer = setTimeout(() => {
            setLoading(false);
        }, 800);
        return () => clearTimeout(timer);
    }, [tripId]);

    const handleConfirmJoin = async () => {
        setLoading(true);
        try {
            await tripService.addMemberToTrip(tripId, currentUser.id, 'SCOUT');

            // Remote Handshake Logic
            const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

            if (isPWA) {
                // We are in the app, direct entry
                onJoin();
            } else {
                // We are in browser, show "Mission Accepted" bridge
                setSuccess(true);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to establish link. Access denied.");
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex flex-col h-full bg-tactical-bg animate-fade-in items-center justify-center p-6 text-center">
                <div className="w-24 h-24 bg-green-900/20 border-2 border-green-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>

                <h1 className="font-display text-2xl font-bold text-white uppercase mb-2">MISSION ACCEPTED</h1>
                <p className="text-gray-400 text-sm mb-8 max-w-xs mx-auto">
                    Decryption Complete. Welcome to the Squad.
                </p>

                <a
                    href="/?open=dashboard"
                    className="w-full max-w-xs bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                >
                    RETURN TO COMMAND CENTER
                </a>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-tactical-bg animate-fade-in items-center justify-center p-6 text-center">
            <div className="w-24 h-24 bg-tactical-card border-2 border-dashed border-tactical-accent rounded-full flex items-center justify-center mb-6 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
            </div>

            <h1 className="font-display text-2xl font-bold text-white uppercase mb-2">Incoming Mission Invite</h1>
            <p className="text-gray-400 text-sm mb-8 max-w-xs mx-auto">
                You have been summoned to join a NomadSync Squad. Confirm your acceptance to access encrypted mission details.
            </p>

            {error && (
                <div className="bg-red-900/20 border border-red-500/50 text-red-500 p-3 rounded mb-6 text-xs font-bold uppercase">
                    {error}
                </div>
            )}

            <div className="w-full max-w-xs space-y-3">
                <button
                    onClick={handleConfirmJoin}
                    disabled={loading}
                    className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                    {loading ? 'DECRYPTING MISSION DATA...' : 'ACCEPT MISSION'}
                </button>

                <button
                    onClick={onCancel}
                    className="w-full text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest py-3"
                >
                    Decline & Abort
                </button>
            </div>
        </div>
    );
};

export default JoinMission;
