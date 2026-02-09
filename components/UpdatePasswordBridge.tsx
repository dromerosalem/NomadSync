import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const UpdatePasswordBridge: React.FC = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSession, setHasSession] = useState(false);

    // Check for recovery session on mount
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setHasSession(true);
            }
        };
        checkSession();

        // Listen for PASSWORD_RECOVERY event from the URL hash
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' && session) {
                setHasSession(true);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleUpdatePassword = async () => {
        setError(null);

        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) throw updateError;

            // Immediately sign out of the browser session per PRD requirements
            await supabase.auth.signOut();
            setIsSuccess(true);
        } catch (err: any) {
            console.error('Password update error:', err);
            setError(err.message || 'Failed to update password. Try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // === SUCCESS CARD (Post-Update "Dead End") ===
    if (isSuccess) {
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
                        Password Updated
                    </h1>

                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-6 leading-relaxed">
                        Your new password is ready to use.
                    </p>

                    <div className="w-full bg-white/5 border border-green-500/20 rounded-xl p-6 mb-8 text-center">
                        <p className="text-white text-base font-bold mb-2">
                            You can close this tab now.
                        </p>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Open the <span className="text-green-400 font-bold">NomadSync</span> app from your Home Screen and log in with your new password.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 justify-center text-gray-500 text-xs font-bold uppercase tracking-widest">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        Secure handoff complete
                    </div>
                </div>
            </div>
        );
    }

    // === NO SESSION STATE ===
    if (!hasSession) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-tactical-bg p-6 text-center animate-fade-in relative overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[100%] bg-[radial-gradient(ellipse_at_center,_#f59e0b_0%,_transparent_70%)] opacity-5 blur-3xl"></div>
                </div>

                <div className="z-10 max-w-md w-full">
                    <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-amber-500/50 animate-pulse">
                        <AlertTriangle className="w-10 h-10 text-amber-500" />
                    </div>

                    <h1 className="font-display text-3xl font-bold text-tactical-accent uppercase tracking-tighter mb-4">
                        Verifying Link...
                    </h1>

                    <p className="text-gray-400 text-sm mb-8">
                        If you arrived from a password reset email, please wait a moment.<br />
                        If nothing happens, the link may have expired.
                    </p>

                    <a
                        href={window.location.origin}
                        className="text-tactical-accent font-bold text-xs uppercase tracking-widest hover:text-white transition-colors"
                    >
                        Return to NomadSync →
                    </a>
                </div>
            </div>
        );
    }

    // === PASSWORD UPDATE FORM ===
    return (
        <div className="flex flex-col flex-1 w-full min-h-[100dvh] bg-tactical-bg relative animate-fade-in overflow-y-auto">
            {/* Background */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')]"></div>

            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[60%] bg-[radial-gradient(ellipse_at_center,_#f59e0b_0%,_transparent_60%)] opacity-5 blur-3xl"></div>
            </div>

            {/* Header */}
            <header className="px-6 py-8 z-10 w-full max-w-md mx-auto">
                <div className="flex items-center gap-2 text-[10px] font-bold text-tactical-accent uppercase tracking-widest mb-6">
                    <Lock className="w-4 h-4" />
                    Secure Password Update
                </div>
                <h1 className="font-display text-4xl font-bold text-tactical-accent uppercase leading-none mb-2">
                    New<br />Password
                </h1>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider max-w-xs leading-relaxed">
                    Enter your new password below to complete the reset.
                </p>
            </header>

            {/* Form */}
            <div className="flex-1 px-6 z-10 w-full max-w-md mx-auto">
                <div className="space-y-6 animate-reveal">
                    <div className="group">
                        <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-white transition-colors">
                            <div className="w-1 h-1 bg-tactical-accent rounded-full opacity-0 group-focus-within:opacity-100"></div>
                            New Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                                placeholder="••••••••••••"
                                autoFocus
                                className="w-full bg-transparent border border-gray-700 focus:border-tactical-accent p-4 pr-12 text-white font-bold tracking-wider outline-none transition-colors placeholder-gray-800"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="group">
                        <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-white transition-colors">
                            <div className="w-1 h-1 bg-tactical-accent rounded-full opacity-0 group-focus-within:opacity-100"></div>
                            Confirm Password
                        </label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdatePassword()}
                            placeholder="••••••••••••"
                            className="w-full bg-transparent border border-gray-700 focus:border-tactical-accent p-4 text-white font-bold tracking-wider outline-none transition-colors placeholder-gray-800"
                        />
                    </div>

                    {/* Password Strength Indicators */}
                    <div className="flex gap-2">
                        {[6, 8, 12].map((threshold, i) => (
                            <div
                                key={i}
                                className={`flex-1 h-1 rounded-full transition-colors ${password.length >= threshold
                                    ? i === 2 ? 'bg-green-500' : i === 1 ? 'bg-tactical-accent' : 'bg-amber-500'
                                    : 'bg-gray-800'
                                    }`}
                            />
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                        {password.length < 6 ? 'Minimum 6 characters' : password.length < 8 ? 'Good' : password.length < 12 ? 'Strong' : 'Very Strong'}
                    </p>

                    {error && (
                        <div className="bg-red-900/20 border border-red-900/50 px-4 py-3 rounded animate-fade-in">
                            <p className="text-red-400 text-xs font-mono">{error}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom CTA */}
            <div className="p-6 sticky bottom-0 bg-tactical-bg border-t border-tactical-muted/10 z-20 w-full max-w-md mx-auto animate-reveal">
                <button
                    onClick={handleUpdatePassword}
                    disabled={isLoading || !password || !confirmPassword}
                    className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-xl py-5 rounded-none flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,215,0,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <span className="animate-pulse">UPDATING...</span>
                    ) : (
                        <>
                            UPDATE PASSWORD
                            <Lock className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default UpdatePasswordBridge;
