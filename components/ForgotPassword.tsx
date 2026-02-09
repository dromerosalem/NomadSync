import React, { useState } from 'react';
import { Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface ForgotPasswordProps {
    onBack: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack }) => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleReset = async () => {
        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(
                email.trim().toLowerCase(),
                {
                    redirectTo: `${window.location.origin}/update-password`,
                }
            );

            if (resetError) throw resetError;
            setIsSent(true);
        } catch (err: any) {
            console.error('Password reset error:', err);
            setError(err.message || 'Failed to send reset link. Try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col flex-1 w-full min-h-[100dvh] bg-tactical-bg relative animate-fade-in overflow-y-auto">
            {/* Background */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')]"></div>

            {/* Atmospheric Glow */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[60%] bg-[radial-gradient(ellipse_at_center,_#f59e0b_0%,_transparent_60%)] opacity-5 blur-3xl"></div>
            </div>

            {/* Header */}
            <header className="px-6 py-8 z-10 w-full max-w-md mx-auto">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-[10px] font-bold text-tactical-accent uppercase tracking-widest hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                </button>
                <h1 className="font-display text-4xl font-bold text-tactical-accent uppercase leading-none mb-2">
                    Reset<br />Password
                </h1>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider max-w-xs leading-relaxed">
                    {isSent
                        ? 'Recovery link dispatched. Check your inbox.'
                        : 'Enter your email to receive a secure reset link.'}
                </p>
            </header>

            {/* Content */}
            <div className="flex-1 px-6 z-10 w-full max-w-md mx-auto flex flex-col justify-center">
                {isSent ? (
                    /* Success State */
                    <div className="text-center animate-fade-in">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/50 animate-pulse">
                            <CheckCircle className="w-10 h-10 text-green-500" />
                        </div>

                        <h2 className="font-display text-2xl font-bold text-white uppercase tracking-wider mb-3">
                            Link Sent
                        </h2>
                        <p className="text-gray-400 text-sm mb-2">
                            A password reset link has been sent to:
                        </p>
                        <p className="text-white font-bold text-sm mb-8 font-mono">
                            {email}
                        </p>

                        <button
                            onClick={() => window.location.href = 'mailto:'}
                            className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-lg py-4 rounded-none flex items-center justify-center gap-3 mb-4 transition-all shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                        >
                            <Mail className="w-5 h-5" />
                            OPEN MAIL APP
                        </button>

                        <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-4">
                            Didn't receive it? Check spam or try again.
                        </p>

                        <button
                            onClick={() => { setIsSent(false); setError(null); }}
                            className="text-tactical-accent text-xs font-bold uppercase tracking-widest mt-3 hover:text-white transition-colors"
                        >
                            Resend Link
                        </button>
                    </div>
                ) : (
                    /* Email Entry Form */
                    <div className="space-y-6 animate-reveal">
                        <div className="group">
                            <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-white transition-colors">
                                <div className="w-1 h-1 bg-tactical-accent rounded-full opacity-0 group-focus-within:opacity-100"></div>
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                                onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                                placeholder="COORDINATES@NOMAD.COM"
                                autoFocus
                                className="w-full bg-transparent border border-gray-700 focus:border-tactical-accent p-4 text-white font-bold uppercase tracking-wider outline-none transition-colors placeholder-gray-800"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-900/20 border border-red-900/50 px-4 py-3 rounded animate-fade-in">
                                <p className="text-red-400 text-xs font-mono">{error}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom CTA (only when form is visible) */}
            {!isSent && (
                <div className="p-6 sticky bottom-0 bg-tactical-bg border-t border-tactical-muted/10 z-20 w-full max-w-md mx-auto animate-reveal">
                    <button
                        onClick={handleReset}
                        disabled={isLoading || !email.trim()}
                        className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-xl py-5 rounded-none flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,215,0,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="animate-pulse">SENDING...</span>
                        ) : (
                            <>
                                SEND RESET LINK
                                <Send className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Footer */}
            <div className="mt-auto pb-12 px-6 z-10 w-full max-w-md mx-auto">
                <div className="flex justify-center gap-6 mt-6 opacity-30">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Secure Recovery</span>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
