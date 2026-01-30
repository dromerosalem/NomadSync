import { Trip, ItemType } from '../types';

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string; // Icon component name
    level: number; // 0 = locked, 1-10 = unlocked levels
    maxLevel: number;
}

/**
 * Calculate achievements based on user's trip and item data
 */
export function calculateAchievements(trips: Trip[], userId: string): Achievement[] {
    let totalMissions = 0;
    let completedMissions = 0;
    let totalTerritories = new Set<string>();
    let itemsByType: Record<string, number> = {};
    let totalExpenses = 0;
    let settlementsCount = 0;
    let tripsJoined = 0;

    trips.forEach(trip => {
        // Count missions
        if (trip.status === 'COMPLETE' || trip.status === 'IN_PROGRESS') {
            totalMissions++;
        }
        if (trip.status === 'COMPLETE') {
            completedMissions++;
        }

        // Check if user joined (not created) this trip
        const isCreator = trip.members.some(m => m.id === userId && m.role === 'PATHFINDER');
        if (!isCreator) {
            tripsJoined++;
        }

        // Track territories
        if (trip.destination) {
            const parts = trip.destination.split('•');
            const territory = parts.length > 1 ? parts[1].trim() : parts[0].trim();
            if (territory) totalTerritories.add(territory);
        }

        // Analyze items
        trip.items.forEach(item => {
            if (item.createdBy === userId && !item.isPrivate) {
                const type = item.type;
                itemsByType[type] = (itemsByType[type] || 0) + 1;

                // Count items with costs as "expenses"
                if (item.cost && item.cost > 0 && type !== ItemType.SETTLEMENT) {
                    totalExpenses++;
                } else if (type === ItemType.SETTLEMENT) {
                    settlementsCount++;
                }
            }
        });
    });

    const transportCount = itemsByType[ItemType.TRANSPORT] || 0;
    const stayCount = itemsByType[ItemType.STAY] || 0;

    return [
        {
            id: 'first_mission',
            name: 'First Mission',
            description: 'Create your first trip',
            icon: 'MapPinIcon',
            level: totalMissions > 0 ? 1 : 0,
            maxLevel: 1
        },
        {
            id: 'master_planner',
            name: 'Master Planner',
            description: 'Create multiple trips',
            icon: 'MapPinIcon',
            level: Math.min(5, totalMissions),
            maxLevel: 5
        },
        {
            id: 'expense_tracker',
            name: 'Expense Tracker',
            description: 'Log expenses to track spending',
            icon: 'WalletIcon',
            level: Math.min(10, Math.floor(totalExpenses / 5)),
            maxLevel: 10
        },
        {
            id: 'ride_master',
            name: 'Ride Master',
            description: 'Add transport items',
            icon: 'CompassIcon',
            level: Math.min(5, transportCount),
            maxLevel: 5
        },
        {
            id: 'home_finder',
            name: 'Home Finder',
            description: 'Add accommodation stays',
            icon: 'MapPinIcon',
            level: Math.min(5, stayCount),
            maxLevel: 5
        },
        {
            id: 'navigator',
            name: 'Navigator',
            description: 'Visit different territories',
            icon: 'CompassIcon',
            level: Math.min(8, totalTerritories.size),
            maxLevel: 8
        },
        {
            id: 'settlement_king',
            name: 'Settlement King',
            description: 'Settle debts with teammates',
            icon: 'WalletIcon',
            level: Math.min(5, settlementsCount),
            maxLevel: 5
        },
        {
            id: 'social_butterfly',
            name: 'Social Butterfly',
            description: 'Join trips created by others',
            icon: 'NetworkIcon',
            level: Math.min(3, tripsJoined),
            maxLevel: 3
        }
    ];
}

/**
 * Calculate total level based on achievement progress
 */
export function calculateProfileLevel(achievements: Achievement[]): { 
    level: number; 
    title: string;
    xp: number;
    nextLevelXp: number;
} {
    // Each achievement level contributes to total level
    // LVL 1 = 100 XP, LVL 2 = 250 XP, etc.
    const totalXp = achievements.reduce((acc, ach) => {
        if (ach.level === 0) return acc;
        // Exponential XP per level
        return acc + (ach.level * 100) + (Math.pow(ach.level, 2) * 50);
    }, 0);

    // level = sqrt(xp / 100) or similar
    // Let's use a simpler linear-ish scale for now
    const level = Math.max(1, Math.floor(totalXp / 500) + 1);
    const xpIntoLevel = totalXp % 500;
    const nextLevelXp = 500;

    const titles = [
        'Novice Scout',    // Lvl 1
        'Junior Operative', // Lvl 2
        'Field Analyst',    // Lvl 3
        'Pathfinder',      // Lvl 4
        'Wayfinder',       // Lvl 5
        'Senior Operative', // Lvl 6
        'Mission Lead',    // Lvl 7
        'Tactical Commander',// Lvl 8
        'Elite Vanguard',   // Lvl 9
        'Nomad Legend'     // Lvl 10+
    ];

    const title = titles[Math.min(level - 1, titles.length - 1)];

    return { level, title, xp: xpIntoLevel, nextLevelXp };
}
