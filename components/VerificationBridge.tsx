import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const VerificationBridge: React.FC = () => {
    const [ready, setReady] = useState(false);

    // Sign out the browser session immediately — the PWA handles the real login
    useEffect(() => {
        const cleanup = async () => {
            try {
                await supabase.auth.signOut();
            } catch (err) {
                console.error('Bridge signOut error:', err);
            }
            setReady(true);
        };
        cleanup();
    }, []);

    if (!ready) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-tactical-bg p-6 text-center">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-tactical-bg p-6 text-center animate-fade-in relative overflow-hidden">
            {/* Background Atmosphere */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[100%] bg-[radial-gradient(ellipse_at_center,_#4ade80_0%,_transparent_70%)] opacity-10 blur-3xl"></div>
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSg3NCwgMjIyLCAxMjgsIDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPgo8L3N2Zz4=')] opacity-20"></div>
            </div>

            <div className="z-10 max-w-md w-full">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/50 animate-pulse">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                </div>

                <h1 className="font-display text-4xl font-bold text-green-500 uppercase tracking-tighter mb-4 drop-shadow-lg">
                    Email Verified
                </h1>

                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-6 leading-relaxed">
                    Your account is now active and ready to go.
                </p>

                <div className="w-full bg-white/5 border border-green-500/20 rounded-xl p-6 mb-8 text-center">
                    <p className="text-white text-base font-bold mb-2">
                        You can close this tab now.
                    </p>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        Open the <span className="text-green-400 font-bold">NomadSync</span> app from your Home Screen to start your journey.
                    </p>
                </div>

                <div className="flex items-center gap-3 justify-center text-gray-500 text-xs font-bold uppercase tracking-widest">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Verification complete
                </div>
            </div>
        </div>
    );
};

export default VerificationBridge;
