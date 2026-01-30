
import React from 'react';
import { Trip } from '../types';
import { MenuIcon, BellIcon, GridIcon, GlobeIcon, SendIcon, UserIcon, MapPinIcon, PlusIcon, WalletIcon } from './Icons';
import { getMissionCover, sanitizeAsset } from '../utils/assetUtils';
import AtmosphericGradient from './AtmosphericGradient';

interface DashboardProps {
    trips: Trip[];
    isLoading: boolean;
    onSelectTrip: (trip: Trip) => void;
    onCreateTrip: () => void;
    onNavigateProfile: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ trips, isLoading, onSelectTrip, onCreateTrip, onNavigateProfile }) => {

    const getStatusStyle = (status?: string) => {
        switch (status) {
            case 'IN_PROGRESS': return 'bg-tactical-accent text-black border-transparent shadow-[0_0_10px_rgba(255,215,0,0.5)]';
            case 'PLANNING': return 'bg-white/10 text-white backdrop-blur-md border-white/20';
            case 'COMPLETE': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
            default: return 'bg-gray-800 text-gray-300';
        }
    };

    const formatDateRange = (start: Date, end: Date) => {
        const s = new Date(start);
        const e = new Date(end);
        const m1 = s.toLocaleString('default', { month: 'short' }).toUpperCase();
        const m2 = e.toLocaleString('default', { month: 'short' }).toUpperCase();
        return `${m1} ${s.getDate()} - ${m2} ${e.getDate()}`;
    };

    const calculateProgress = (start: Date, end: Date) => {
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        const now = new Date().getTime();

        const totalDuration = endTime - startTime;
        const elapsed = now - startTime;

        if (totalDuration <= 0) return 0;
        return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    };

    // Calculate unique countries from trips
    const uniqueCountries = new Set<string>();
    trips.forEach(trip => {
        if (trip.countryCode) {
            uniqueCountries.add(trip.countryCode);
        }
        // Also count from itinerary items
        trip.items.forEach(item => {
            if (item.countryCode) {
                uniqueCountries.add(item.countryCode);
            }
            if (item.endCountryCode) {
                uniqueCountries.add(item.endCountryCode);
            }
        });
    });

    return (
        <div className="flex flex-col h-full bg-tactical-bg animate-fade-in relative">
            {isLoading && (
                <div className="absolute inset-0 bg-tactical-bg/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-tactical-accent animate-pulse-slow">
                    <div className="w-16 h-16 border-4 border-tactical-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="font-display text-xl uppercase tracking-widest">Establishing Secure Connection...</p>
                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-2">
                        RETRIEVING MISSION DATA
                    </p>
                </div>
            )}
            {/* Header */}
            <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-20">
                <button className="text-white hover:text-tactical-accent transition-colors">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-tactical-accent animate-pulse'}`}></div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{isLoading ? 'SYNCING...' : 'SYSTEM ONLINE'}</span>
                </div>
                <button className="text-white hover:text-tactical-accent transition-colors relative">
                    <BellIcon className="w-6 h-6" />
                    <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500"></div>
                </button>
            </header>

            {/* Title Section */}
            <div className="px-6 mb-6 text-center">
                <h1 className="font-display text-4xl font-bold text-white uppercase leading-none mb-1">
                    COMMAND<br /><span className="text-tactical-accent">CENTER</span>
                </h1>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                    OPERATIVE: NOMAD_01
                </p>
            </div>

            {/* Stats Row - Responsive Grid */}
            <div className="px-6 grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-[#3A3A35] flex items-center justify-center text-tactical-accent shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 22h20" /><path d="M16 10a4 4 0 0 1-4 4 4 4 0 0 1-4-4" /><path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" /><path d="M12 2v2" /></svg>
                    </div>
                    <div>
                        <div className="font-display font-bold text-xl text-white leading-none">{trips.length}</div>
                        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">MISSIONS</div>
                    </div>
                </div>
                <div className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-[#3A3A35] flex items-center justify-center text-tactical-accent shrink-0">
                        <GlobeIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-display font-bold text-xl text-white leading-none">{uniqueCountries.size}</div>
                        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">COUNTRIES</div>
                    </div>
                </div>
            </div>

            {/* Missions List */}
            <div className="flex-1 overflow-y-auto px-6 pb-32 scrollbar-hide">
                <div className="flex items-center justify-between mb-6">
                    <div className="border-l-4 border-tactical-accent pl-3">
                        <h2 className="font-display font-bold text-xl text-white uppercase tracking-wide">All Missions</h2>
                    </div>
                    {isLoading && (
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-tactical-accent animate-pulse"></div>
                            <span className="text-[8px] font-mono text-tactical-accent uppercase tracking-widest animate-pulse">Establishing Secure Connection...</span>
                        </div>
                    )}
                    {!isLoading && (
                        <button className="text-[10px] font-bold text-tactical-accent uppercase tracking-widest hover:text-white transition-colors">
                            VIEW ARCHIVE
                        </button>
                    )}
                </div>

                {/* Responsive Grid for Trips */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {trips.map((trip) => {
                        const progressPercent = calculateProgress(trip.startDate, trip.endDate);
                        const isComplete = trip.status === 'COMPLETE';

                        return (
                            <div
                                key={trip.id}
                                onClick={() => onSelectTrip(trip)}
                                className="relative rounded-2xl overflow-hidden h-64 group cursor-pointer border border-transparent hover:border-tactical-accent/50 transition-all active:scale-[0.98]"
                            >
                                {/* Background Image */}
                                {/* Background Gradient */}
                                <AtmosphericGradient
                                    trip={trip}
                                    className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-105"
                                />
                                {/* Overlay */}
                                {/* Overlay - Removed standard gradient, using specific glass area below */}

                                {/* Passport Stamp Seal for Complete Trips */}
                                {isComplete && (
                                    <div className="absolute top-4 right-4 z-10">
                                        {/* Stamp Container - Rotated */}
                                        <div className="w-20 h-20 rounded-full border-2 border-double border-tactical-accent/80 flex items-center justify-center transform -rotate-12 group-hover:rotate-0 transition-transform duration-500 bg-black/20 backdrop-blur-[2px] shadow-[0_0_15px_rgba(255,215,0,0.15)]">
                                            {/* Inner Ring */}
                                            <div className="w-[90%] h-[90%] rounded-full border border-tactical-accent/60 flex flex-col items-center justify-center p-1">
                                                {/* Top Arc Text Simulation */}
                                                <div className="text-[6px] font-black text-tactical-accent/90 uppercase tracking-[0.2em] leading-none mb-0.5">
                                                    MISSION
                                                </div>

                                                {/* Center Icon/Text */}
                                                <div className="flex flex-col items-center justify-center my-0.5">
                                                    <div className="text-tactical-accent drop-shadow-[0_0_2px_rgba(255,215,0,0.5)]">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                                    </div>
                                                    <div className="font-display font-bold text-[10px] text-tactical-accent uppercase tracking-widest leading-none mt-1">
                                                        CLEARED
                                                    </div>
                                                </div>

                                                {/* Date */}
                                                <div className="text-[6px] font-mono font-bold text-tactical-accent/80 uppercase tracking-wider border-t border-tactical-accent/40 pt-0.5 mt-0.5">
                                                    {new Date(trip.endDate).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: '2-digit' }).toUpperCase()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Content */}
                                {/* Top Content (Status + Members) */}
                                <div className="absolute top-0 inset-x-0 p-5 flex justify-between items-start z-10">
                                    <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${getStatusStyle(trip.status)} shadow-sm`}>
                                        STATUS: {trip.status?.replace('_', ' ')}
                                    </span>
                                    <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 shadow-sm">
                                        <UserIcon className="w-3 h-3 text-tactical-accent" />
                                        <span className="text-xs font-bold text-white">{trip.members.length}</span>
                                    </div>
                                </div>

                                {/* Bottom Content with Glass Overlay */}
                                <div className="absolute bottom-0 inset-x-0 p-5 pt-12 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent backdrop-blur-[4px]">
                                    <div className="flex items-center gap-2 text-gray-300 text-[10px] font-bold uppercase tracking-widest mb-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                                        {formatDateRange(trip.startDate, trip.endDate)}
                                    </div>
                                    <h3 className="font-display font-bold text-2xl uppercase leading-tight mb-1 shadow-sm text-white">
                                        {trip.name}
                                    </h3>
                                    <div className="text-gray-400 text-xs font-medium flex items-center gap-1">
                                        <MapPinIcon className="w-3 h-3" />
                                        {trip.destination}
                                    </div>

                                    {/* Progress Bar for Active */}
                                    {trip.status === 'IN_PROGRESS' && (
                                        <div className="mt-4 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden border border-white/10">
                                            <div
                                                className="h-full bg-tactical-accent shadow-[0_0_10px_rgba(255,215,0,0.8)] transition-all duration-1000 ease-out"
                                                style={{ width: `${progressPercent}%` }}
                                            ></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="h-8"></div>
            </div>

            {/* Floating Plot New Path Button */}
            <div className="absolute bottom-[4.5rem] left-0 right-0 flex justify-center z-40 px-6 pb-2 bg-gradient-to-t from-tactical-bg via-tactical-bg/90 to-transparent pt-8 pointer-events-none">
                <button
                    onClick={onCreateTrip}
                    className="pointer-events-auto bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-lg py-3 px-10 rounded-full shadow-[0_0_25px_rgba(255,215,0,0.3)] flex items-center justify-center gap-2 transition-transform hover:scale-105 active:scale-95 border-2 border-black/10"
                >
                    <div className="relative">
                        <MapPinIcon className="w-5 h-5 fill-current" />
                        <div className="absolute -top-1 -right-1 bg-black text-tactical-accent rounded-full w-2.5 h-2.5 flex items-center justify-center text-[8px] font-bold border border-tactical-accent">+</div>
                    </div>
                    PLOT NEW PATH
                </button>
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0F0F0E] border-t border-tactical-muted/10 px-6 py-3 flex justify-between items-center z-50 md:max-w-2xl lg:max-w-4xl mx-auto w-full">
                <button className="flex flex-col items-center gap-1 text-tactical-accent">
                    <GridIcon className="w-5 h-5" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Base</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-gray-500 hover:text-white transition-colors">
                    <SendIcon className="w-5 h-5" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Comms</span>
                </button>
                <button
                    onClick={onNavigateProfile}
                    className="flex flex-col items-center gap-1 text-gray-500 hover:text-white transition-colors"
                >
                    <UserIcon className="w-5 h-5" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Profile</span>
                </button>
            </div>
        </div >
    );
};

export default Dashboard;
