/**
 * Tactical Asset Management Protocol
 * Handles deterministic assignment of local assets based on mission data.
 * Zero-network dependency.
 */

const MISSION_COVERS = [
    '/assets/vibes/explorer.png',
    '/assets/vibes/relaxer.png',
    '/assets/vibes/foodie.png',
    '/assets/vibes/urbanite.png',
    '/assets/vibes/journey.png',
    '/assets/vibes/minimalist.png',
    '/assets/vibes/social.png',
    '/assets/vibes/nature.png',
    '/assets/vibes/ocean.png',
    '/assets/vibes/culture.png',
    '/assets/vibes/night.png'
];

/**
 * Returns a consistent local cover image for a given mission ID.
 * Uses a simple hash of the ID to select from the available tactical environments.
 * @param missionId - The unique UUID of the mission
 * @returns Path to the local asset
 */
export const getMissionCover = (missionId: string | undefined): string => {
    if (!missionId) return MISSION_COVERS[0];

    // Simple string hash function
    let hash = 0;
    for (let i = 0; i < missionId.length; i++) {
        hash = missionId.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Map hash to array index (always positive)
    const index = Math.abs(hash) % MISSION_COVERS.length;

    return MISSION_COVERS[index];
};

/**
 * Sanitizes an asset URL, forcing local tactical fallback if the URL is an external placeholder.
 * @param url - The candidate image URL
 * @param id - Fallback ID for deterministic mapping
 * @returns Safe local or verified cloud URL
 */
export const sanitizeAsset = (url: string | null | undefined, id: string | undefined): string => {
    if (!url ||
        url.includes('picsum.photos') ||
        url.includes('unsplash.com') ||
        url.includes('pravatar.cc') ||
        url.includes('ui-avatars.com')
    ) {
        return getMissionCover(id);
    }
    return url;
};

/**
 * Returns all cover images for pre-caching
 */
export const getAllMissionCovers = (): string[] => {
    return MISSION_COVERS;
};
