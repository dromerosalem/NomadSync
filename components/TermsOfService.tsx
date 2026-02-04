import React from 'react';
import { ChevronLeftIcon } from './Icons';

interface TermsOfServiceProps {
    onBack: () => void;
}

const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
    return (
        <div className="flex flex-col h-full bg-tactical-bg animate-fade-in">
            <header className="px-6 py-8 border-b border-tactical-muted/10 sticky top-0 bg-tactical-bg z-30">
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
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">3. Operational Scope & Usage Constraints</h2>
                    <p className="mb-4">
                        NomadSync is a dedicated tactical travel coordination tool. It is strictly intended for travel-related logistics, expense tracking, and mission planning.
                    </p>
                    <p>
                        Users are prohibited from uploading non-travel related documents (e.g., books, long-form literature, or unrelated media) or any malicious content designed to overload our systems. System abuse—including "payload flooding" or server stress-testing—will result in immediate termination of access.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">4. Intelligence Integrity & AI Protocol</h2>
                    <p className="mb-4">
                        NomadSync utilizes advanced AI for data extraction. You acknowledge that AI models are probabilistic and may occasionally produce hallucinations or inaccuracies.
                        <strong> The ultimate responsibility for verification lies with you, the Operative.</strong> Operational success depends on your final manual review of all synchronized intel.
                    </p>
                    <div className="bg-white/5 border border-tactical-accent/20 rounded-xl p-4 mt-4">
                        <h3 className="text-[10px] font-bold text-tactical-accent uppercase tracking-widest mb-2 flex items-center gap-2">
                            System Trust: 3-Tier Security Protocol
                        </h3>
                        <ul className="text-[11px] space-y-2 list-none font-mono">
                            <li className="flex gap-2">
                                <span className="text-tactical-accent">01.</span> Encrypted PII redaction during analysis.
                            </li>
                            <li className="flex gap-2">
                                <span className="text-tactical-accent">02.</span> Multi-pass AI cross-verification.
                            </li>
                            <li className="flex gap-2">
                                <span className="text-tactical-accent">03.</span> Final Human-in-the-Loop (HITL) authorization requirement.
                            </li>
                        </ul>
                    </div>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">5. Service Deployment</h2>
                    <p>
                        NomadSync provides tactical coordination tools "as is". While we strive for 100% uptime, field conditions (server errors, network outages) may affect availability.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">6. Sync Protocol & Connection Waiver</h2>
                    <p>
                        NomadSync supports offline missions. However, the integrity of your data depends on successful online synchronization. HQ is not liable for data loss occurring due to hardware failure, cache clearance, or prolonged offline periods without established connectivity.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">7. Financial Coordination Disclaimer</h2>
                    <p>
                        Expense splits, currency conversions, and debt settlements calculated in-app are for tactical coordination and estimation purposes. NomadSync is not a financial institution. Operatives must verify final figures before executing actual currency transfers, which occur outside of this system.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">8. Usage License</h2>
                    <p>
                        By uploading receipts or mission data, you grant HQ a limited, non-exclusive license to process, analyze, and store such data solely for the purpose of providing services to you and your mission crew.
                    </p>
                </section>

                <section>
                    <h2 className="text-tactical-accent font-display font-bold uppercase tracking-widest text-lg mb-3">9. HQ Authority</h2>
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
