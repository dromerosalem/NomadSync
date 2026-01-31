import { supabase } from './supabaseClient';
import { Member } from '../types';

export const userService = {
    async updateProfile(userId: string, updates: Partial<Member>): Promise<void> {
        const dbUpdates: any = {};
        if (updates.name) dbUpdates.full_name = updates.name;
        if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
        if (updates.onboardingCompleted !== undefined) dbUpdates.onboarding_completed = updates.onboardingCompleted;

        const { error } = await supabase
            .from('profiles')
            .update(dbUpdates)
            .eq('id', userId);

        if (error) throw error;
    },

    async fetchProfile(userId: string): Promise<Partial<Member>> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        if (!data) return {};

        return {
            id: data.id,
            name: data.full_name,
            email: data.email,
            avatarUrl: data.avatar_url,
            onboardingCompleted: data.onboarding_completed
        };
    }
};
