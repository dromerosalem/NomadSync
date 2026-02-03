
import React from 'react';
import { SyncLog, db } from '../db/LocalDatabase';
import { ItineraryItem } from '../types';
import { AlertTriangle, ShieldCheck, Database, Smartphone } from 'lucide-react';

interface ConflictResolverProps {
    conflict: SyncLog;
    onResolved: () => void;
}

const ConflictResolver: React.FC<ConflictResolverProps> = ({ conflict, onResolved }) => {
    const payload = conflict.payload as ItineraryItem;

    const handleKeepMine = async () => {
        // To resolve by keeping mine, we simply mark it as PENDING again 
        // BUT we must update its 'updatedAt' to be current so it passes the next conflict check
        // or we set a flag to force overwrite. 
        // Let's just update the timestamp to now.
        await db.sync_queue.update(conflict.id!, {
            status: 'PENDING',
            payload: { ...payload, updatedAt: Date.now() }
        });
        onResolved();
    };

    const handleAcceptHQ = async () => {
        // To resolve by accepting HQ, we delete the local mutation
        await db.sync_queue.delete(conflict.id!);
        // And we should probably trigger a re-fetch of this item, 
        // but the next full sync will handle it.
        onResolved();
    };

    return (
        <div className="fixed inset-0 z-[100] bg-tactical-bg/95 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-tactical-card border border-tactical-accent/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">

                {/* Decorative Tactical Background Elements */}
                <div className="absolute top-0 right-0 p-2 opacity-10">
                    <AlertTriangle size={80} className="text-tactical-accent" />
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-tactical-accent/20 p-2 rounded-lg">
                        <AlertTriangle className="text-tactical-accent" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-display font-bold text-tactical-accent tracking-wider uppercase">Tactical Conflict</h2>
                        <p className="text-xs text-tactical-muted uppercase font-semibold">Logistical Desync Detected</p>
                    </div>
                </div>

                {/* Situation Summary */}
                <div className="bg-tactical-highlight/50 border-l-4 border-tactical-accent p-4 mb-6 rounded-r-lg">
                    <p className="text-sm text-tactical-text leading-relaxed">
                        Mission HQ updated <span className="text-tactical-accent font-bold">"{payload.title}"</span> while you were operating offline.
                        Choose which data to retain.
                    </p>
                </div>

                {/* Comparison Section */}
                <div className="grid grid-cols-2 gap-4 mb-8">

                    {/* My Version */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-tactical-muted uppercase">
                            <Smartphone size={14} /> Local Version
                        </div>
                        <div className="bg-tactical-highlight p-3 rounded-xl border border-white/5 h-full">
                            <p className="text-xs text-tactical-muted mb-1 italic">Saved Locally</p>
                            <p className="text-sm font-bold text-white mb-1 line-clamp-1">{payload.title}</p>
                            <p className="text-lg font-display text-tactical-accent">${payload.cost}</p>
                        </div>
                        <button
                            onClick={handleKeepMine}
                            className="mt-2 py-3 px-4 bg-tactical-accent text-tactical-bg font-display font-bold rounded-xl active:scale-95 transition-transform uppercase text-xs tracking-widest shadow-lg shadow-tactical-accent/20"
                        >
                            Keep Mine
                        </button>
                    </div>

                    {/* HQ Version */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-tactical-muted uppercase">
                            <Database size={14} /> HQ Data
                        </div>
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5 h-full">
                            <p className="text-xs text-tactical-muted mb-1 italic">Server Version</p>
                            <p className="text-sm font-bold text-white/50 mb-1 line-clamp-1">Remote Update</p>
                            <p className="text-lg font-display text-white/50 italic">Verified</p>
                        </div>
                        <button
                            onClick={handleAcceptHQ}
                            className="mt-2 py-3 px-4 border-2 border-white/10 text-white/80 font-display font-bold rounded-xl active:scale-95 transition-transform uppercase text-xs tracking-widest hover:bg-white/5"
                        >
                            Accept HQ
                        </button>
                    </div>

                </div>

                {/* Footer Note */}
                <p className="text-[10px] text-center text-tactical-muted uppercase tracking-tighter">
                    * Choosing HQ will discard your recent offline modifications to this item.
                </p>

            </div>
        </div>
    );
};

export default ConflictResolver;
