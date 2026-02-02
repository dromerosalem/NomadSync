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
import JoinMission from './components/JoinMission';
import GlobalLedger from './components/GlobalLedger';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import Onboarding from './components/Onboarding';
import VerificationBridge from './components/VerificationBridge';
import { supabase } from './services/supabaseClient';
import { tripService } from './services/tripService';
import { userService } from './services/userService';
import AuthGlobe from './components/AuthGlobe';
import ConflictResolver from './components/ConflictResolver';
import { SyncLog, db } from './db/LocalDatabase';
import { persistenceService } from './services/persistenceService';

const INITIAL_USER: Member = {
  id: 'placeholder',
  name: 'Ghost Operative',
  email: 'ghost@nomad.com',
  role: 'PATHFINDER',
  avatarUrl: null, // Sanitized in UI
  isCurrentUser: true,
  status: 'ACTIVE'
};

const calculateTripStatus = (start: Date, end: Date): 'PLANNING' | 'IN_PROGRESS' | 'COMPLETE' => {
  const now = new Date();
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (now < startDate) return 'PLANNING';
  if (now > endDate) return 'COMPLETE';
  return 'IN_PROGRESS';
};

const getRelativeDate = (daysOffset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d;
};

const INITIAL_TRIPS: Trip[] = [];

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<Member>(INITIAL_USER);
  const [view, setView] = useState<ViewState>('AUTH');
  const [pendingJoinTripId, setPendingJoinTripId] = useState<string | null>(null);
  const [activeConflict, setActiveConflict] = useState<SyncLog | null>(null);

  // Sync URL with Privacy/Terms Views (For Google Compliance)
  useEffect(() => {
    const path = window.location.pathname;
    if (view === 'PRIVACY') {
      if (path !== '/privacy') window.history.pushState({}, '', '/privacy');
    } else if (view === 'TERMS') {
      if (path !== '/terms') window.history.pushState({}, '', '/terms');
    } else if (path === '/privacy' || path === '/terms') {
      // If we are in any other view but the URL is still /privacy or /terms, reset it
      // unless we are in Auth/Dashboard/Profile where the state transition handles it
      window.history.pushState({}, '', '/');
    }
  }, [view]);

  // Check for conflicts on mount and periodic
  const checkConflicts = async () => {
    const conflict = await db.sync_queue
      .where('status')
      .equals('CONFLICT')
      .first();
    if (conflict) {
      setActiveConflict(conflict);
    } else {
      setActiveConflict(null);
    }
  };

  const [trips, setTrips] = useState<Trip[]>(() => {
    return INITIAL_TRIPS.map(t => ({
      ...t,
      status: calculateTripStatus(t.startDate, t.endDate)
    }));
  });

  useEffect(() => {
    // Check for Deep Link (Join Mission)
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');

    if (joinCode) {
      if (joinCode.length > 30) {
        // Legacy UUID link
        console.log("Deep Link Detected: Joining Trip (UUID)", joinCode);
        setPendingJoinTripId(joinCode);
      } else {
        // Short Code - Resolve it
        console.log("Deep Link Detected: Resolving Short Code", joinCode);
        tripService.resolveInviteCode(joinCode).then(resolvedId => {
          if (resolvedId) {
            setPendingJoinTripId(resolvedId);
          } else {
            console.error("Invalid or expired invite code");
          }
        });
      }
    }

    // Handle Pathname Routing (Privacy / Terms / Verified)
    const pathname = window.location.pathname;
    if (pathname === '/privacy') {
      setView('PRIVACY');
    } else if (pathname === '/terms') {
      setView('TERMS');
    } else if (pathname === '/verified') {
      setView('VERIFIED' as ViewState);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state change:', _event, session?.user?.id);
      if (session) {
        setIsAuthenticated(true);
        // Request persistence on login/state change
        persistenceService.requestPersistence().then(granted => {
          if (granted) console.log('Storage persistence verified on auth change.');
        });

        const user = session.user;
        const mappedUser: Member = {
          id: user.id,
          name: user.user_metadata.full_name || user.email?.split('@')[0] || 'Ghost Operative',
          email: user.email!,
          role: 'PATHFINDER',
          avatarUrl: user.user_metadata.avatar_url || null,
          isCurrentUser: true,
          status: 'ACTIVE'
        };
        setCurrentUser(mappedUser);

        // Request Notifications
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }

        // Check Onboarding Status
        userService.fetchProfile(user.id).then(profile => {
          // Priority Check: Verification Bridge
          if (window.location.pathname === '/verified') {
            setView('VERIFIED' as ViewState);
            return;
          }

          if (profile.onboardingCompleted) {
            const params = new URLSearchParams(window.location.search);
            const openView = params.get('open');
            const joinCode = params.get('join');

            if (openView === 'dashboard') {
              window.history.replaceState({}, '', '/');
              setView('DASHBOARD');
            } else if (joinCode) {
              if (joinCode.length > 30) {
                setPendingJoinTripId(joinCode);
                setView('JOIN_MISSION');
              } else {
                tripService.resolveInviteCode(joinCode).then(resolvedId => {
                  if (resolvedId) {
                    setPendingJoinTripId(resolvedId);
                    setView('JOIN_MISSION');
                  } else {
                    setView(prev => prev === 'AUTH' ? 'DASHBOARD' : prev);
                  }
                });
              }
            } else {
              setView(prev => prev === 'AUTH' ? 'DASHBOARD' : prev);
            }
          } else {
            setView('ONBOARDING');
          }

          if (profile.onboardingCompleted !== undefined) {
            setCurrentUser(prev => ({ ...prev, onboardingCompleted: profile.onboardingCompleted }));
          }
        });
      } else {
        handleSignOutCleanup();
      }
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        // Request persistence immediately on session restore
        persistenceService.requestPersistence().then(granted => {
          if (granted) console.log('Storage persistence verified on restore.');
        });

        const user = session.user;
        const mappedUser: Member = {
          id: user.id,
          name: user.user_metadata.full_name || user.email?.split('@')[0] || 'Ghost Operative',
          email: user.email!,
          role: 'PATHFINDER',
          avatarUrl: user.user_metadata.avatar_url || null,
          isCurrentUser: true,
          status: 'ACTIVE'
        };
        setCurrentUser(mappedUser);

        // Check Onboarding
        userService.fetchProfile(user.id).then(profile => {
          // Priority Check: Verification Bridge
          if (window.location.pathname === '/verified') {
            setView('VERIFIED' as ViewState);
            return;
          }

          if (profile.onboardingCompleted) {
            const params = new URLSearchParams(window.location.search);
            const openView = params.get('open');
            const joinCode = params.get('join');

            if (openView === 'dashboard') {
              window.history.replaceState({}, '', '/');
              setView('DASHBOARD');
            } else if (joinCode) {
              if (joinCode.length > 30) {
                // UUID - Use directly
                setPendingJoinTripId(joinCode);
                setView('JOIN_MISSION');
              } else {
                // Short Code - Resolve then set
                tripService.resolveInviteCode(joinCode).then(resolvedId => {
                  if (resolvedId) {
                    setPendingJoinTripId(resolvedId);
                    setView('JOIN_MISSION');
                  } else {
                    // Failed to resolve or invalid
                    setView(prev => prev === 'AUTH' ? 'DASHBOARD' : prev);
                  }
                });
              }
            } else {
              setView(prev => prev === 'AUTH' ? 'DASHBOARD' : prev);
            }
          } else {
            setView('ONBOARDING');
          }
          if (profile.onboardingCompleted !== undefined) {
            setCurrentUser(prev => ({ ...prev, onboardingCompleted: profile.onboardingCompleted }));
          }
        });
      }
    });

    // --- Service Worker & Sync Registration ---
    let handleMessage: (event: MessageEvent) => void;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('[App] ServiceWorker registered');
      }).catch(err => {
        console.error('[App] ServiceWorker registration failed', err);
      });

      handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'SYNC_REQUESTED' || event.data.type === 'CONFLICT_DETECTED') {
          import('./services/SyncService').then(({ syncService }) => syncService.processQueue());
          checkConflicts();
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    const handleOnline = () => {
      console.log('[App] Network back online, triggering sync...');
      import('./services/SyncService').then(({ syncService }) => syncService.processQueue());
      checkConflicts();
    };
    window.addEventListener('online', handleOnline);

    checkConflicts();

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      if ('serviceWorker' in navigator && handleMessage) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  if ((!isAuthenticated && view === 'AUTH') || !currentUser) {
    // Show Loading/Globe if strictly loading, otherwise Auth screen handles it
    if (!isAuthenticated && view !== 'AUTH') {
      return (
        <div className="h-[100dvh] w-full bg-tactical-bg flex items-center justify-center">
          <div className="animate-spin-slow">
            <AuthGlobe />
          </div>
          <p className="absolute mt-32 text-xs font-mono text-tactical-accent animate-pulse">ESTABLISHING UPLINK...</p>
        </div>
      );
    }
  }

  // --- LATE RESOLUTION HANDLER ---
  useEffect(() => {
    if (isAuthenticated && pendingJoinTripId && currentUser.onboardingCompleted) {
      // Check if already a member
      const isMember = trips.some(t => t.id === pendingJoinTripId);
      if (isMember) {
        console.log("Already a member of pending trip, clearing state.");
        setPendingJoinTripId(null);
        // If view is JOIN_MISSION, go to dashboard?
        if (view === 'JOIN_MISSION') setView('DASHBOARD');
      } else if (view === 'DASHBOARD') {
        console.log("Late resolution of invite code, redirecting...");
        setView('JOIN_MISSION');
      }
    }
  }, [isAuthenticated, pendingJoinTripId, currentUser.onboardingCompleted, view, trips]);

  // Remove pendingJoinTripId dependency to avoid double firing

  // --- GLOBAL REAL-TIME SYNC ---
  useEffect(() => {
    if (!isAuthenticated || currentUser.id === 'placeholder') return;

    console.log('[App] Initializing Global Realtime Subscription');

    const channel = supabase.channel('global-user-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_members',
          filter: `user_id=eq.${currentUser.id}`
        },
        (payload) => {
          console.log('[App] Trip Member Invocation:', payload);
          // If I am added to/removed from a trip, reload my trip list
          loadAllData(currentUser.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // UPDATE (name change) or INSERT (new trip I created)
          schema: 'public',
          table: 'trips'
        },
        (payload) => {
          // Optimization: Ideally we check if I am in this trip, 
          // but RLS might not let us filtering easily without joining.
          // For now, if any mapped trip updates, we refresh.
          const tripId = (payload.new as any).id;
          const isRelevant = trips.some(t => t.id === tripId);
          if (isRelevant || payload.eventType === 'INSERT') {
            console.log('[App] Trip Update Detected:', payload);
            loadAllData(currentUser.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, currentUser.id, trips]); // Dependency on trips might cause re-sub, but needed for filter check.

  // --- GLOBAL ITINERARY ITEMS SYNC (Persists to IndexedDB) ---
  useEffect(() => {
    if (!isAuthenticated || currentUser.id === 'placeholder' || trips.length === 0) return;

    // Get all trip IDs the user is a member of
    const tripIds = trips.map(t => t.id);
    console.log('[App] Initializing Itinerary Realtime for trips:', tripIds.length);

    const channel = supabase.channel('global-itinerary-sync')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'itinerary_items'
        },
        async (payload) => {
          const newItem = payload.new as any;
          if (tripIds.includes(newItem.trip_id)) {
            console.log('[App] New itinerary item detected:', newItem.id);
            // Fetch full item with splits and cache it
            const item = await tripService.fetchSingleItem(newItem.id);
            if (item) {
              // Update React state for the relevant trip
              setTrips(prevTrips => prevTrips.map(t => {
                if (t.id === item.tripId) {
                  const exists = t.items.some(i => i.id === item.id);
                  if (!exists) {
                    return { ...t, items: [...t.items, item] };
                  }
                }
                return t;
              }));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'itinerary_items'
        },
        async (payload) => {
          const updatedItem = payload.new as any;
          if (tripIds.includes(updatedItem.trip_id)) {
            console.log('[App] Updated itinerary item detected:', updatedItem.id);
            const item = await tripService.fetchSingleItem(updatedItem.id);
            if (item) {
              setTrips(prevTrips => prevTrips.map(t => {
                if (t.id === item.tripId) {
                  return { ...t, items: t.items.map(i => i.id === item.id ? item : i) };
                }
                return t;
              }));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'itinerary_items'
        },
        async (payload) => {
          const deletedItem = payload.old as any;
          console.log('[App] Deleted itinerary item detected:', deletedItem.id);
          // Remove from IndexedDB
          await tripService.deleteItemFromCache(deletedItem.id);
          // Remove from React state
          setTrips(prevTrips => prevTrips.map(t => ({
            ...t,
            items: t.items.filter(i => i.id !== deletedItem.id)
          })));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, currentUser.id, trips.length]); // Use trips.length to avoid re-sub on every item change
  // -----------------------------


  // Dedicated data loader - triggers only when identity actually changes
  useEffect(() => {
    if (isAuthenticated && currentUser.id !== 'placeholder') {
      console.log('Loading data for verified user:', currentUser.id);
      loadAllData(currentUser.id);
    }
  }, [isAuthenticated, currentUser.id]);

  const loadAllData = async (userId: string) => {
    setIsLoading(true);
    try {
      // Stage 1: Fetch Trip Headers (Fast)
      const userTrips = await tripService.fetchUserTrips(userId);
      console.log('Staged Loading: Fetched trip headers:', userTrips.length);

      // Show missions immediately even if they don't have items yet
      setTrips(userTrips);
      setIsLoading(false); // <--- Flip to false here for Stage 1 visibility

      // Stage 2: Fetch Itineraries in Background (Slower, concurrent)
      Promise.all(userTrips.map(async (trip) => {
        try {
          const items = await tripService.fetchTripItinerary(trip.id);
          const sorted = semanticSort(items);

          setTrips(prev => prev.map(t =>
            t.id === trip.id ? { ...t, items: sorted } : t
          ));
        } catch (itemErr) {
          console.error(`Failed to load itinerary for trip ${trip.id}:`, itemErr);
        }
      })).then(() => {
        console.log('Staged Loading: Background sync complete.');
      });

    } catch (err) {
      console.error('Error loading data:', err);
      // If an error occurs during initial trip loading, ensure loading state is reset
      setIsLoading(false);
    }
  };

  const handleSignOutCleanup = () => {
    setIsAuthenticated(false);
    setCurrentUser(INITIAL_USER);
    setTrips([]);
    setCurrentTripId(null);
    setView('AUTH');
  };

  const handleOnboardingComplete = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      await userService.updateProfile(currentUser.id, { onboardingCompleted: true });
      setCurrentUser(prev => ({ ...prev, onboardingCompleted: true }));

      // Explicit Session Refresh and Hard Navigation for Android Stability
      await supabase.auth.refreshSession();
      window.location.assign('/?open=dashboard');
      // The original logic for pendingJoinTripId and setView is now superseded by the hard navigation.
      // If the hard navigation fails or is not desired in some contexts,
      // the previous logic could be re-evaluated.
      // For now, assuming hard navigation is the desired outcome.
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      // Fallback: move to dashboard anyway so user isn't stuck
      setView('DASHBOARD');
    }
  };

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
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleAuthSuccess = () => {
    // Rely on onAuthStateChange to set user state and isAuthenticated
    // Just ensure we move to the dashboard if we aren't already there
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
        if (type === ItemType.SETTLEMENT) return 5; // Put settlements at the end of the day
        return 4;
      };

      const weightA = getWeight(a.type);
      const weightB = getWeight(b.type);

      if (weightA !== weightB) return weightA - weightB;

      // 3. Same Type? Sort by Time
      return dateA.getTime() - dateB.getTime();
    });
  };

  const handleCreateTrip = async (name: string, location: string, budget: number, startDate: Date, endDate: Date, initialMembers: Member[], baseCurrency: string, metadata?: { lat: number, lon: number, countryCode: string }) => {
    setIsLoading(true);
    try {
      const creatorMember = { ...currentUser, budget: budget };
      const members = [creatorMember, ...initialMembers];

      const newTripData: Omit<Trip, 'id' | 'items'> = {
        name,
        destination: location,
        latitude: metadata?.lat,
        longitude: metadata?.lon,
        countryCode: metadata?.countryCode,
        startDate,
        endDate,
        budget,
        baseCurrency,
        members,
        status: calculateTripStatus(startDate, endDate),
        budgetViewMode: 'SMART',
        coverImage: null
      };

      const createdTrip = await tripService.createTrip(newTripData, currentUser.id);
      setTrips([createdTrip, ...trips]);
      setCurrentTripId(createdTrip.id);
      setView('ADD_ITEM');
    } catch (err) {
      console.error('Failed to create trip:', err);
      alert('Mission initiation failed. Check connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTrip = async (updatedTrip: Trip) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      // 1. Persist Trip Level Changes
      await tripService.updateTrip(updatedTrip.id, {
        name: updatedTrip.name,
        destination: updatedTrip.destination,
        latitude: updatedTrip.latitude,
        longitude: updatedTrip.longitude,
        countryCode: updatedTrip.countryCode,
        startDate: updatedTrip.startDate,
        endDate: updatedTrip.endDate,
        baseCurrency: updatedTrip.baseCurrency,
        status: calculateTripStatus(updatedTrip.startDate, updatedTrip.endDate)
      });

      // 2. Persist Personal Budget Change (if current user's budget changed)
      const oldTrip = trips.find(t => t.id === updatedTrip.id);
      const oldMember = oldTrip?.members.find(m => m.id === currentUser.id);
      const newMember = updatedTrip.members.find(m => m.id === currentUser.id);

      if (newMember && oldMember && newMember.budget !== oldMember.budget) {
        await tripService.updateMemberBudget(updatedTrip.id, currentUser.id, newMember.budget);
      }

      // 3. Update Local State
      const finalTrip = {
        ...updatedTrip,
        status: calculateTripStatus(updatedTrip.startDate, updatedTrip.endDate),
        updatedAt: Date.now()
      };
      setTrips(trips.map(t => t.id === finalTrip.id ? finalTrip : t));
      setView('TIMELINE');
    } catch (err) {
      console.error('Failed to update trip:', err);
      alert('Mission update failed. Check connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateMemberRole = (memberId: string, newRole: Role) => {
    if (!currentTrip) return;

    // Only PATHFINDER can change roles
    if (currentUserRole !== 'PATHFINDER') return;

    const updatedMembers = currentTrip.members.map(m =>
      m.id === memberId ? { ...m, role: newRole } : m
    );

    const updatedTrip = { ...currentTrip, members: updatedMembers, updatedAt: Date.now() };
    setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleInviteMember = async (userId: string, role: Role) => {
    if (!currentTrip) return;
    setIsLoading(true);
    try {
      await tripService.addMemberToTrip(currentTrip.id, userId, role);

      // Refresh to see the new member
      const userTrips = await tripService.fetchUserTrips(currentUser.id);
      const updatedTrip = userTrips.find(t => t.id === currentTrip.id);

      if (updatedTrip) {
        // Restore items which aren't in the shallow fetch
        updatedTrip.items = currentTrip.items;
        setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
      }
    } catch (err) {
      console.error('Invite failed:', err);
      alert('Recruitment failed. Operative may already be deployed.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Expense Sharing Logic ---

  const handleSendExpenseInvite = (memberId: string) => {
    if (!currentTrip) return;
    // Mark member as pending invitation
    const updatedMembers = currentTrip.members.map(m =>
      m.id === memberId ? { ...m, pendingPastExpensesInvitation: true } : m
    );
    const updatedTrip = { ...currentTrip, members: updatedMembers, updatedAt: Date.now() };
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

    const updatedTrip = { ...currentTrip, items: updatedItems, members: updatedMembers, updatedAt: Date.now() };
    setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleDeclineExpenseInvite = () => {
    if (!currentTrip) return;
    const updatedMembers = currentTrip.members.map(m =>
      m.id === currentUser.id ? { ...m, pendingPastExpensesInvitation: false } : m
    );
    const updatedTrip = { ...currentTrip, members: updatedMembers, updatedAt: Date.now() };
    setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleToggleBudgetMode = (mode: 'SMART' | 'DIRECT') => {
    if (!currentTrip) return;
    const updatedTrip = { ...currentTrip, budgetViewMode: mode, updatedAt: Date.now() };
    setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleSettleDebt = async (fromUserId: string, toUserId: string, amount: number) => {
    if (!currentTrip) return;

    setIsLoading(true);
    try {
      const newItem: ItineraryItem = {
        id: '', // Empty ID tells service to create new record
        tripId: currentTrip.id,
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

      const savedItem = await tripService.saveItineraryItem(newItem);

      const updatedItems = [...currentTrip.items, savedItem];
      const sorted = semanticSort(updatedItems);
      const updatedTrip = { ...currentTrip, items: sorted, updatedAt: Date.now() };
      setTrips(prevTrips => prevTrips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
    } catch (err) {
      console.error('Settlement failed:', err);
      alert('Failed to log settlement at HQ.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Real-time Sync Handler ---
  const handleRefreshTrip = async (tripId: string) => {
    // Silent refresh - do not set global loading state
    console.log(`[App] Silent Refresh for trip: ${tripId}`);
    try {
      const items = await tripService.fetchTripItinerary(tripId);
      const sorted = semanticSort(items);
      setTrips(prev => prev.map(t =>
        t.id === tripId ? { ...t, items: sorted, updatedAt: Date.now() } : t
      ));
    } catch (err) {
      console.error('[App] Silent refresh failed:', err);
    }
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

  const handleDeleteItem = async (itemId?: string) => {
    const idToDelete = itemId || selectedItem?.id;
    if (!idToDelete || !currentTrip) return;

    setIsLoading(true);
    try {
      await tripService.deleteItineraryItem(idToDelete);
      const updatedItems = currentTrip.items.filter(i => i.id !== idToDelete);
      const updatedTrip = { ...currentTrip, items: updatedItems, updatedAt: Date.now() };
      setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
      setSelectedItem(null);

      if (view === 'LOG_EXPENSE') setView('BUDGET');
      else setView('TIMELINE');
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete item.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveItem = async (itemData: Partial<ItineraryItem>) => {
    if (!currentTrip || !canEdit) return;

    setIsLoading(true);
    try {
      let itemToSave: ItineraryItem;

      const existing = itemData.id ? currentTrip.items.find(i => i.id === itemData.id) : null;

      if (existing) { // Existing UUID
        itemToSave = {
          ...existing,
          ...itemData,
          startDate: itemData.startDate || existing.startDate,
          endDate: 'endDate' in itemData ? itemData.endDate : existing.endDate,
          receiptItems: (itemData as any).receiptItems !== undefined ? (itemData as any).receiptItems : existing.receiptItems
        } as ItineraryItem;
      } else {
        const defaultSplitWith = currentTrip.members
          .filter(m => m.status === 'ACTIVE' || !m.status)
          .map(m => m.id);

        itemToSave = {
          id: '', // FORCE INSERT: tripService treats empty string as "New Item". itemData.id from scanner is temporary.
          tripId: currentTrip.id,
          type: itemData.type || selectedItemType || ItemType.ACTIVITY,
          title: itemData.title || 'Untitled',
          location: itemData.location || currentTrip.destination,
          endLocation: itemData.endLocation,
          startDate: itemData.startDate || new Date(),
          endDate: itemData.endDate,
          cost: itemData.cost || 0,
          originalAmount: itemData.originalAmount,
          currencyCode: itemData.currencyCode,
          exchangeRate: itemData.exchangeRate,
          details: itemData.details,
          tags: itemData.tags || [],
          durationMinutes: itemData.durationMinutes || 0,
          createdBy: currentUser.id,
          isPrivate: itemData.isPrivate || false,
          splitWith: itemData.splitWith || defaultSplitWith,
          splitDetails: itemData.splitDetails,
          paidBy: itemData.paidBy || currentUser.id,
          showInTimeline: itemData.showInTimeline !== undefined ? itemData.showInTimeline : true,
          // Geolocation Persistence
          latitude: itemData.latitude,
          longitude: itemData.longitude,
          countryCode: itemData.countryCode,
          endLatitude: itemData.endLatitude,
          endLongitude: itemData.endLongitude,
          endCountryCode: itemData.endCountryCode,
          receiptItems: (itemData as any).receiptItems
        } as ItineraryItem;
      }

      const savedItem = await tripService.saveItineraryItem(itemToSave);

      let updatedItems = [...currentTrip.items];
      if (itemData.id) {
        updatedItems = updatedItems.map(i => i.id === savedItem.id ? savedItem : i);
      } else {
        updatedItems.push(savedItem);
      }

      if (scannedItemsQueue.length > 1) {
        const nextQueue = scannedItemsQueue.slice(1);
        const firstNext = nextQueue[0];
        setTrips(trips.map(t => t.id === currentTrip.id ? { ...t, items: semanticSort(updatedItems) } : t));
        setScannedItemsQueue(nextQueue);
        setSelectedItemType(firstNext.type || ItemType.ACTIVITY);
        setSelectedItem(firstNext);
      } else {
        setScannedItemsQueue([]);
        finishSave(updatedItems);
      }
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save data to HQ.');
    } finally {
      setIsLoading(false);
    }
  };

  const finishSave = (updatedItems: ItineraryItem[]) => {
    if (!currentTrip) return;
    const sorted = semanticSort(updatedItems);
    const updatedTrip = { ...currentTrip, items: sorted, updatedAt: Date.now() };
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
    <div className="h-[100dvh] bg-tactical-bg text-white font-sans w-full md:max-w-2xl lg:max-w-4xl mx-auto relative shadow-2xl flex flex-col overflow-hidden overflow-x-hidden touch-action-pan-y border-x border-tactical-muted/20">
      <main className="flex-1 relative overflow-hidden overflow-x-hidden flex flex-col w-full">

        {!isAuthenticated && view === 'AUTH' && (
          <AuthScreen
            onAuthSuccess={handleAuthSuccess}
            onViewPrivacy={() => setView('PRIVACY')}
            onViewTerms={() => setView('TERMS')}
          />
        )}

        {view === 'PRIVACY' && (
          <PrivacyPolicy onBack={() => setView(isAuthenticated ? 'PROFILE' : 'AUTH')} />
        )}

        {view === 'TERMS' && (
          <TermsOfService onBack={() => setView(isAuthenticated ? 'PROFILE' : 'AUTH')} />
        )}

        {isAuthenticated && view === 'ONBOARDING' && (
          <Onboarding onComplete={handleOnboardingComplete} />
        )}

        {isAuthenticated && view === 'DASHBOARD' && (
          <Dashboard
            user={currentUser}
            trips={trips}
            isLoading={isLoading}
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
            onSignOut={handleSignOut}
            onViewGlobalLedger={() => setView('GLOBAL_LEDGER')}
            onViewPrivacy={() => setView('PRIVACY')}
            onViewTerms={() => setView('TERMS')}
          />
        )}

        {isAuthenticated && view === 'GLOBAL_LEDGER' && (
          <GlobalLedger
            trips={trips}
            currentUser={currentUser}
            onBack={() => setView('PROFILE')}
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
            baseCurrency={currentTrip.baseCurrency || 'USD'}
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
            onRefresh={() => handleRefreshTrip(currentTrip.id)}
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

        {/* Modal Layers */}
        {view === 'INVITE_MEMBER' && currentTrip && (
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
            baseCurrency={currentTrip.baseCurrency || 'USD'}
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
            trip={currentTrip}
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

        {isAuthenticated && view === 'JOIN_MISSION' && pendingJoinTripId && (
          <JoinMission
            tripId={pendingJoinTripId}
            currentUser={currentUser}
            onJoin={() => {
              setPendingJoinTripId(null);
              loadAllData(currentUser.id); // Reload to fetch the new trip
              setView('DASHBOARD');
            }}
            onCancel={() => {
              setPendingJoinTripId(null);
              setView('DASHBOARD');
            }}
          />
        )}

        {view === 'VERIFIED' && (
          <VerificationBridge />
        )}

        {/* Conflict Resolution Overlay */}
        {activeConflict && (
          <ConflictResolver
            conflict={activeConflict}
            onResolved={checkConflicts}
          />
        )}
      </main>
    </div>
  );
};

export default App;
