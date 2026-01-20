import { Trip } from '../types';
import {
    Palmtree,
    Building2,
    Leaf,
    Trees,
    Sun,
    MountainSnow,
    Utensils,
    Moon,
    Laptop,
    Plane,
    Landmark,
    Users,
    LucideIcon
} from 'lucide-react';

export type AtmosphericTheme =
    | 'beach'
    | 'urban'
    | 'jungle'
    | 'desert'
    | 'mountain'
    | 'foodie'
    | 'night'
    | 'digital_nomad'
    | 'journey'
    | 'nature'
    | 'culture'
    | 'social';

interface ThemeDef {
    id: AtmosphericTheme;
    gradient: string;
    icon: LucideIcon;
    label: string;
    gradientClass?: string;
}

export const ATMOSPHERIC_THEMES: Record<AtmosphericTheme, ThemeDef> = {
    beach: {
        id: 'beach',
        gradient: 'linear-gradient(135deg, #020617 0%, #0ea5e9 100%)',
        gradientClass: 'from-slate-950 to-sky-500',
        icon: Palmtree,
        label: 'Coastline'
    },
    urban: {
        id: 'urban',
        gradient: 'linear-gradient(135deg, #0f172a 0%, #6366f1 100%)',
        gradientClass: 'from-slate-900 to-indigo-500',
        icon: Building2,
        label: 'Metropolis'
    },
    jungle: {
        id: 'jungle',
        gradient: 'linear-gradient(135deg, #022c22 0%, #10b981 100%)',
        gradientClass: 'from-emerald-950 to-emerald-500',
        icon: Leaf,
        label: 'Deep Jungle'
    },
    desert: {
        id: 'desert',
        gradient: 'linear-gradient(135deg, #1c1917 0%, #f59e0b 100%)',
        gradientClass: 'from-stone-900 to-amber-500',
        icon: Sun,
        label: 'Arid Zone'
    },
    mountain: {
        id: 'mountain',
        gradient: 'linear-gradient(135deg, #0f172a 0%, #94a3b8 100%)',
        gradientClass: 'from-slate-900 to-slate-400',
        icon: MountainSnow,
        label: 'High Altitude'
    },
    foodie: {
        id: 'foodie',
        gradient: 'linear-gradient(135deg, #1a0000 0%, #fb7185 100%)',
        gradientClass: 'from-red-950 to-rose-500',
        icon: Utensils,
        label: 'Culinary'
    },
    night: {
        id: 'night',
        gradient: 'linear-gradient(135deg, #020617 0%, #7c3aed 100%)',
        gradientClass: 'from-slate-950 to-violet-600',
        icon: Moon,
        label: 'Night Ops'
    },
    digital_nomad: {
        id: 'digital_nomad',
        gradient: 'linear-gradient(135deg, #082f49 0%, #06b6d4 100%)',
        gradientClass: 'from-sky-950 to-cyan-500',
        icon: Laptop,
        label: 'Remote Base'
    },
    journey: {
        id: 'journey',
        gradient: 'linear-gradient(135deg, #1c1917 0%, #f97316 100%)',
        gradientClass: 'from-stone-900 to-orange-500',
        icon: Plane,
        label: 'Transit'
    },
    nature: {
        id: 'nature',
        gradient: 'linear-gradient(135deg, #064e3b 0%, #34d399 100%)',
        gradientClass: 'from-emerald-900 to-emerald-400',
        icon: Trees,
        label: 'Wilderness'
    },
    culture: {
        id: 'culture',
        gradient: 'linear-gradient(135deg, #1c1917 0%, #d97706 100%)',
        gradientClass: 'from-stone-900 to-amber-600',
        icon: Landmark,
        label: 'Heritage'
    },
    social: {
        id: 'social',
        gradient: 'linear-gradient(135deg, #2e1065 0%, #ec4899 100%)',
        gradientClass: 'from-indigo-950 to-pink-500',
        icon: Users,
        label: 'Squad'
    }
};

const KEYWORDS: Record<string, AtmosphericTheme> = {
    // Urban
    'tokyo': 'urban', 'nyc': 'urban', 'new york': 'urban', 'london': 'urban',
    'seoul': 'urban', 'city': 'urban', 'metropolis': 'urban', 'berlin': 'urban',
    'singapore': 'urban', 'hong kong': 'urban', 'dubai': 'urban',

    // Beach
    'bali': 'beach', 'hawaii': 'beach', 'maldives': 'beach', 'cancun': 'beach',
    'beach': 'beach', 'coast': 'beach', 'island': 'beach', 'ocean': 'beach',
    'sea': 'beach', 'surf': 'beach', 'tulum': 'beach', 'phuket': 'beach',

    // Jungle
    'amazon': 'jungle', 'costa rica': 'jungle', 'forest': 'jungle', 'rainforest': 'jungle',
    'ubud': 'jungle', 'vietnam': 'jungle', 'wild': 'jungle', 'safari': 'jungle',

    // Desert
    'sahara': 'desert', 'dubai desert': 'desert', 'nevada': 'desert', 'vegas': 'desert',
    'arizona': 'desert', 'cairo': 'desert', 'egypt': 'desert', 'dune': 'desert',
    'burning man': 'desert', 'joshua tree': 'desert',

    // Mountain
    'alps': 'mountain', 'switzerland': 'mountain', 'aspen': 'mountain', 'colorado': 'mountain',
    'everest': 'mountain', 'nepal': 'mountain', 'ski': 'mountain', 'snow': 'mountain',
    'himalaya': 'mountain', 'patagonia': 'mountain', 'banff': 'mountain',

    // Foodie
    'food': 'foodie', 'eat': 'foodie', 'dinner': 'foodie', 'restaurant': 'foodie', 'cafe': 'foodie', 'culinary': 'foodie', 'wine': 'foodie',

    // Night
    'night': 'night', 'party': 'night', 'club': 'night', 'dark': 'night', 'midnight': 'night',

    // Digital Nomad
    'work': 'digital_nomad', 'laptop': 'digital_nomad', 'coworking': 'digital_nomad', 'hub': 'digital_nomad', 'remote': 'digital_nomad',

    // Journey
    'trip': 'journey', 'travel': 'journey', 'flight': 'journey', 'train': 'journey', 'transit': 'journey', 'road': 'journey',

    // Nature
    'nature': 'nature', 'park': 'nature', 'tree': 'nature', 'lake': 'nature', 'river': 'nature', 'hiking': 'nature',

    // Culture
    'culture': 'culture', 'museum': 'culture', 'temple': 'culture', 'history': 'culture', 'heritage': 'culture', 'art': 'culture',

    // Social
    'social': 'social', 'squad': 'social', 'friends': 'social', 'group': 'social', 'team': 'social', 'party group': 'social'
};

export const getThemeForTrip = (trip: Trip): ThemeDef => {
    // 1. Heuristic Matching
    const searchStr = `${trip.name} ${trip.destination}`.toLowerCase();

    for (const [keyword, themeId] of Object.entries(KEYWORDS)) {
        if (searchStr.includes(keyword)) {
            return ATMOSPHERIC_THEMES[themeId];
        }
    }

    // 2. Deterministic Fallback based on ID
    const themes = Object.values(ATMOSPHERIC_THEMES);
    let hash = 0;
    for (let i = 0; i < trip.id.length; i++) {
        hash = trip.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % themes.length;

    return themes[index];
};
