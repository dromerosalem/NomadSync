import React, { useState } from 'react';
import { GoogleIcon, LightningIcon } from './Icons';

interface AuthScreenProps {
  onAuthSuccess: (user: { name: string; email: string }) => void;
}

type AuthMode = 'LANDING' | 'SIGNUP' | 'LOGIN';

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('LANDING');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [key, setKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDeploy = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      // Basic validation mock
      if (email.includes('@')) {
         const finalName = name || email.split('@')[0];
         onAuthSuccess({ name: finalName, email });
      } else {
         setIsLoading(false);
         alert("Invalid Credentials Detected");
      }
    }, 1500);
  };

  const handleGoogleAuth = () => {
      setIsLoading(true);
      setTimeout(() => {
          onAuthSuccess({ name: 'Ghost Operative', email: 'ghost@nomad.com' });
      }, 1500);
  };

  if (mode === 'LANDING') {
      return (
          <div className="flex flex-col h-full bg-tactical-bg relative overflow-hidden animate-fade-in">
              {/* Background Image */}
              <div className="absolute inset-0 z-0">
                  <img 
                    src="https://images.unsplash.com/photo-1542359649-31e03cd4d909?q=80&w=1974&auto=format&fit=crop" 
                    className="w-full h-full object-cover opacity-30 grayscale"
                    alt="Desert Recon"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-tactical-bg/40 via-tactical-bg/80 to-tactical-bg"></div>
                  {/* Grid Overlay */}
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] opacity-30"></div>
              </div>

              <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
                  <div className="mb-2 px-3 py-1 border border-tactical-accent/30 rounded bg-black/40 backdrop-blur-sm">
                      <span className="text-[10px] font-bold text-tactical-accent uppercase tracking-[0.2em] flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-tactical-accent animate-pulse"></span>
                          Encrypted Feed // 04-22
                      </span>
                  </div>
                  
                  <h1 className="font-display text-5xl md:text-6xl font-bold text-tactical-accent uppercase tracking-tighter mb-4 drop-shadow-lg">
                      NomadSync
                  </h1>

                  <div className="h-64 flex items-center justify-center">
                      {/* Character Silhouette placeholder or visual */}
                      <div className="w-1 h-32 bg-gradient-to-b from-transparent via-tactical-accent to-transparent opacity-50 blur-sm"></div>
                  </div>

                  <p className="font-display text-xl font-bold text-white uppercase tracking-widest leading-relaxed mb-8 max-w-xs">
                      Sync The Mission.<br/>Eliminate The Friction.
                  </p>
                  
                  <div className="flex gap-1 mb-12">
                      <div className="w-8 h-1 bg-tactical-accent rounded-full"></div>
                      <div className="w-2 h-1 bg-tactical-muted rounded-full"></div>
                      <div className="w-2 h-1 bg-tactical-muted rounded-full"></div>
                  </div>

                  <div className="w-full space-y-4 max-w-sm">
                      <button 
                        onClick={() => setMode('SIGNUP')}
                        className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all"
                      >
                          START NEW MISSION <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                      </button>
                      <button 
                        onClick={() => setMode('LOGIN')}
                        className="w-full bg-transparent hover:bg-white/5 border border-tactical-accent/50 text-tactical-accent font-display font-bold text-lg py-4 rounded-xl transition-all"
                      >
                          REJOIN CIRCLE
                      </button>
                  </div>
                  
                  <div className="mt-12 flex gap-4 text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                      <span>Protocol v2.0.4-X</span>
                      <span className="text-gray-800">|</span>
                      <span className="text-tactical-accent/50">Status: Active</span>
                      <span className="text-gray-800">|</span>
                      <span>Loc: Desert-Grid</span>
                  </div>
              </div>
          </div>
      );
  }

  // SIGN UP / LOGIN FORM
  return (
    <div className="flex flex-col h-full bg-tactical-bg relative animate-fade-in">
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')]"></div>

        <header className="px-6 py-8 z-10">
            <button 
               onClick={() => setMode('LANDING')}
               className="flex items-center gap-2 text-[10px] font-bold text-tactical-accent uppercase tracking-widest hover:text-white mb-6"
            >
                <div className="h-px w-8 bg-tactical-accent"></div>
                Mission Protocol 01
            </button>
            <h1 className="font-display text-5xl font-bold text-tactical-accent uppercase leading-none mb-2">
                {mode === 'SIGNUP' ? 'Recruit' : 'Operative'}
                <br/>
                {mode === 'SIGNUP' ? 'Enrollment' : 'Access'}
            </h1>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider max-w-xs leading-relaxed">
                Securing your digital footprint across the desert. Verification required.
            </p>
        </header>

        <div className="flex-1 px-6 z-10 overflow-y-auto">
             
             {/* Google Button */}
             <button 
               onClick={handleGoogleAuth}
               className="w-full bg-transparent hover:bg-white/5 border border-white/20 hover:border-white/50 py-4 rounded-none flex items-center justify-center gap-3 transition-colors mb-8 group"
             >
                 <GoogleIcon className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
                 <span className="font-bold text-white text-sm uppercase tracking-widest">Continue with Google</span>
             </button>

             <div className="flex items-center gap-4 mb-8">
                 <div className="h-px flex-1 bg-gray-800"></div>
                 <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Or Dispatch Via Email</span>
                 <div className="h-px flex-1 bg-gray-800"></div>
             </div>

             <div className="space-y-6">
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
        </div>

        <div className="p-6 sticky bottom-0 bg-tactical-bg border-t border-tactical-muted/10 z-20">
            <button 
              onClick={handleDeploy}
              disabled={isLoading}
              className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-xl py-5 rounded-none flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,215,0,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
               {isLoading ? (
                   <span className="animate-pulse">ESTABLISHING UPLINK...</span>
               ) : (
                   <>
                       {mode === 'SIGNUP' ? 'DEPLOY TO MISSION' : 'ACCESS TERMINAL'} 
                       <LightningIcon className="w-5 h-5 fill-black" />
                   </>
               )}
            </button>
            
            <div className="mt-6 text-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">
                    {mode === 'SIGNUP' ? 'Veteran?' : 'New Recruit?'}
                </span>
                <button 
                  onClick={() => setMode(mode === 'SIGNUP' ? 'LOGIN' : 'SIGNUP')}
                  className="text-white font-bold uppercase tracking-widest text-xs border-b border-tactical-accent pb-0.5 hover:text-tactical-accent transition-colors"
                >
                    {mode === 'SIGNUP' ? 'REJOIN CIRCLE' : 'ENROLL NOW'}
                </button>
            </div>
            
            <div className="flex justify-between mt-8 text-[9px] font-bold text-gray-700 uppercase tracking-widest">
                <span>DS-TRK-772</span>
                <span>AUTH-V3</span>
            </div>
        </div>
    </div>
  );
};

export default AuthScreen;