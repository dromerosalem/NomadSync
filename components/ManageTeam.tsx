import React from 'react';
import { Trip, Member, Role } from '../types';
import { ChevronLeftIcon, MoreVerticalIcon, GearIcon, WalletIcon } from './Icons';

interface ManageTeamProps {
  trip: Trip;
  currentUserId: string;
  onBack: () => void;
  onUpdateMemberRole: (memberId: string, newRole: Role) => void;
  onNavigateInvite: () => void;
  onSendExpenseInvite: (memberId: string) => void; // New Prop
}

const ManageTeam: React.FC<ManageTeamProps> = ({ trip, currentUserId, onBack, onUpdateMemberRole, onNavigateInvite, onSendExpenseInvite }) => {
  const currentUser = trip.members.find(m => m.id === currentUserId);
  const isPathfinder = currentUser?.role === 'PATHFINDER';

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'PATHFINDER':
        return <span className="bg-gray-600/50 text-white text-[9px] font-bold px-2 py-0.5 rounded border border-white/20 uppercase tracking-wider">PATHFINDER</span>;
      case 'SCOUT':
        return <span className="bg-gray-700/50 text-gray-300 text-[9px] font-bold px-2 py-0.5 rounded border border-white/10 uppercase tracking-wider">SCOUT</span>;
      case 'PASSENGER':
        return <span className="bg-gray-700/30 text-gray-400 text-[9px] font-bold px-2 py-0.5 rounded border border-white/5 uppercase tracking-wider">PASSENGER</span>;
    }
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'BLOCKED') {
      return <span className="bg-red-900/40 text-red-500 text-[9px] font-bold px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-wider">BLOCKED</span>;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-tactical-bg animate-fade-in">
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-20 border-b border-tactical-muted/10">
        <button onClick={onBack} className="text-gray-400 hover:text-white">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center">
            <span className="font-display font-bold text-lg text-white uppercase tracking-wider">Nomad Circle</span>
            <span className="text-[10px] text-gray-500 uppercase">{trip.name}</span>
        </div>
        <button className="text-white">
          <GearIcon className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 mb-2 mt-2">
            MEMBERS ({trip.members.length})
        </div>

        {trip.members.map(member => (
           <div key={member.id} className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-4 flex flex-col gap-4 group hover:border-tactical-muted/40 transition-colors">
               <div className="flex items-center gap-4">
                   <div className="relative">
                       <img 
                          src={member.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`} 
                          alt={member.name}
                          className={`w-12 h-12 rounded-full object-cover border-2 ${member.role === 'PATHFINDER' ? 'border-tactical-accent' : 'border-transparent'}`} 
                       />
                       {member.role === 'PATHFINDER' && (
                           <div className="absolute -bottom-1 -right-1 bg-tactical-accent text-black p-0.5 rounded-full border border-tactical-bg">
                               <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                           </div>
                       )}
                   </div>
                   
                   <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-0.5">
                           <h3 className="text-white font-bold truncate">{member.name}</h3>
                           {getRoleBadge(member.role)}
                       </div>
                       <div className="flex items-center gap-2">
                           <p className="text-gray-500 text-xs truncate">{member.email}</p>
                           {getStatusBadge(member.status)}
                       </div>
                   </div>

                   {isPathfinder && !member.isCurrentUser && (
                      <button 
                        onClick={() => {
                            const nextRole = member.role === 'SCOUT' ? 'PASSENGER' : 'SCOUT';
                            onUpdateMemberRole(member.id, nextRole);
                        }}
                        className="text-gray-500 hover:text-white p-2 rounded-full hover:bg-white/5"
                      >
                          <MoreVerticalIcon className="w-5 h-5" />
                      </button>
                   )}
               </div>

               {/* Pathfinder Action: Share Past Expenses */}
               {isPathfinder && !member.isCurrentUser && member.status !== 'BLOCKED' && (
                    <div className="border-t border-white/5 pt-2 flex justify-end">
                        <button 
                          onClick={() => onSendExpenseInvite(member.id)}
                          className={`text-[10px] font-bold uppercase flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
                              member.pendingPastExpensesInvitation 
                              ? 'text-yellow-500 cursor-default' 
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                          disabled={!!member.pendingPastExpensesInvitation}
                        >
                            <WalletIcon className="w-3 h-3" />
                            {member.pendingPastExpensesInvitation ? 'Invite Sent' : 'Share Past Expenses'}
                        </button>
                    </div>
               )}
           </div>
        ))}
      </div>

      <div className="p-6 sticky bottom-0 bg-tactical-bg border-t border-tactical-muted/10">
          <button 
            onClick={onNavigateInvite}
            className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-lg py-4 rounded-xl shadow-[0_0_15px_rgba(255,215,0,0.2)] flex items-center justify-center gap-2 transition-all"
          >
             <span className="text-xl">+</span> Invite Member
          </button>
      </div>
    </div>
  );
};

export default ManageTeam;