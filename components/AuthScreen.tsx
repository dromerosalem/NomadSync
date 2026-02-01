
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleIcon, LightningIcon } from './Icons';
import { Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { persistenceService } from '../services/persistenceService';

// Lazy load the 3D Globe for performance
const AuthGlobe = React.lazy(() => import('./AuthGlobe'));

interface AuthScreenProps {
    onAuthSuccess: (user: { name: string; email: string }) => void;
    onViewPrivacy: () => void;
    onViewTerms: () => void;
}

type AuthMode = 'LANDING' | 'SIGNUP' | 'LOGIN';

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess, onViewPrivacy, onViewTerms }) => {
    const [mode, setMode] = useState<AuthMode>('LANDING');
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [key, setKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [waitingForVerification, setWaitingForVerification] = useState(false);

    const handleGoogleCredentialResponse = useCallback(async (response: any) => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: response.credential,
            });

            if (error) throw error;
            if (data.user) {
                onAuthSuccess({
                    name: data.user.user_metadata.full_name || 'Ghost Operative',
                    email: data.user.email!
                });
            }
        } catch (err: any) {
            console.error('Google Auth Error:', err);
            alert(err.message || 'Verification Failed');
        } finally {
            setIsLoading(false);
        }
    }, [onAuthSuccess]);

    // Google One Tap Implementation
    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) {
            console.warn('Google Client ID missing from HQ (env). One Tap offline.');
            return;
        }

        const google = (window as any).google;
        if (google && google.accounts && google.accounts.id) {
            google.accounts.id.initialize({
                client_id: clientId,
                callback: handleGoogleCredentialResponse,
                auto_select: false,
                cancel_on_tap_outside: true,
            });

            // Fire One Tap prompt on Landing
            if (mode === 'LANDING') {
                google.accounts.id.prompt();
            }
        }
    }, [mode, handleGoogleCredentialResponse]);

    // Polling for Verification
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (waitingForVerification) {
            interval = setInterval(async () => {
                const { data } = await supabase.auth.signInWithPassword({
                    email,
                    password: key
                });
                if (data.session) {
                    clearInterval(interval);
                    onAuthSuccess({
                        name: data.user.user_metadata.full_name || name,
                        email: data.user.email!
                    });
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [waitingForVerification, email, key, onAuthSuccess, name]);

    const handleDeploy = async () => {
        setIsLoading(true);
        try {
            const normalizedEmail = email.trim().toLowerCase();
            let result;
            if (mode === 'SIGNUP') {
                result = await supabase.auth.signUp({
                    email: normalizedEmail,
                    password: key,
                    options: {
                        data: {
                            full_name: name,
                        },
                        emailRedirectTo: `${window.location.origin}/verified`
                    }
                });
            } else {
                result = await supabase.auth.signInWithPassword({
                    email: normalizedEmail,
                    password: key,
                });
            }

            if (result.error) throw result.error;

            if (result.data.user) {
                if (mode === 'SIGNUP' && !result.data.session) {
                    setWaitingForVerification(true);
                    return;
                }

                // Request persistent storage immediately after successful login (user interaction)
                persistenceService.requestPersistence();

                onAuthSuccess({
                    name: result.data.user.user_metadata.full_name || name || normalizedEmail.split('@')[0],
                    email: normalizedEmail
                });
            }
        } catch (err: any) {
            console.error('Auth Error:', err);
            alert(err.message || "Invalid Credentials Detected");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleAuth = () => {
        supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
    };

    if (mode === 'LANDING') {
        return (
            <div className="flex flex-col h-full bg-tactical-bg relative overflow-hidden animate-fade-in">
                {/* Background Atmospheric Gradient (Desert Sunset Vibe) */}
                <div className="absolute inset-0 z-0 bg-[#020617] overflow-hidden">
                    {/* The "Glow" - Sunset Horizon */}
                    <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[150%] h-[60%] bg-[radial-gradient(ellipse_at_center,_#b45309_0%,_#7c2d12_40%,_transparent_75%)] opacity-60 blur-3xl"></div>

                    {/* Linear Gradient for base layering */}
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-transparent to-[#020617]"></div>

                    {/* SVG Noise Texture for Premium Feel */}
                    <div
                        className="absolute inset-0 opacity-[0.25] mix-blend-overlay pointer-events-none"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
                        }}
                    />

                    {/* 3D Globe Background Layer (Lazy Loaded) */}
                    <div className="absolute inset-0 z-0 pointer-events-none">
                        <React.Suspense fallback={<div className="w-full h-full bg-transparent" />}>
                            <AuthGlobe />
                        </React.Suspense>
                    </div>

                    {/* Giant Compass Watermark (High Visibility) */}
                    <div className="absolute -bottom-20 -left-20 transform rotate-12 opacity-30 mix-blend-overlay pointer-events-none text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                        </svg>
                    </div>

                    {/* Giant NomadSync Logo Watermark */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform opacity-[0.08] mix-blend-screen pointer-events-none text-tactical-accent">
                        <svg width="800" height="800" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Outer Tactical Circle */}
                            <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="1.5" />

                            {/* Broken Chain Ring */}
                            <circle cx="50" cy="50" r="36" stroke="currentColor" strokeWidth="4" strokeDasharray="8 4" />

                            {/* Compass Rose - Vertical */}
                            <path d="M50 2 L56 50 L50 98 L44 50 Z" fill="currentColor" />
                            {/* Compass Rose - Horizontal */}
                            <path d="M2 50 L50 44 L98 50 L50 56 Z" fill="currentColor" />

                            {/* Inner Details */}
                            <circle cx="50" cy="50" r="6" fill="currentColor" />
                            <circle cx="50" cy="50" r="2" fill="black" />

                            {/* Subtle 45-degree points */}
                            <path d="M25 25 L50 48 L75 75 L48 50 Z" fill="currentColor" opacity="0.4" />
                            <path d="M75 25 L52 50 L25 75 L50 52 Z" fill="currentColor" opacity="0.4" />
                        </svg>
                    </div>

                    {/* Grid Overlay */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] opacity-50"></div>

                    {/* Vignette */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30"></div>
                </div>

                <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center w-full max-w-md mx-auto">


                    <h1 className="font-display text-5xl md:text-6xl font-bold text-tactical-accent uppercase tracking-tighter mb-4 drop-shadow-lg">
                        NomadSync
                    </h1>

                    <div className="h-64 flex items-center justify-center">
                        {/* Character Silhouette placeholder or visual */}
                        <div className="w-1 h-32 bg-gradient-to-b from-transparent via-tactical-accent to-transparent opacity-50 blur-sm"></div>
                    </div>

                    <p className="font-display text-xl font-bold text-white uppercase tracking-widest leading-relaxed mb-8 max-w-xs">
                        Sync The Mission.<br />Eliminate The Friction.
                    </p>

                    <div className="flex gap-1 mb-12">
                        <div className="w-8 h-1 bg-tactical-accent rounded-full"></div>
                        <div className="w-2 h-1 bg-tactical-muted rounded-full"></div>
                        <div className="w-2 h-1 bg-tactical-muted rounded-full"></div>
                    </div>

                    <div className="w-full space-y-4 max-w-sm">
                        <button
                            onClick={() => { setMode('SIGNUP'); setShowEmailForm(false); }}
                            className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all"
                        >
                            START NEW MISSION <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                        </button>
                        <button
                            onClick={() => { setMode('LOGIN'); setShowEmailForm(false); }}
                            className="w-full bg-transparent hover:bg-white/5 border border-tactical-accent/50 text-tactical-accent font-display font-bold text-lg py-4 rounded-xl transition-all"
                        >
                            REJOIN CIRCLE
                        </button>
                    </div>

                    <div className="flex gap-4 mt-8 opacity-40">
                        <button onClick={onViewPrivacy} className="text-[9px] font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors">Privacy Policy</button>
                        <button onClick={onViewTerms} className="text-[9px] font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors">Terms of Service</button>
                    </div>
                </div>
            </div>
        );

    }

    if (waitingForVerification) {
        return (
            <div className="flex flex-col h-full bg-tactical-bg relative items-center justify-center text-center px-6 animate-fade-in">
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle,_#fbbf24_0%,_transparent_60%)] opacity-10 blur-3xl animate-pulse-slow"></div>
                </div>

                <div className="relative z-10 p-8 border border-tactical-accent/20 bg-black/40 backdrop-blur-sm rounded-2xl max-w-sm w-full shadow-[0_0_30px_rgba(251,191,36,0.1)]">
                    <div className="w-16 h-16 mx-auto mb-6 relative">
                        <div className="absolute inset-0 border-2 border-tactical-accent rounded-full animate-ping opacity-20"></div>
                        <div className="absolute inset-0 border-2 border-tactical-accent rounded-full animate-spin-slow border-t-transparent"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <ShieldCheck className="w-8 h-8 text-tactical-accent" />
                        </div>
                    </div>

                    <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-2">Awaiting Authorization</h2>
                    <p className="text-xs text-tactical-muted font-mono mb-8">
                        Encrypted link sent to <span className="text-white">{email}</span>.
                    </p>

                    <button
                        onClick={() => window.location.href = 'mailto:'}
                        className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 mb-4 transition-all shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                    >
                        OPEN MAIL APP <Mail className="w-5 h-5" />
                    </button>

                    <div className="flex items-center justify-center gap-2 text-[10px] text-tactical-muted uppercase font-bold tracking-widest animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Connecting to server...
                    </div>
                </div>
            </div>
        );
    }

    // SIGN UP / LOGIN FORM
    return (
        <div className="flex flex-col h-full bg-tactical-bg relative animate-fade-in">
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')]"></div>

            {/* 3D Globe Background Layer (Lazy Loaded) - Reused for Forms */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <React.Suspense fallback={<div className="w-full h-full bg-transparent" />}>
                    <AuthGlobe />
                </React.Suspense>
            </div>

            <header className="px-6 py-8 z-10 w-full max-w-md mx-auto">
                <button
                    onClick={() => { setMode('LANDING'); setShowEmailForm(false); }}
                    className="flex items-center gap-2 text-[10px] font-bold text-tactical-accent uppercase tracking-widest hover:text-white mb-6"
                >
                    <div className="h-px w-8 bg-tactical-accent"></div>
                    Mission Protocol 01
                </button>
                <h1 className="font-display text-5xl font-bold text-tactical-accent uppercase leading-none mb-2">
                    {mode === 'SIGNUP' ? 'Recruit' : 'Operative'}
                    <br />
                    {mode === 'SIGNUP' ? 'Enrollment' : 'Access'}
                </h1>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider max-w-xs leading-relaxed">
                    Securing your digital footprint across the desert. Verification required.
                </p>
            </header>

            <div className="flex-1 px-6 z-10 overflow-y-auto w-full max-w-md mx-auto">

                {/* Google Button */}
                <button
                    onClick={handleGoogleAuth}
                    className="w-full bg-transparent hover:bg-white/5 border border-white/20 hover:border-white/50 py-4 rounded-none flex items-center justify-center gap-3 transition-colors mb-8 group"
                >
                    <GoogleIcon className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
                    <span className="font-bold text-white text-sm uppercase tracking-widest">Continue with Google</span>
                </button>

                {!showEmailForm ? (
                    <div className="text-center mt-12 mb-8">
                        <button
                            onClick={() => setShowEmailForm(true)}
                            className="text-tactical-accent font-bold uppercase tracking-[0.2em] text-[10px] border-b border-tactical-accent/30 pb-1 hover:text-white hover:border-white transition-all"
                        >
                            {mode === 'SIGNUP' ? 'Enroll With Email' : 'Dispatch Via Email'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-reveal">
                        {mode === 'SIGNUP' && (
                            <div className="group">
                                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-white transition-colors">
                                    <div className="w-1 h-1 bg-tactical-accent rounded-full opacity-0 group-focus-within:opacity-100"></div>
                                    Nomad Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="GHOST_OPERATIVE"
                                    className="w-full bg-transparent border border-gray-700 focus:border-tactical-accent p-4 text-white font-bold uppercase tracking-wider outline-none transition-colors placeholder-gray-800"
                                />
                            </div>
                        )}

                        <div className="group">
                            <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-white transition-colors">
                                <div className="w-1 h-1 bg-tactical-accent rounded-full opacity-0 group-focus-within:opacity-100"></div>
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="COORDINATES@NOMAD.COM"
                                className="w-full bg-transparent border border-gray-700 focus:border-tactical-accent p-4 text-white font-bold uppercase tracking-wider outline-none transition-colors placeholder-gray-800"
                            />
                        </div>

                        <div className="group">
                            <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-white transition-colors">
                                <div className="w-1 h-1 bg-tactical-accent rounded-full opacity-0 group-focus-within:opacity-100"></div>
                                Secret Key
                            </label>
                            <input
                                type="password"
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                placeholder="••••••••••••"
                                className="w-full bg-transparent border border-gray-700 focus:border-tactical-accent p-4 text-white font-bold uppercase tracking-wider outline-none transition-colors placeholder-gray-800"
                            />
                        </div>
                    </div>
                )}
            </div>

            {showEmailForm && (
                <div className="p-6 sticky bottom-0 bg-tactical-bg border-t border-tactical-muted/10 z-20 w-full max-w-md mx-auto animate-reveal">
                    <button
                        onClick={handleDeploy}
                        disabled={isLoading}
                        className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-xl py-5 rounded-none flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,215,0,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="animate-pulse">CONNECTING...</span>
                        ) : (
                            <>
                                {mode === 'SIGNUP' ? 'DEPLOY TO MISSION' : 'ACCESS TERMINAL'}
                                <LightningIcon className="w-5 h-5 fill-black" />
                            </>
                        )}
                    </button>
                </div>
            )}

            <div className="p-6 z-10 w-full max-w-md mx-auto">
                <div className="text-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">
                        {mode === 'SIGNUP' ? 'Veteran?' : 'New Recruit?'}
                    </span>
                    <button
                        onClick={() => { setMode(mode === 'SIGNUP' ? 'LOGIN' : 'SIGNUP'); setShowEmailForm(false); }}
                        className="text-white font-bold uppercase tracking-widest text-xs border-b border-tactical-accent pb-0.5 hover:text-tactical-accent transition-colors"
                    >
                        {mode === 'SIGNUP' ? 'REJOIN CIRCLE' : 'ENROLL NOW'}
                    </button>

                    <div className="flex justify-center gap-4 mt-8 opacity-40">
                        <button onClick={onViewPrivacy} className="text-[9px] font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors">Privacy Policy</button>
                        <button onClick={onViewTerms} className="text-[9px] font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors">Terms of Service</button>
                    </div>
                </div>


            </div>
        </div>
    );
};

export default AuthScreen;
