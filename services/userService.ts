import { supabase } from './supabaseClient';
import { Member } from '../types';

export const userService = {
    async updateProfile(userId: string, updates: Partial<Member>): Promise<void> {
        const dbUpdates: any = {};
        if (updates.name) dbUpdates.full_name = updates.name;
        if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
        if (updates.onboardingCompleted !== undefined) dbUpdates.onboarding_completed = updates.onboardingCompleted;

        // Optimistic update to Supabase
        const { error } = await supabase
            .from('profiles')
            .update(dbUpdates)
            .eq('id', userId);

        if (error) {
           console.warn('Profile update failed:', error);
           // Throwing prevents local update? Maybe better to allow local update if offline?
           // For now, let's keep strictness unless we want full offline mutation.
           throw error;
        }
        
        // Cache update
        try {
            const cached = localStorage.getItem(`profile_cache_${userId}`);
            if (cached) {
                const profile = JSON.parse(cached);
                const updatedProfile = { ...profile, ...updates };
                localStorage.setItem(`profile_cache_${userId}`, JSON.stringify(updatedProfile));
            }
        } catch (e) {
            console.warn('Failed to update local profile cache', e);
        }
    },

    async fetchProfile(userId: string): Promise<Partial<Member>> {
        try {
            const fetchPromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Network timeout')), 5000)
            );

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

            if (error) throw error;
            if (!data) return {};

            const profile = {
                id: data.id,
                name: data.full_name,
                email: data.email,
                avatarUrl: data.avatar_url,
                onboardingCompleted: data.onboarding_completed
            };

            // Cache for offline
            localStorage.setItem(`profile_cache_${userId}`, JSON.stringify(profile));

            return profile;
        } catch (error: any) {
            if (error.message === 'Network timeout') {
               console.warn('Profile fetch timed out (5s), checking cache...');
            } else {
               console.warn('Network profile fetch failed, checking cache...', error);
            }
            // Fallback to cache
            const cached = localStorage.getItem(`profile_cache_${userId}`);
            if (cached) {
                return JSON.parse(cached);
            }
            // If genuinely no cache and no network, throwing might be right, 
            // OR return empty to allow app to load but maybe trigger onboarding?
            // Returning empty might trigger onboarding which handles the 'missing data' case gracefully.
            return {}; 
        }
    }
};
