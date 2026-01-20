import React, { useState, useEffect } from 'react';
import { Trip, Role, Member } from '../types';
import { ChevronLeftIcon, LinkIcon, CopyIcon, SendIcon, EditIcon, EyeIcon, PlusIcon, SearchIcon } from './Icons';
import { tripService } from '../services/tripService';
import { sanitizeAsset } from '../utils/assetUtils';
import AtmosphericAvatar from './AtmosphericAvatar';

interface InviteMemberProps {
    trip: Trip;
    onBack: () => void;
    onInvite: (emailOrId: string, role: Role) => void;
}

const SearchList: React.FC<{ query: string, onSelect: (user: Member) => void, existingMemberIds: string[] }> = ({ query, onSelect, existingMemberIds }) => {
    const [results, setResults] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const search = async () => {
            setLoading(true);
            try {
                const users = await tripService.searchUsers(query);
                setResults(users.filter(u => !existingMemberIds.includes(u.id)));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        const timeout = setTimeout(search, 500);
        return () => clearTimeout(timeout);
    }, [query, existingMemberIds]);

    if (loading) return <div className="p-4 text-center text-xs text-gray-400">SCANNING DATABASE...</div>;
    if (results.length === 0) return <div className="p-4 text-center text-xs text-gray-500">NO OPERATIVES FOUND</div>;

    return (
        <div className="divide-y divide-white/5">
            {results.map(user => (
                <button
                    key={user.id}
                    onClick={() => onSelect(user)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                >
                    <AtmosphericAvatar
                        userId={user.id}
                        avatarUrl={user.avatarUrl}
                        name={user.name}
                        size="sm"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{user.name}</div>
                        <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
                    </div>
                    <div className="text-[9px] font-bold text-tactical-accent border border-tactical-accent/30 px-2 py-0.5 rounded">RECRUIT</div>
                </button>
            ))}
        </div>
    );
};

const InviteMember: React.FC<InviteMemberProps> = ({ trip, onBack, onInvite }) => {
    const [selectedRole, setSelectedRole] = useState<Role>('SCOUT');
    const [email, setEmail] = useState('');
    const [copied, setCopied] = useState(false);

    const inviteLink = `${window.location.origin}/?join=${trip.id}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSendInvite = () => {
        if (email && email.includes('@')) {
            const normalizedEmail = email.trim().toLowerCase();
            onInvite(normalizedEmail, selectedRole);
            setEmail('');
            // Optionally show success feedback
        }
    };

    return (
        <div className="flex flex-col h-full bg-tactical-bg animate-fade-in">
            <header className="px-6 py-4 flex items-center gap-4 sticky top-0 bg-tactical-bg z-20 border-b border-tactical-muted/10">
                <button onClick={onBack} className="text-gray-400 hover:text-white">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <div className="font-display font-bold text-lg text-tactical-accent uppercase tracking-wider">
                    Recruit Your Circle
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">

                {/* Mission URL */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-tactical-accent uppercase tracking-widest">
                        <LinkIcon className="w-3 h-3" /> Mission URL
                    </div>
                    <div className="bg-tactical-card rounded-xl p-1 border border-tactical-muted/30 flex flex-col gap-2">
                        <div className="bg-black/20 rounded-t-lg p-3 font-mono text-sm text-gray-400 select-all truncate">
                            {inviteLink}
                        </div>
                        <button
                            onClick={handleCopy}
                            className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-bold uppercase py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                            {copied ? (
                                <span>COPIED TO CLIPBOARD</span>
                            ) : (
                                <>
                                    <CopyIcon className="w-4 h-4" /> COPY LINK
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Clearance Level */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-tactical-accent uppercase tracking-widest">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                        Clearance Level
                    </div>

                    {/* SCOUT Option */}
                    <button
                        onClick={() => setSelectedRole('SCOUT')}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-4 group ${selectedRole === 'SCOUT'
                            ? 'bg-tactical-accent/10 border-tactical-accent'
                            : 'bg-tactical-card border-tactical-muted/20 hover:border-tactical-muted'
                            }`}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${selectedRole === 'SCOUT' ? 'bg-tactical-accent text-black' : 'bg-black/40 text-gray-500'}`}>
                            <EditIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                                <span className={`font-display font-bold uppercase tracking-wide ${selectedRole === 'SCOUT' ? 'text-tactical-accent' : 'text-gray-300'}`}>SCOUT</span>
                                <div className={`w-3 h-3 rounded-full border border-gray-600 flex items-center justify-center ${selectedRole === 'SCOUT' ? 'bg-tactical-accent border-transparent' : ''}`}>
                                    {selectedRole === 'SCOUT' && <div className="w-1.5 h-1.5 rounded-full bg-black"></div>}
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Full operational access. Can modify itinerary and budget.
                            </p>
                        </div>
                    </button>

                    {/* PASSENGER Option */}
                    <button
                        onClick={() => setSelectedRole('PASSENGER')}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-4 group ${selectedRole === 'PASSENGER'
                            ? 'bg-tactical-accent/10 border-tactical-accent'
                            : 'bg-tactical-card border-tactical-muted/20 hover:border-tactical-muted'
                            }`}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${selectedRole === 'PASSENGER' ? 'bg-tactical-accent text-black' : 'bg-black/40 text-gray-500'}`}>
                            <EyeIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                                <span className={`font-display font-bold uppercase tracking-wide ${selectedRole === 'PASSENGER' ? 'text-tactical-accent' : 'text-gray-300'}`}>PASSENGER</span>
                                <div className={`w-3 h-3 rounded-full border border-gray-600 flex items-center justify-center ${selectedRole === 'PASSENGER' ? 'bg-tactical-accent border-transparent' : ''}`}>
                                    {selectedRole === 'PASSENGER' && <div className="w-1.5 h-1.5 rounded-full bg-black"></div>}
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Surveillance only. Read-only access to mission details.
                            </p>
                        </div>
                    </button>
                </div>

                {/* Direct Comms (Search) */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-tactical-accent uppercase tracking-widest">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        Find Operative
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                // Trigger search (debounced ideally, but simple for now)
                            }}
                            placeholder="Search by name or email..."
                            className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-tactical-accent outline-none"
                        />
                        {email.length > 2 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-tactical-card border border-tactical-muted/50 rounded-lg shadow-2xl z-30 max-h-48 overflow-y-auto">
                                <SearchList query={email} onSelect={(user) => {
                                    onInvite(user.id, selectedRole); // Passing ID now
                                    setEmail('');
                                }} existingMemberIds={trip.members.map(m => m.id)} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Active Squad Preview */}
                <div className="pt-4 border-t border-tactical-muted/10">
                    <div className="flex justify-between items-end mb-3">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-tactical-accent uppercase tracking-widest">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                            Active Squad
                        </div>
                        <div className="text-[9px] font-bold text-tactical-muted border border-tactical-muted/30 px-1.5 py-0.5 rounded bg-black/30">
                            {trip.members.filter(m => m.status === 'ACTIVE').length} ACTIVE
                        </div>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                        {trip.members.map(member => (
                            <div key={member.id} className="flex flex-col items-center gap-1 min-w-[60px]">
                                <div className="relative">
                                    <AtmosphericAvatar
                                        userId={member.id}
                                        avatarUrl={member.avatarUrl}
                                        name={member.name}
                                        size="xl"
                                        isPathfinder={member.role === 'PATHFINDER'}
                                    />
                                </div>
                                <span className="text-[10px] text-gray-400 font-medium truncate w-full text-center">
                                    {member.name.split(' ')[0]} {member.name.split(' ')[1]?.[0]}.
                                </span>
                            </div>
                        ))}

                        {/* Dummy Invite placeholder at end */}
                        <div className="flex flex-col items-center gap-1 min-w-[60px] opacity-50">
                            <div className="w-14 h-14 rounded-full border border-dashed border-gray-500 flex items-center justify-center text-gray-500">
                                <PlusIcon className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] text-gray-500 font-medium">Invite</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default InviteMember;
