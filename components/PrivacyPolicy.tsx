import React from 'react';
import { ChevronLeftIcon } from './Icons';

interface PrivacyPolicyProps {
    onBack: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
    return (
        <div className="flex flex-col h-full bg-tactical-bg animate-fade-in">
            <header className="px-6 py-8 border-b border-tactical-muted/10 sticky top-0 bg-tactical-bg z-10">
                <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-bold text-tactical-accent uppercase tracking-widest hover:text-white mb-4 transition-colors">
                    <ChevronLeftIcon className="w-5 h-5" /> Back to Base
                </button>
                <h1 className="font-display text-4xl font-bold text-white uppercase leading-tight">
                    Privacy Policy
                    <br />
                    <span className="text-tactical-accent text-sm tracking-[0.3em]">Protocol P-77</span>
                </h1>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 text-gray-300 font-sans leading-relaxed pb-24">
                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">1. Data Collection Objective</h2>
                    <p>
                        NomadSync identifies and processes data necessary for group travel and expense coordination. This includes your name, email address, profile image, and tactical trip data (locations, itineraries, and costs).
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">2. Authentication Protocols</h2>
                    <p>
                        We use Google OAuth and email-based authentication to secure your account. When using Google One Tap, we receive your basic profile info (email, name, picture) to establish your Operative ID.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">3. Shared Intelligence</h2>
                    <p>
                        NomadSync is a collaborative tool. Itinerary items and expenses are shared with the members of the specific "Mission" you join. Private items remain visible only to you unless explicitly shared.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">4. AI Intelligence Sovereignty</h2>
                    <p>
                        NomadSync utilizes Google's Gemini models for receipt analysis and itinerary coordination. Your tactical intel is processed for the sole purpose of extraction and execution. We do not use your personal receipts, itineraries, or mission data to train any underlying AI models.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">5. Tactical Pantry (Local Cache)</h2>
                    <p>
                        For offline deployments, NomadSync utilizes local device storage (localStorage and Service Workers) to cache your mission data. This "Tactical Pantry" ensures operational continuity without an active internet connection. This data resides exclusively on your device until it is purged by you or the system.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">6. Tactical Storage & Sub-processors</h2>
                    <p>
                        Your primary mission data is stored securely via Supabase (Database & Storage). We utilize specific sub-processors (Supabase, Google, and Vercel) to maintain high-availability infrastructure. We do not sell your intel to third-party entities.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">7. Termination</h2>
                    <p>
                        You can request account termination or data erasure at any time via HQ.
                    </p>
                </section>

                <div className="pt-12 border-t border-tactical-muted/10">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">
                        Last Updated: January 2026 // End of Document
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
