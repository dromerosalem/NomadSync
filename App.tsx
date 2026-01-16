import React, { useState, useMemo, useEffect } from 'react';
import { ViewState, Trip, ItineraryItem, ItemType, Member, Role } from './types';
import CreateMission from './components/CreateMission';
import Timeline from './components/Timeline';
import AddItem from './components/AddItem';
import ItemForm from './components/ItemForm';
import EditTrip from './components/EditTrip';
import ItemDetails from './components/ItemDetails';
import ManageTeam from './components/ManageTeam';
import InviteMember from './components/InviteMember';
import Dashboard from './components/Dashboard';
import NomadProfile from './components/NomadProfile';
import BudgetEngine from './components/BudgetEngine';
import LogExpense from './components/LogExpense';
import LedgerScreen from './components/LedgerScreen';
import AuthScreen from './components/AuthScreen';

const INITIAL_USER: Member = {
  id: '1',
  name: 'Ghost Operative',
  email: 'ghost@nomad.com',
  role: 'PATHFINDER', // Default role for creator
  avatarUrl: 'https://i.pravatar.cc/150?u=ghost',
  isCurrentUser: true,
  status: 'ACTIVE'
};

const INITIAL_TRIPS: Trip[] = [
  {
    id: '101',
    name: 'OPERATION: TOKYO DRIFT',
    destination: 'Shibuya District • Japan',
    startDate: new Date('2023-10-12'),
    endDate: new Date('2023-11-03'),
    budget: 5000,
    items: [],
    members: [
      { ...INITIAL_USER, budget: 5000 }, 
      { id: '2', name: 'Beatrix', email: 'b@v.com', role: 'SCOUT', budget: 4000, status: 'ACTIVE' }, 
      { id: '3', name: 'O-Ren', email: 'o@y.com', role: 'PASSENGER', budget: 10000, status: 'ACTIVE' }
    ],
    status: 'IN_PROGRESS',
    coverImage: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=2070&auto=format&fit=crop',
    budgetViewMode: 'SMART'
  },
  {
    id: '102',
    name: 'PROJECT: ANDALUSIA',
    destination: 'Seville • Spain',
    startDate: new Date('2023-12-15'),
    endDate: new Date('2024-01-10'),
    budget: 3500,
    items: [],
    members: [{ ...INITIAL_USER, budget: 3500 }],
    status: 'PLANNING',
    coverImage: 'https://images.unsplash.com/photo-1558642084-fd07fae5282e?q=80&w=1936&auto=format&fit=crop',
    budgetViewMode: 'SMART'
  },
  {
    id: '103',
    name: 'PROTOCOL: BALI',
    destination: 'Ubud • Indonesia',
    startDate: new Date('2023-02-01'),
    endDate: new Date('2023-03-01'),
    budget: 2000,
    items: [],
    members: [
      { ...INITIAL_USER, budget: 2000 }, 
      { id: '4', name: 'Bill', email: 'bill@v.com', role: 'PASSENGER', budget: 5000, status: 'ACTIVE' }
    ],
    status: 'COMPLETE',
    coverImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=1938&auto=format&fit=crop',
    budgetViewMode: 'SMART'
  }
];

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<Member>(INITIAL_USER);
  
  // View State logic
  const [view, setView] = useState<ViewState>('AUTH');
  
  const [trips, setTrips] = useState<Trip[]>(INITIAL_TRIPS);
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const currentTrip = useMemo(() => trips.find(t => t.id === currentTripId) || null, [trips, currentTripId]);

  // Selection State
  const [selectedItemType, setSelectedItemType] = useState<ItemType | null>(null);
  const [selectedItem, setSelectedItem] = useState<Partial<ItineraryItem> | null>(null);
  
  // Scanning Queue State
  const [scannedItemsQueue, setScannedItemsQueue] = useState<Partial<ItineraryItem>[]>([]);

  // Permission Checks
  const currentUserRole = useMemo(() => {
     if (!currentTrip) return currentUser.role;
     const userInTrip = currentTrip.members.find(m => m.id === currentUser.id);
     return userInTrip ? userInTrip.role : 'PASSENGER'; // Default to Passenger if not found
  }, [currentTrip, currentUser.id]); // Fixed dependency

  const canEdit = currentUserRole === 'PATHFINDER' || currentUserRole === 'SCOUT';

  // Auth Handler
  const handleAuthSuccess = (userData: { name: string, email: string }) => {
      const updatedUser: Member = {
          ...INITIAL_USER,
          name: userData.name,
          email: userData.email,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=random`
      };
      
      setCurrentUser(updatedUser);
      setIsAuthenticated(true);
      
      // Update trips to reflect new user name (in a real app this is backend work)
      const updatedTrips = trips.map(trip => ({
          ...trip,
          members: trip.members.map(m => m.id === '1' ? { ...m, ...updatedUser } : m)
      }));
      setTrips(updatedTrips);

      setView('DASHBOARD');
  };

  // Helper: Semantic Sort Logic
  const semanticSort = (items: ItineraryItem[]): ItineraryItem[] => {
    return [...items].sort((a, b) => {
        const dateA = new Date(a.startDate);
        const dateB = new Date(b.startDate);

        // 1. Sort by Date first (ignoring time)
        const dayDiff = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime() - 
                        new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();
        
        if (dayDiff !== 0) return dayDiff;

        // 2. Same Day? Apply Semantic Weight
        const getWeight = (type: ItemType) => {
            if (type === ItemType.TRANSPORT) return 1;
            if (type === ItemType.STAY) return 2;
            if (type === ItemType.FOOD || type === ItemType.ACTIVITY) return 3;
            if (type === ItemType.ESSENTIALS) return 4;
            return 4;
        };

        const weightA = getWeight(a.type);
        const weightB = getWeight(b.type);

        if (weightA !== weightB) return weightA - weightB;

        // 3. Same Type? Sort by Time
        return dateA.getTime() - dateB.getTime();
    });
  };

  const handleCreateTrip = (name: string, location: string, budget: number, startDate: Date, endDate: Date, initialMembers: Member[]) => {
    // Ensure Current User is the PATHFINDER and attach their personal budget
    const creatorMember = { ...currentUser, budget: budget };
    const members = [creatorMember, ...initialMembers];

    const newTrip: Trip = {
      id: Date.now().toString(),
      name,
      destination: location,
      startDate: startDate,
      endDate: endDate,
      budget, // Keep as reference
      items: [],
      members: members,
      status: 'PLANNING',
      budgetViewMode: 'SMART' // Default to Smart Mode
    };

    setTrips([newTrip, ...trips]);
    setCurrentTripId(newTrip.id);
    // Redirect immediately to Add Item screen
    setView('ADD_ITEM');
  };

  const handleUpdateTrip = (updatedTrip: Trip) => {
    setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
    setView('TIMELINE');
  };

  const handleUpdateMemberRole = (memberId: string, newRole: Role) => {
    if (!currentTrip) return;
    
    // Only PATHFINDER can change roles
    if (currentUserRole !== 'PATHFINDER') return;

    const updatedMembers = currentTrip.members.map(m => 
      m.id === memberId ? { ...m, role: newRole } : m
    );

    const updatedTrip = { ...currentTrip, members: updatedMembers };
    setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleInviteMember = (email: string, role: Role) => {
      if (!currentTrip) return;
      const newMember: Member = {
          id: Date.now().toString(),
          name: email.split('@')[0], // Mock name from email
          email: email,
          role: role,
          status: 'PENDING',
          budget: 0 // Default budget for new invitees
      };
      
      const updatedTrip = {
          ...currentTrip,
          members: [...currentTrip.members, newMember]
      };
      setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  // --- Expense Sharing Logic ---
  
  const handleSendExpenseInvite = (memberId: string) => {
      if (!currentTrip) return;
      // Mark member as pending invitation
      const updatedMembers = currentTrip.members.map(m => 
          m.id === memberId ? { ...m, pendingPastExpensesInvitation: true } : m
      );
      const updatedTrip = { ...currentTrip, members: updatedMembers };
      setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleAcceptExpenseInvite = () => {
      if (!currentTrip) return;
      
      const updatedItems = currentTrip.items.map(item => {
          if (item.isPrivate && item.createdBy !== currentUser.id) return item; 
          
          if (!item.splitWith.includes(currentUser.id)) {
              return { ...item, splitWith: [...item.splitWith, currentUser.id] };
          }
          return item;
      });

      const updatedMembers = currentTrip.members.map(m => 
        m.id === currentUser.id ? { ...m, pendingPastExpensesInvitation: false } : m
      );

      const updatedTrip = { ...currentTrip, items: updatedItems, members: updatedMembers };
      setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleDeclineExpenseInvite = () => {
     if (!currentTrip) return;
      const updatedMembers = currentTrip.members.map(m => 
        m.id === currentUser.id ? { ...m, pendingPastExpensesInvitation: false } : m
      );
      const updatedTrip = { ...currentTrip, members: updatedMembers };
      setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleToggleBudgetMode = (mode: 'SMART' | 'DIRECT') => {
      if (!currentTrip) return;
      const updatedTrip = { ...currentTrip, budgetViewMode: mode };
      setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };
  
  const handleSettleDebt = (fromUserId: string, toUserId: string, amount: number) => {
      if (!currentTrip) return;
      
      const newItem: ItineraryItem = {
          id: Date.now().toString(),
          type: ItemType.SETTLEMENT,
          title: 'Debt Settlement',
          location: 'Direct Transfer',
          startDate: new Date(),
          cost: amount,
          createdBy: currentUser.id,
          paidBy: fromUserId, // Sender
          splitWith: [toUserId], // Receiver
          details: `Settlement transfer from ${fromUserId} to ${toUserId}`,
          isPrivate: false,
          showInTimeline: false // Settlements typically don't clutter the main itinerary timeline
      };
      
      const updatedItems = [...currentTrip.items, newItem];
      const sorted = semanticSort(updatedItems);
      const updatedTrip = { ...currentTrip, items: sorted };
      setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  // ---------------------------------------------------------

  const handleSelectType = (type: ItemType) => {
    setSelectedItemType(type);
    setSelectedItem(null); 
    setScannedItemsQueue([]); 
    setView('ITEM_FORM');
  };

  const handleScannedItem = (items: Partial<ItineraryItem>[]) => {
    if (items.length === 0) return;
    setScannedItemsQueue(items);
    const firstItem = items[0];
    setSelectedItemType(firstItem.type || ItemType.ACTIVITY);
    setSelectedItem(firstItem);
    setView('ITEM_FORM');
  };

  const handleItemClick = (item: ItineraryItem) => {
    setSelectedItem(item);
    setView('ITEM_DETAILS');
  };

  const handleEditExpense = (item: ItineraryItem) => {
      setSelectedItem(item);
      setView('LOG_EXPENSE');
  };

  const handleEditItem = () => {
    if (selectedItem && selectedItem.type) {
      setSelectedItemType(selectedItem.type);
      setScannedItemsQueue([]); 
      setView('ITEM_FORM');
    }
  };

  const handleDeleteItem = (itemId?: string) => {
    const idToDelete = itemId || selectedItem?.id;
    
    if (currentTrip && idToDelete) {
       const updatedItems = currentTrip.items.filter(i => i.id !== idToDelete);
       const updatedTrip = {
         ...currentTrip,
         items: updatedItems
       };
       setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
       setSelectedItem(null);
       
       // Route back based on previous context ideally, but defaulting to appropriate screens
       if (view === 'LOG_EXPENSE') setView('BUDGET');
       else setView('TIMELINE');
    }
  };

  const handleSaveItem = (itemData: Partial<ItineraryItem>) => {
    if (!currentTrip) return;
    if (!canEdit) return;

    let updatedItems = [...currentTrip.items];

    if (itemData.id) {
       updatedItems = updatedItems.map(item => 
          item.id === itemData.id ? {
            ...item,
            title: itemData.title || item.title,
            location: itemData.location || item.location,
            endLocation: itemData.endLocation !== undefined ? itemData.endLocation : item.endLocation,
            startDate: itemData.startDate || item.startDate,
            endDate: 'endDate' in itemData ? itemData.endDate : item.endDate, // Preserve unless explicitly passed (even as undefined)
            cost: itemData.cost !== undefined ? itemData.cost : item.cost,
            details: itemData.details,
            tags: itemData.tags !== undefined ? itemData.tags : item.tags,
            durationMinutes: itemData.durationMinutes !== undefined ? itemData.durationMinutes : item.durationMinutes,
            mapUri: item.mapUri,
            isPrivate: itemData.isPrivate !== undefined ? itemData.isPrivate : item.isPrivate,
            splitWith: itemData.splitWith || item.splitWith || [],
            splitDetails: itemData.splitDetails || item.splitDetails, // Preserve or update custom split
            paidBy: itemData.paidBy || item.paidBy || currentUser.id,
            type: itemData.type || item.type,
            showInTimeline: itemData.showInTimeline !== undefined ? itemData.showInTimeline : item.showInTimeline
          } : item
       );
       finishSave(updatedItems);
    } else {
       const defaultSplitWith = currentTrip.members
          .filter(m => m.status === 'ACTIVE' || !m.status)
          .map(m => m.id);

       const newItem: ItineraryItem = {
          id: Date.now().toString(),
          type: itemData.type || selectedItemType || ItemType.ACTIVITY,
          title: itemData.title || 'Untitled',
          location: itemData.location || currentTrip.destination,
          endLocation: itemData.endLocation,
          startDate: itemData.startDate || new Date(),
          endDate: itemData.endDate,
          cost: itemData.cost || 0,
          details: itemData.details,
          tags: itemData.tags || [],
          durationMinutes: itemData.durationMinutes,
          createdBy: currentUser.id, 
          isPrivate: itemData.isPrivate || false,
          splitWith: itemData.splitWith || defaultSplitWith,
          splitDetails: itemData.splitDetails, // Apply custom split if provided
          paidBy: itemData.paidBy || currentUser.id,
          showInTimeline: itemData.showInTimeline !== undefined ? itemData.showInTimeline : true // Default to true if not specified (Standard items)
        };
        updatedItems.push(newItem);

        if (scannedItemsQueue.length > 1) {
            const nextQueue = scannedItemsQueue.slice(1);
            const nextItem = nextQueue[0];
            const sorted = semanticSort(updatedItems);
            const updatedTrip = { ...currentTrip, items: sorted };
            setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
            
            setScannedItemsQueue(nextQueue);
            setSelectedItemType(nextItem.type || ItemType.ACTIVITY);
            setSelectedItem(nextItem);
        } else {
            setScannedItemsQueue([]);
            finishSave(updatedItems);
        }
    }
  };
  
  const finishSave = (updatedItems: ItineraryItem[]) => {
    if (!currentTrip) return;
    const sorted = semanticSort(updatedItems);
    const updatedTrip = { ...currentTrip, items: sorted };
    setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
    
    setSelectedItemType(null);
    setSelectedItem(null);
    if (view === 'LOG_EXPENSE') setView('BUDGET');
    else setView('TIMELINE');
  }

  const availableTags = useMemo(() => {
    if (!currentTrip) return [];
    const tags = new Set<string>();
    currentTrip.items.forEach(item => {
      item.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [currentTrip]);

  return (
    <div className="h-[100dvh] bg-tactical-bg text-white font-sans max-w-md mx-auto relative shadow-2xl flex flex-col overflow-hidden border-x border-tactical-muted/20">
       <main className="flex-1 relative overflow-hidden flex flex-col w-full">
         
         {!isAuthenticated && view === 'AUTH' && (
             <AuthScreen onAuthSuccess={handleAuthSuccess} />
         )}
         
         {isAuthenticated && view === 'DASHBOARD' && (
             <Dashboard 
                trips={trips}
                onSelectTrip={(trip) => {
                    setCurrentTripId(trip.id);
                    setView('TIMELINE');
                }}
                onCreateTrip={() => setView('CREATE')}
                onNavigateProfile={() => setView('PROFILE')}
             />
         )}

         {isAuthenticated && view === 'PROFILE' && (
             <NomadProfile 
                user={currentUser}
                trips={trips}
                onBack={() => setView('DASHBOARD')}
                onCreateMission={() => setView('CREATE')}
             />
         )}

         {isAuthenticated && view === 'BUDGET' && currentTrip && (
            <BudgetEngine 
               trip={currentTrip}
               currentUserId={currentUser.id}
               currentUserRole={currentUserRole}
               onBack={() => setView('TIMELINE')}
               onLogExpense={() => {
                   setSelectedItem(null); // Clear any selection
                   setView('LOG_EXPENSE');
               }}
               onViewLedger={() => setView('LEDGER')}
               onItemClick={handleEditExpense}
               onToggleBudgetMode={handleToggleBudgetMode}
               onSettleDebt={handleSettleDebt}
            />
         )}

         {isAuthenticated && view === 'LEDGER' && currentTrip && (
            <LedgerScreen 
               trip={currentTrip}
               currentUserId={currentUser.id}
               onBack={() => setView('BUDGET')}
               onItemClick={handleEditExpense}
            />
         )}
         
         {isAuthenticated && view === 'LOG_EXPENSE' && currentTrip && (
            <LogExpense 
                onClose={() => setView('BUDGET')}
                onSave={handleSaveItem}
                onDelete={handleDeleteItem}
                tripStartDate={currentTrip.startDate}
                currentUserId={currentUser.id}
                members={currentTrip.members}
                initialItem={selectedItem as ItineraryItem}
            />
         )}

         {isAuthenticated && view === 'CREATE' && (
           <CreateMission 
              onCreate={handleCreateTrip} 
              onBack={() => setView('DASHBOARD')}
              isLoading={isLoading} 
           />
         )}

         {isAuthenticated && view === 'TIMELINE' && currentTrip && (
           <Timeline 
             trip={currentTrip} 
             availableTags={availableTags}
             canEdit={canEdit}
             currentUserId={currentUser.id}
             onAddItem={() => setView('ADD_ITEM')}
             onEditTrip={() => setView('EDIT_TRIP')}
             onManageTeam={() => setView('MANAGE_TEAM')}
             onItemClick={handleItemClick}
             onBackToBase={() => {
                 setCurrentTripId(null);
                 setView('DASHBOARD');
             }}
             onNavigateBudget={() => setView('BUDGET')}
             onAcceptPastExpenses={handleAcceptExpenseInvite}
             onDeclinePastExpenses={handleDeclineExpenseInvite}
           />
         )}

         {isAuthenticated && view === 'MANAGE_TEAM' && currentTrip && (
            <ManageTeam 
                trip={currentTrip}
                currentUserId={currentUser.id}
                onBack={() => setView('TIMELINE')}
                onUpdateMemberRole={handleUpdateMemberRole}
                onNavigateInvite={() => setView('INVITE_MEMBER')}
                onSendExpenseInvite={handleSendExpenseInvite}
            />
         )}
         
         {isAuthenticated && view === 'INVITE_MEMBER' && currentTrip && (
            <InviteMember 
                trip={currentTrip}
                onBack={() => setView('MANAGE_TEAM')}
                onInvite={handleInviteMember}
            />
         )}

         {isAuthenticated && view === 'ADD_ITEM' && (
           <AddItem 
             onClose={() => setView('TIMELINE')} 
             onSelectType={handleSelectType}
             onScannedItem={handleScannedItem}
             tripStartDate={currentTrip?.startDate}
           />
         )}

         {isAuthenticated && view === 'ITEM_FORM' && selectedItemType && currentTrip && (
           <ItemForm 
              type={selectedItemType}
              tripStartDate={currentTrip.startDate}
              onClose={() => {
                setScannedItemsQueue([]);
                if (selectedItem && selectedItem.id) setView('ITEM_DETAILS');
                else setView('TIMELINE');
              }}
              onSave={handleSaveItem}
              initialItem={selectedItem || undefined}
              availableTags={availableTags}
              queueLength={scannedItemsQueue.length > 0 ? scannedItemsQueue.length : undefined}
              currentUserId={currentUser.id}
              members={currentTrip.members} 
           />
         )}

         {isAuthenticated && view === 'ITEM_DETAILS' && selectedItem && selectedItem.id && currentTrip && (
           <ItemDetails 
             item={selectedItem as ItineraryItem}
             members={currentTrip.members} 
             onClose={() => setView('TIMELINE')}
             canEdit={canEdit}
             onEdit={handleEditItem}
             onDelete={() => handleDeleteItem()}
             currentUserId={currentUser.id}
           />
         )}

         {isAuthenticated && view === 'EDIT_TRIP' && currentTrip && (
           <EditTrip 
             trip={currentTrip}
             onUpdate={handleUpdateTrip}
             onCancel={() => setView('TIMELINE')}
             currentUserId={currentUser.id}
           />
         )}
       </main>
    </div>
  );
};

export default App;