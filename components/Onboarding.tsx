import React, { useState, useEffect } from 'react';
import {
    Bell,
    ShieldCheck,
    Smartphone,
    Share,
    Receipt,
    ArrowRight,
    Search,
    RefreshCw,
    TrendingUp,
    Zap
} from 'lucide-react';
import { NotificationManager } from '../services/NotificationManager';

interface OnboardingProps {
    onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [isStandalone, setIsStandalone] = useState(false);
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        // Detect if running as PWA
        const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        setIsStandalone(!!standalone);
    }, []);

    const handleEnableNotifications = async () => {
        if (notifPermission === 'granted') {
            setStep(2);
            return;
        }
        const permission = await NotificationManager.requestPermission();
        setNotifPermission(permission);
        if (permission === 'granted') {
            // Give a small delay to show success before moving
            setTimeout(() => setStep(2), 600);
        }
    };

    const renderNotificationScreen = () => (
        <div className="flex flex-col h-full bg-tactical-bg p-6 animate-fade-in">
            {/* Header */}
            <div className="mt-8 mb-12 text-center">
                <div className="w-16 h-16 bg-tactical-accent/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-tactical-accent/30 box-glow">
                    <Bell className="w-8 h-8 text-tactical-accent" />
                </div>
                <h1 className="text-2xl font-display font-bold uppercase tracking-wider mb-2">Tactical Alerts</h1>
                <p className="text-tactical-muted text-sm px-4">
                    Get instant alerts when your team adds expenses, updates plans, or settles debts.
                </p>
            </div>

            {/* Ghost Notification Card */}
            <div className="relative mb-12">
                <div className="absolute -inset-4 bg-tactical-accent/5 blur-2xl rounded-full opacity-50"></div>
                <div className="relative backdrop-blur-md bg-white/5 border border-tactical-accent/30 rounded-2xl p-4 shadow-2xl overflow-hidden">
                    <div className="flex items-center gap-2 mb-2 opacity-60">
                        <div className="w-5 h-5 bg-tactical-accent rounded flex items-center justify-center">
                            <div className="w-2 h-2 bg-black rounded-full" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">NomadSync • Just now</span>
                    </div>
                    <div className="text-sm">
                        <span className="text-tactical-accent font-bold">✈️ Leo</span> added an expense: <span className="text-tactical-accent font-bold">$42.50</span> at Gigi's Pizza
                    </div>
                    <div className="flex gap-2 mt-3">
                        <div className="px-3 py-1.5 bg-tactical-accent/10 border border-tactical-accent/20 rounded-lg text-[10px] font-bold uppercase text-tactical-accent">View Trip</div>
                        <div className="px-3 py-1.5 bg-tactical-accent/10 border border-tactical-accent/20 rounded-lg text-[10px] font-bold uppercase text-tactical-accent">Settle Up</div>
                    </div>
                </div>
            </div>

            {/* Scannable Intel Points */}
            <div className="space-y-6 mb-auto">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <Receipt className="w-5 h-5 text-tactical-accent" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-tight text-tactical-accent mb-0.5">Expense Tracking</h3>
                        <p className="text-[11px] text-tactical-muted">Know exactly when someone scans a receipt in real-time.</p>
                    </div>
                </div>
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-5 h-5 text-tactical-accent" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-tight text-tactical-accent mb-0.5">Trip Changes</h3>
                        <p className="text-[11px] text-tactical-muted">Instant updates if the mission itinerary moves or updates.</p>
                    </div>
                </div>
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-5 h-5 text-tactical-accent" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-tight text-tactical-accent mb-0.5">Debt Alerts</h3>
                        <p className="text-[11px] text-tactical-muted">Get notified the second you've been paid back by your crew.</p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-8 space-y-4">
                <button
                    onClick={handleEnableNotifications}
                    className={`w-full py-4 font-display font-black uppercase tracking-widest text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${notifPermission === 'granted'
                        ? 'bg-tactical-accent/20 text-tactical-accent border border-tactical-accent/30'
                        : 'bg-tactical-accent text-black hover:bg-tactical-accent/90 active:scale-95'
                        }`}
                >
                    {notifPermission === 'granted' ? 'Alerts Enabled' : 'Enable Notifications'}
                </button>

                <button
                    onClick={() => setStep(2)}
                    className="w-full py-3 text-xs font-bold uppercase tracking-[0.2em] text-tactical-muted hover:text-white transition-colors border border-white/5 rounded-xl bg-white/5"
                >
                    Skip for now
                </button>
            </div>
        </div>
    );

    const renderAccuracyScreen = () => (
        <div className="flex flex-col h-full bg-tactical-bg p-6 animate-fade-in">
            <style>{`
                @keyframes accuracy-pulse {
                    0% { transform: scale(1); opacity: 0.5; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                .sonar-pulse {
                    animation: accuracy-pulse 2s cubic-bezier(0.21, 0.53, 0.56, 0.8) infinite;
                }
            `}</style>

            {/* Header */}
            <div className="mt-8 mb-12 text-center">
                <div className="relative w-16 h-16 mx-auto mb-6">
                    <div className="absolute inset-0 bg-[#c5a059]/20 rounded-full sonar-pulse"></div>
                    <div className="absolute inset-0 bg-[#c5a059]/10 rounded-full sonar-pulse" style={{ animationDelay: '1s' }}></div>
                    <div className="relative w-full h-full bg-[#c5a059]/10 rounded-full flex items-center justify-center border border-[#c5a059]/40">
                        <ShieldCheck className="w-8 h-8 text-[#c5a059]" />
                    </div>
                </div>
                <h1 className="text-2xl font-display font-bold uppercase tracking-wider mb-2 text-[#c5a059]">Accuracy Check</h1>
                <p className="text-white/80 text-sm px-4 font-medium leading-relaxed">
                    NomadSync AI is powerful, but not infallible. Please double-check all synchronized intel.
                </p>
            </div>

            {/* Point of Impact Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-12 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-20">
                    <RefreshCw className="w-4 h-4 animate-spin-slow" />
                </div>

                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded bg-[#c5a059]/20 flex items-center justify-center">
                        <Receipt className="w-4 h-4 text-[#c5a059]" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#c5a059]">Extracted Intel</div>
                        <div className="text-xs font-mono text-white/90">GIGI'S PIZZA • SHIBUYA</div>
                    </div>
                </div>

                <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between items-center bg-[#c5a059]/5 p-2 rounded border border-[#c5a059]/20">
                        <span className="text-white/60">Amount:</span>
                        <span className="text-[#c5a059] font-bold">$42.50</span>
                        <div className="w-4 h-4 border border-[#c5a059] rounded flex items-center justify-center">
                            <div className="w-2 h-2 bg-[#c5a059] rounded-sm"></div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center bg-[#c5a059]/5 p-2 rounded border border-[#c5a059]/20">
                        <span className="text-white/60">Date:</span>
                        <span className="text-[#c5a059] font-bold">2026-02-01</span>
                        <div className="w-4 h-4 border border-[#c5a059] rounded flex items-center justify-center">
                            <div className="w-2 h-2 bg-[#c5a059] rounded-sm"></div>
                        </div>
                    </div>
                </div>

                <div className="mt-4 text-[10px] text-center text-[#c5a059]/80 italic font-mono uppercase tracking-tighter">
                    System scanning... Final verification required
                </div>
            </div>

            {/* Scannable Intel Points */}
            <div className="space-y-4 mb-auto text-center px-4">
                <p className="text-xs text-white/70 leading-relaxed font-medium">
                    Efficiency is our primary directive. Accuracy is your ultimate responsibility.
                </p>
                <div className="h-px bg-gradient-to-r from-transparent via-[#c5a059]/20 to-transparent w-full"></div>
                <p className="text-[10px] text-[#c5a059] font-mono uppercase tracking-[0.1em]">
                    Operational integrity depends on user review.
                </p>
            </div>

            {/* Actions */}
            <div className="mt-8">
                <button
                    onClick={onComplete}
                    className="w-full py-4 bg-[#c5a059] text-black font-display font-black uppercase tracking-[0.2em] text-sm rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 transform active:scale-95 shadow-[0_0_20px_rgba(197,160,89,0.3)]"
                >
                    I WILL VERIFY
                </button>
                <div className="mt-4 text-center">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-[#c5a059]/50">Protocol Acknowledged</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[1000] bg-tactical-bg overflow-y-auto">
            <div className="h-full w-full max-w-sm mx-auto shadow-2xl overflow-hidden relative border-x border-white/5">
                {step === 1 ? renderNotificationScreen() : renderAccuracyScreen()}
            </div>
        </div>
    );
};

export default Onboarding;
