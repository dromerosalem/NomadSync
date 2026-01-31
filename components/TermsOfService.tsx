import React from 'react';
import { ChevronLeftIcon } from './Icons';

interface TermsOfServiceProps {
    onBack: () => void;
}

const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
    return (
        <div className="flex flex-col h-full bg-tactical-bg animate-fade-in">
            <header className="px-6 py-8 border-b border-tactical-muted/10 sticky top-0 bg-tactical-bg z-10">
                <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-bold text-tactical-accent uppercase tracking-widest hover:text-white mb-4 transition-colors">
                    <ChevronLeftIcon className="w-5 h-5" /> Back to Base
                </button>
                <h1 className="font-display text-4xl font-bold text-white uppercase leading-tight">
                    Terms of Service
                    <br />
                    <span className="text-tactical-accent text-sm tracking-[0.3em]">Code of Conduct</span>
                </h1>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 text-gray-300 font-sans leading-relaxed pb-24">
                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">1. Acceptance of Protocol</h2>
                    <p>
                        By deploying the NomadSync application, you agree to these Terms. If you do not agree to these protocols, do not access the system.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">2. Operative Responsibilities</h2>
                    <p>
                        You are responsible for the accuracy of the intel (data) you upload. Do not use NomadSync for illegal activities or unauthorized surveillance.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">3. Service Deployment</h2>
                    <p>
                        NomadSync provides tactical coordination tools "as is". While we strive for 100% uptime, field conditions (server errors, network outages) may affect availability.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">4. Financial Coordination</h2>
                    <p>
                        Expense splits and settlements calculated in-app are for coordination purposes. Actual currency transfers happen outside of NomadSync via your chosen financial channels.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">5. HQ Authority</h2>
                    <p>
                        We reserve the right to suspend operatives who violate these protocols or attempt to breach system security.
                    </p>
                </section>

                <div className="pt-12 border-t border-tactical-muted/10">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">
                        NomadSync Protocol v1.0 // Mission Start
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TermsOfService;
