import React, { useMemo } from 'react';
import { sanitizeAsset } from '../utils/assetUtils';
import { Member, Trip, ItemType } from '../types';
import { ChevronLeftIcon, GearIcon, SwordsIcon, NetworkIcon, WalletIcon, ListCheckIcon, EditIcon, PlusIcon, MapPinIcon, CompassIcon, WalkIcon } from './Icons';
import TacticalImage from './TacticalImage';
import AtmosphericAvatar from './AtmosphericAvatar';

interface NomadProfileProps {
    user: Member;
    trips: Trip[];
    onBack: () => void;
    onCreateMission: () => void;
    onSignOut: () => void;
}

const NomadProfile: React.FC<NomadProfileProps> = ({ user, trips, onBack, onCreateMission, onSignOut }) => {

    // --- REAL-TIME ANALYTICS ---
    const stats = useMemo(() => {
        let missionCount = 0;
        const uniqueTerritories = new Set<string>();
        let lifetimeSettled = 0;
        let currentNetBalance = 0; // Positive = Owed to me, Negative = I owe others

        trips.forEach(trip => {
            // 1. Mission Counts
            if (trip.status === 'COMPLETE' || trip.status === 'IN_PROGRESS') {
                missionCount++;
            }

            // 2. Territory Tracking
            if (trip.destination) {
                // Heuristic: Extract country/region after "•" or use full string
                const parts = trip.destination.split('•');
                const territory = parts.length > 1 ? parts[1].trim() : parts[0].trim();
                if (territory) uniqueTerritories.add(territory);
            }

            // 3. Financial Analysis (Aggregate across all trips)
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
            territories: uniqueTerritories.size,
            miles: missionCount * 3124, // Estimate based on missions
            settled: lifetimeSettled,
            outstanding: outstandingDebt
        };
    }, [trips, user.id]);

    const completedTrips = trips.filter(t => t.status === 'COMPLETE').sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

    return (
        <div className="flex flex-col h-full bg-tactical-bg animate-fade-in relative">
            <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-20 border-b border-tactical-muted/10">
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
                    Terminate
                </button>
            </header>

            <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
                {/* Avatar & Class */}
                <div className="relative pt-8 pb-8 flex flex-col items-center">
                    {/* Background Kanji */}
                    <div className="absolute top-4 right-6 text-[100px] font-black text-white/5 pointer-events-none select-none leading-none">
                        旅
                    </div>

                    <div className="relative mb-4">
                        <AtmosphericAvatar
                            userId={user.id}
                            avatarUrl={user.avatarUrl}
                            name={user.name}
                            size="xl"
                            className="w-32 h-32"
                        />
                        <button className="absolute bottom-1 right-1 z-20 bg-tactical-accent text-black p-2 rounded-full border-4 border-tactical-bg shadow-lg hover:bg-yellow-400 transition-colors">
                            <EditIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <h1 className="font-display text-2xl font-bold text-white uppercase tracking-wider mb-1">
                        {user.name}
                    </h1>
                    <div className="flex items-center gap-3 text-sm mb-2">
                        <span className="bg-white/10 px-2 py-0.5 rounded text-gray-400 border border-white/5 uppercase font-bold text-[10px] tracking-wider">
                            LEVEL {Math.floor(stats.miles / 1000) + 1}
                        </span>
                        <span className="text-gray-400">Pathfinder Class</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">STATUS: ACTIVE</span>
                    </div>
                </div>

                <div className="px-6 space-y-8">
                    {/* Combat Stats */}
                    <div>
                        <div className="flex items-center gap-2 text-tactical-accent mb-3">
                            <SwordsIcon className="w-5 h-5" />
                            <span className="font-display font-bold uppercase tracking-wider text-sm">Combat Stats</span>
                        </div>
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
                                <span className="font-display text-2xl font-bold text-tactical-accent mb-1">
                                    {stats.miles >= 1000 ? (stats.miles / 1000).toFixed(1) + 'k' : stats.miles}
                                </span>
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Miles</span>
                            </div>
                        </div>
                    </div>

                    {/* Skill Tree */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-tactical-accent">
                                <NetworkIcon className="w-5 h-5" />
                                <span className="font-display font-bold uppercase tracking-wider text-sm">Skill Tree</span>
                            </div>
                            <button className="text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-white">View All</button>
                        </div>

                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
                            <div className="min-w-[140px] bg-tactical-card border border-tactical-muted/20 rounded-xl p-4 flex flex-col items-center text-center group hover:border-tactical-accent/50 transition-colors">
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-400 mb-3 group-hover:bg-tactical-accent/20 group-hover:text-tactical-accent">
                                    <MapPinIcon className="w-6 h-6" />
                                </div>
                                <div className="font-display font-bold text-white uppercase text-sm leading-tight mb-1">Master Planner</div>
                                <div className="text-xs text-gray-500">Lvl {Math.min(5, stats.missions)}</div>
                            </div>

                            <div className="min-w-[140px] bg-tactical-card border border-tactical-muted/20 rounded-xl p-4 flex flex-col items-center text-center group hover:border-tactical-accent/50 transition-colors">
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-400 mb-3 group-hover:bg-tactical-accent/20 group-hover:text-tactical-accent">
                                    <CompassIcon className="w-6 h-6" />
                                </div>
                                <div className="font-display font-bold text-white uppercase text-sm leading-tight mb-1">Navigator</div>
                                <div className="text-xs text-gray-500">Lvl {Math.min(8, stats.territories)}</div>
                            </div>

                            <div className="min-w-[140px] bg-tactical-card border border-tactical-muted/20 rounded-xl p-4 flex flex-col items-center text-center group hover:border-tactical-accent/50 transition-colors">
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-400 mb-3 group-hover:bg-tactical-accent/20 group-hover:text-tactical-accent">
                                    <WalkIcon className="w-6 h-6" />
                                </div>
                                <div className="font-display font-bold text-white uppercase text-sm leading-tight mb-1">Drifter</div>
                                <div className="text-xs text-gray-500">Lvl {Math.floor(stats.miles / 5000)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Financial Honor */}
                    <div>
                        <div className="flex items-center gap-2 text-tactical-accent mb-3">
                            <WalletIcon className="w-5 h-5" />
                            <span className="font-display font-bold uppercase tracking-wider text-sm">Financial Honor</span>
                        </div>
                        <div className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-0 overflow-hidden">
                            <div className="flex border-b border-tactical-muted/10">
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
                            <button className="w-full py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white hover:bg-white/5 flex items-center justify-between px-4">
                                <span>View Ledger History</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Recent Hits */}
                    <div>
                        <div className="flex items-center gap-2 text-tactical-accent mb-3">
                            <ListCheckIcon className="w-5 h-5" />
                            <span className="font-display font-bold uppercase tracking-wider text-sm">Recent Hits</span>
                        </div>
                        <div className="space-y-3">
                            {completedTrips.length > 0 ? completedTrips.slice(0, 3).map(trip => (
                                <div key={trip.id} className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-3 flex items-center gap-4">
                                    <TacticalImage
                                        src={sanitizeAsset(trip.coverImage, trip.id)}
                                        alt={trip.name}
                                        className="w-12 h-12 rounded-lg grayscale opacity-70"
                                    />
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
