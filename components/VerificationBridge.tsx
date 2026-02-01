import React from 'react';

const VerificationBridge: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-tactical-bg p-6 text-center animate-fade-in relative overflow-hidden">
            {/* Background Atmosphere */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[100%] bg-[radial-gradient(ellipse_at_center,_#4ade80_0%,_transparent_70%)] opacity-10 blur-3xl"></div>
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSg3NCwgMjIyLCAxMjgsIDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPgo8L3N2Zz4=')] opacity-20"></div>
            </div>

            <div className="z-10 max-w-md w-full">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/50 box-glow animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                <h1 className="font-display text-4xl font-bold text-green-500 uppercase tracking-tighter mb-4 drop-shadow-lg">
                    Access Granted
                </h1>

                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-12 leading-relaxed">
                    Your identity has been verified.<br />Secure uplink established.
                </p>

                <a
                    href="/"
                    className="w-full bg-green-500 hover:bg-green-400 text-black font-display font-black text-lg py-5 rounded-none flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(74,222,128,0.3)] transition-all uppercase tracking-widest"
                >
                    Return to NomadSync
                </a>

                <div className="mt-8 text-[10px] text-gray-600 font-mono uppercase">
                    Session ID: {Math.random().toString(36).substring(7).toUpperCase()}
                </div>
            </div>
        </div>
    );
};

export default VerificationBridge;
