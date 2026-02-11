import React, { useMemo } from 'react';
import { Member, Trip, ItemType } from '../types';
import { ChevronLeftIcon, GearIcon, SwordsIcon, NetworkIcon, WalletIcon, ListCheckIcon, EditIcon, PlusIcon, MapPinIcon, CompassIcon, WalkIcon, InfoIcon } from './Icons';
import AtmosphericGradient from './AtmosphericGradient';
import AtmosphericAvatar from './AtmosphericAvatar';
import { NotificationManager } from '../services/NotificationManager';
import { calculateAchievements, calculateProfileLevel } from '../services/achievementService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { BellIcon, BellOffIcon } from './Icons';

// Sub-component with local state for push notification management
const PushNotificationSection: React.FC = () => {
    const [isSubscribed, setIsSubscribed] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        NotificationManager.isSubscribed().then(status => {
            setIsSubscribed(status);
            setIsLoading(false);
        });
    }, []);

    const handleEnable = async () => {
        setIsLoading(true);
        const permission = await NotificationManager.requestPermission();
        if (permission === 'granted') {
            const subbed = await NotificationManager.isSubscribed();
            setIsSubscribed(subbed);
        }
        setIsLoading(false);
    };

    const handleDisable = async () => {
        setIsLoading(true);
        await NotificationManager.unsubscribe();
        setIsSubscribed(false);
        setIsLoading(false);
    };

    return (
        <div>
            <div className="flex items-center gap-2 text-tactical-accent mb-3">
                {isSubscribed ? <BellIcon className="w-5 h-5" /> : <BellOffIcon className="w-5 h-5 text-gray-500" />}
                <span className="font-display font-bold uppercase tracking-wider text-sm">Push Notifications</span>
                {/* Status Badge */}
                <span className={`ml-auto text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${isSubscribed ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-gray-500 border-gray-500/30 bg-gray-500/10'}`}>
                    {isLoading ? 'CHECKING…' : isSubscribed ? 'ACTIVE' : 'DISABLED'}
                </span>
            </div>
            <div className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-4">
                    Get instant alerts when your team adds expenses, updates plans, or settles debts.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={handleEnable}
                        disabled={isLoading || isSubscribed}
                        className={`flex-1 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ${isSubscribed ? 'bg-tactical-accent text-black cursor-default' : 'bg-tactical-accent/10 border border-tactical-accent/50 text-tactical-accent hover:bg-tactical-accent hover:text-black'}`}
                    >
                        {isSubscribed ? '✓ Enabled' : 'Enable Notifications'}
                    </button>
                    <button
                        onClick={handleDisable}
                        disabled={isLoading || !isSubscribed}
                        className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ${!isSubscribed ? 'border border-gray-500/30 text-gray-500 cursor-default' : 'border border-red-500/30 text-red-500 hover:bg-red-500/10'}`}
                    >
                        Disable Alerts
                    </button>
                </div>
            </div>
        </div>
    );
};

interface NomadProfileProps {
    user: Member;
    trips: Trip[];
    onBack: () => void;
    onCreateMission: () => void;
    onSignOut: () => void;
    onViewGlobalLedger: () => void;
    onViewPrivacy: () => void;
    onViewTerms: () => void;
}

const NomadProfile: React.FC<NomadProfileProps> = ({ user, trips, onBack, onCreateMission, onSignOut, onViewGlobalLedger, onViewPrivacy, onViewTerms }) => {
    // Network status detection
    const isOnline = useNetworkStatus();

    // Banner states
    const [showCombatStatsInfo, setShowCombatStatsInfo] = React.useState(false);
    const [showSkillTreeInfo, setShowSkillTreeInfo] = React.useState(false);
    const [showFinancialHonorInfo, setShowFinancialHonorInfo] = React.useState(false);

    // --- REAL-TIME ANALYTICS ---
    const stats = useMemo(() => {
        let missionCount = 0;
        const uniqueCountries = new Set<string>();
        const uniqueTerritories = new Set<string>();
        let lifetimeSettled = 0;
        let currentNetBalance = 0; // Positive = Owed to me, Negative = I owe others

        trips.forEach(trip => {
            // 1. Mission Counts
            if (trip.status === 'COMPLETE' || trip.status === 'IN_PROGRESS') {
                missionCount++;
            }

            // 2. Country Tracking (from trip-level countryCode)
            if (trip.countryCode) {
                uniqueCountries.add(trip.countryCode);
            }

            // 3. Territory Tracking (cities/regions from destination, excluding countries)
            if (trip.destination) {
                // Extract city/region (before "•" if present)
                const parts = trip.destination.split('•');
                const territory = parts[0].trim(); // City or region name
                if (territory && territory !== trip.countryCode) {
                    uniqueTerritories.add(territory);
                }
            }

            // 4. Also count countries from itinerary items
            trip.items.forEach(item => {
                if (item.countryCode) {
                    uniqueCountries.add(item.countryCode);
                }
                if (item.endCountryCode) {
                    uniqueCountries.add(item.endCountryCode);
                }
            });

            // 5. Financial Analysis (Aggregate across all trips)
            trip.items.forEach(item => {
                if (item.isPrivate) return;

                const cost = item.cost || 0;
                const iPaid = item.paidBy === user.id;
                const isSettlement = item.type === ItemType.SETTLEMENT;

                // Determine if I am a consumer/receiver in this transaction
                const splitWith = item.splitWith || [];
                const splitDetails = item.splitDetails || {};

                // Check if user is in the split list or has a specific key in splitDetails
                // Note: For Settlements, splitWith[0] is typically the receiver
                const amIInvolved = splitWith.includes(user.id) || splitDetails[user.id] !== undefined;

                let myShare = 0;
                if (amIInvolved) {
                    if (splitDetails[user.id] !== undefined) {
                        myShare = splitDetails[user.id];
                    } else {
                        const count = splitWith.length || 1;
                        myShare = cost / count;
                    }
                }

                // A. Debts Settled (Cash Outflows for Settlements)
                if (isSettlement && iPaid) {
                    lifetimeSettled += cost;
                }

                // B. Net Balance Calc
                // Credit (+): Money leaving my pocket (I paid expense OR I settled debt)
                if (iPaid) {
                    currentNetBalance += cost;
                }

                // Debit (-): Value/Money entering my consumption (I ate food OR I received settlement)
                if (amIInvolved) {
                    currentNetBalance -= myShare;
                }
            });
        });

        // If Net Balance is negative, I owe money (Outstanding Debt)
        // If Net Balance is positive, I am owed money (Credit)
        const outstandingDebt = currentNetBalance < -0.01 ? Math.abs(currentNetBalance) : 0;

        return {
            missions: missionCount,
            countries: uniqueCountries.size,
            territories: uniqueTerritories.size,
            settled: lifetimeSettled,
            outstanding: outstandingDebt
        };
    }, [trips, user.id]);

    // Calculate achievements
    const achievements = useMemo(() => {
        return calculateAchievements(trips, user.id); // All achievements, filter later
    }, [trips, user.id]);

    const unlockedAchievements = useMemo(() => {
        return achievements.filter(a => a.level > 0);
    }, [achievements]);

    const profileProgress = useMemo(() => {
        return calculateProfileLevel(achievements);
    }, [achievements]);

    const completedTrips = trips.filter(t => t.status === 'COMPLETE').sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

    return (
        <div className="flex flex-col h-full bg-tactical-bg animate-fade-in relative">
            <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-30 border-b border-tactical-muted/10">
                <button onClick={onBack} className="text-tactical-accent hover:text-white">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <div className="font-display font-bold text-lg text-tactical-accent uppercase tracking-wider">
                    Nomad Profile
                </div>
                <button
                    onClick={onSignOut}
                    className="text-red-500 hover:text-red-400 font-display font-bold text-[10px] uppercase tracking-widest border border-red-500/30 px-2 py-1 rounded"
                >
                    Sign Out
                </button>
            </header>

            <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
                {/* Avatar & Class */}
                <div className="relative pt-8 pb-8 flex flex-col items-center">
                    {/* Background Kanji */}
                    <div className="absolute top-4 right-6 text-[100px] font-black text-white/5 pointer-events-none select-none leading-none">
                        旅
                    </div>

                    <div className="relative mb-6">
                        <div className="relative inline-block">
                            <AtmosphericAvatar
                                userId={user.id}
                                avatarUrl={user.avatarUrl}
                                name={user.name}
                                size="xxl"
                                className="shadow-[0_0_30px_rgba(255,255,255,0.05)]"
                            />
                            <button className="absolute bottom-2 right-2 z-20 bg-tactical-accent text-black p-2.5 rounded-full border-4 border-tactical-bg shadow-xl hover:bg-yellow-400 transition-all hover:scale-110 active:scale-95">
                                <EditIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <h1 className="font-display text-2xl font-bold text-white uppercase tracking-wider mb-1">
                        {user.name}
                    </h1>
                    <div className="flex items-center gap-3 text-sm mb-2">
                        <span className="bg-white/10 px-2 py-0.5 rounded text-gray-400 border border-white/5 uppercase font-bold text-[10px] tracking-wider">
                            LEVEL {profileProgress.level}
                        </span>
                        <span className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">{profileProgress.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full transition-colors ${isOnline ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]' : 'bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,0.8)]'}`}></div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            STATUS: {isOnline ? 'ACTIVE' : 'OFFLINE'}
                        </span>
                    </div>
                </div>

                <div className="px-6 space-y-8">
                    {/* Combat Stats */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center gap-2 text-tactical-accent">
                                <SwordsIcon className="w-5 h-5" />
                                <span className="font-display font-bold uppercase tracking-wider text-sm">Combat Stats</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowCombatStatsInfo(!showCombatStatsInfo);
                                }}
                                className="text-gray-600 hover:text-tactical-accent transition-colors"
                            >
                                <InfoIcon className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Combat Stats Info Banner */}
                        {showCombatStatsInfo && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowCombatStatsInfo(false)}
                                />
                                <div className="relative z-50 mt-1 mb-4 p-4 bg-tactical-accent/10 border border-tactical-accent/30 rounded-xl animate-fade-in backdrop-blur-sm">
                                    <div className="flex items-start gap-3">
                                        <InfoIcon className="w-4 h-4 text-tactical-accent mt-0.5 shrink-0" />
                                        <p className="text-[11px] font-bold text-white leading-relaxed">
                                            Your tactical footprint. <span className="text-tactical-accent">Missions</span> are completed trips, <span className="text-tactical-accent">Territories</span> are major regions explored, and <span className="text-tactical-accent">Countries</span> represent nations you've navigated.
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-3 flex flex-col items-center justify-center aspect-square">
                                <span className="font-display text-3xl font-bold text-tactical-accent mb-1">{stats.missions}</span>
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Missions</span>
                            </div>
                            <div className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-3 flex flex-col items-center justify-center aspect-square">
                                <span className="font-display text-3xl font-bold text-tactical-accent mb-1">{stats.territories}</span>
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Territories</span>
                            </div>
                            <div className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-3 flex flex-col items-center justify-center aspect-square">
                                <span className="font-display text-3xl font-bold text-tactical-accent mb-1">
                                    {stats.countries}
                                </span>
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Countries</span>
                            </div>
                        </div>
                    </div>

                    {/* Skill Tree */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center gap-2 text-tactical-accent">
                                <NetworkIcon className="w-5 h-5" />
                                <span className="font-display font-bold uppercase tracking-wider text-sm">Skill Tree</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowSkillTreeInfo(!showSkillTreeInfo);
                                }}
                                className="text-gray-600 hover:text-tactical-accent transition-colors"
                            >
                                <InfoIcon className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Skill Tree Info Banner */}
                        {showSkillTreeInfo && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowSkillTreeInfo(false)}
                                />
                                <div className="relative z-50 mt-1 mb-4 p-4 bg-tactical-accent/10 border border-tactical-accent/30 rounded-xl animate-fade-in backdrop-blur-sm">
                                    <div className="flex items-start gap-3">
                                        <InfoIcon className="w-4 h-4 text-tactical-accent mt-0.5 shrink-0" />
                                        <p className="text-[11px] font-bold text-white leading-relaxed">
                                            Your progressive growth. Unlock and level up skills by completing missions and managing group finances. Higher levels unlock legendary accolades!
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}

                        {unlockedAchievements.length === 0 ? (
                            <div className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-6 text-center">
                                <p className="text-gray-500 text-sm">
                                    Complete missions and add items to unlock skills!
                                </p>
                            </div>
                        ) : (
                            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
                                {unlockedAchievements.map(achievement => {
                                    // Map icon names to actual icon components
                                    const IconComponent = achievement.icon === 'WalletIcon' ? WalletIcon :
                                        achievement.icon === 'CompassIcon' ? CompassIcon :
                                            achievement.icon === 'NetworkIcon' ? NetworkIcon :
                                                MapPinIcon; // default

                                    // Determine Rarity
                                    const rarity = achievement.level >= 5 ? 'LEGENDARY' :
                                        achievement.level >= 4 ? 'EPIC' :
                                            achievement.level >= 2 ? 'RARE' : 'COMMON';

                                    const rarityStyles = {
                                        LEGENDARY: { glow: 'neon-glow-gold', text: 'text-tactical-accent', label: 'LEGENDARY', iconBg: 'bg-yellow-500/20', iconColor: 'text-yellow-400' },
                                        EPIC: { glow: 'neon-glow-purple', text: 'text-purple-400', label: 'EPIC', iconBg: 'bg-purple-500/20', iconColor: 'text-purple-400' },
                                        RARE: { glow: 'neon-glow-cyan', text: 'text-cyan-400', label: 'RARE', iconBg: 'bg-cyan-500/20', iconColor: 'text-cyan-400' },
                                        COMMON: { glow: 'border-white/10', text: 'text-white', label: 'OPERATIVE', iconBg: 'bg-white/5', iconColor: 'text-gray-400' }
                                    };

                                    const style = rarityStyles[rarity];

                                    return (
                                        <div
                                            key={achievement.id}
                                            className={`min-w-[145px] bg-gradient-to-b from-[#1A1A18] to-[#0F0F0E] border-2 rounded-2xl p-4 flex flex-col items-center text-center group transition-all duration-500 relative overflow-hidden active:scale-95 ${style.glow} hover:-translate-y-1`}
                                        >
                                            {/* Holographic Layer for High Tier */}
                                            {achievement.level >= 4 && <div className="card-holo-layer" />}

                                            {/* Rarity Tag */}
                                            <div className={`absolute top-2 right-2 text-[7px] font-black px-1.5 py-0.5 rounded border border-current opacity-70 ${style.text}`}>
                                                {style.label}
                                            </div>

                                            <div className={`w-14 h-14 rounded-2xl ${style.iconBg} flex items-center justify-center ${style.iconColor} mb-3 group-hover:scale-110 transition-transform duration-500 relative`}>
                                                {/* Skill Icon Glow */}
                                                <div className={`absolute inset-0 opacity-20 blur-xl ${style.iconBg} rounded-full`}></div>
                                                <IconComponent className="w-7 h-7 relative z-10" />
                                            </div>

                                            <div className="font-display font-black text-white uppercase text-xs leading-tight mb-2 tracking-wider h-8 flex items-center justify-center">
                                                {achievement.name}
                                            </div>

                                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-2">
                                                <div
                                                    className={`h-full ${style.iconBg.replace('/20', '')} transition-all duration-1000`}
                                                    style={{ width: `${(achievement.level / achievement.maxLevel) * 100}%` }}
                                                ></div>
                                            </div>

                                            <div className={`text-[9px] font-black uppercase tracking-widest ${style.text}`}>
                                                LVL {achievement.level}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Financial Honor */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center gap-2 text-tactical-accent">
                                <WalletIcon className="w-5 h-5" />
                                <span className="font-display font-bold uppercase tracking-wider text-sm">Financial Honor</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowFinancialHonorInfo(!showFinancialHonorInfo);
                                }}
                                className="text-gray-600 hover:text-tactical-accent transition-colors"
                            >
                                <InfoIcon className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Financial Honor Info Banner */}
                        {showFinancialHonorInfo && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowFinancialHonorInfo(false)}
                                />
                                <div className="relative z-50 mt-1 mb-4 p-4 bg-tactical-accent/10 border border-tactical-accent/30 rounded-xl animate-fade-in backdrop-blur-sm">
                                    <div className="flex items-start gap-3">
                                        <InfoIcon className="w-4 h-4 text-tactical-accent mt-0.5 shrink-0" />
                                        <p className="text-[11px] font-bold text-white leading-relaxed">
                                            Your economic reputation. <span className="text-tactical-accent">Debts Settled</span> is the total cash you’ve paid to others. <span className="text-red-500 font-black">Outstanding</span> is what you currently owe to clear your standing.
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                        <div className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-0 overflow-hidden">
                            <div className="flex">
                                <div className="flex-1 p-4 border-r border-tactical-muted/10">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Debts Settled</div>
                                    <div className="font-display text-xl font-bold text-white">${stats.settled.toLocaleString()}</div>
                                    <div className="h-1 bg-gray-800 rounded-full mt-2 overflow-hidden">
                                        <div className="h-full w-full bg-tactical-accent opacity-50"></div>
                                    </div>
                                </div>
                                <div className="flex-1 p-4">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Outstanding</div>
                                    <div className={`font-display text-xl font-bold ${stats.outstanding > 0 ? 'text-red-500' : 'text-white'}`}>
                                        ${stats.outstanding.toLocaleString()}
                                    </div>
                                    <div className="h-1 bg-gray-800 rounded-full mt-2 overflow-hidden">
                                        {stats.outstanding > 0 && (
                                            <div className="h-full w-1/2 bg-red-600 animate-pulse"></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onViewGlobalLedger}
                                className="w-full py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-tactical-accent hover:bg-white/5 flex items-center justify-center gap-2 border-t border-tactical-muted/10 group transition-all active:scale-[0.99]"
                            >
                                <span>View Ledger History</span>
                                <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m9 18 6-6-6-6" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Push Notifications */}
                    <PushNotificationSection />

                    {/* Recent Hits */}
                    <div>
                        <div className="flex items-center gap-2 text-tactical-accent mb-3">
                            <ListCheckIcon className="w-5 h-5" />
                            <span className="font-display font-bold uppercase tracking-wider text-sm">Recent Hits</span>
                        </div>
                        <div className="space-y-3">
                            {completedTrips.length > 0 ? completedTrips.slice(0, 3).map(trip => (
                                <div key={trip.id} className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-3 flex items-center gap-4 active:bg-white/5 transition-colors cursor-pointer" onClick={() => {/* TODO: Navigate to trip */ }}>
                                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/5 shadow-inner">
                                        <AtmosphericGradient
                                            trip={trip}
                                            className="w-full h-full scale-150"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-display font-bold text-white uppercase text-sm">{trip.name}</div>
                                        <div className="text-xs text-gray-500">{trip.destination} • {new Date(trip.endDate).toLocaleDateString()}</div>
                                    </div>
                                    <div className="px-2 py-1 rounded border border-tactical-accent/30 text-[9px] font-bold text-tactical-accent uppercase tracking-widest">
                                        COMPLETE
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center p-6 border border-dashed border-tactical-muted/30 rounded-xl">
                                    <div className="text-gray-500 text-xs italic mb-2">No completed missions in archive.</div>
                                    <button onClick={onCreateMission} className="text-[10px] font-bold text-tactical-accent uppercase tracking-widest hover:underline">
                                        START FIRST MISSION
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                <div className="flex justify-center gap-6 mt-12 mb-8 opacity-40">
                    <button onClick={onViewPrivacy} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors">Privacy Policy</button>
                    <button onClick={onViewTerms} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors">Terms of Service</button>
                </div>
            </div>

            <div className="absolute bottom-[2rem] left-0 right-0 px-6 z-40">
                <button
                    onClick={onCreateMission}
                    className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-lg py-4 rounded-xl shadow-[0_0_15px_rgba(255,215,0,0.2)] flex items-center justify-center gap-2 transition-all border-2 border-black/10"
                >
                    <div className="bg-black text-tactical-accent rounded-full p-0.5">
                        <PlusIcon className="w-4 h-4" />
                    </div>
                    NEW MISSION
                </button>
            </div>
        </div>
    );
};

export default NomadProfile;
