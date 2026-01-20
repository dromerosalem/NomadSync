import React from 'react';
import { getAvatarTheme } from '../utils/avatarUtils';

interface AtmosphericAvatarProps {
    userId: string;
    avatarUrl?: string | null;
    name: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    isPathfinder?: boolean;
}

const AtmosphericAvatar: React.FC<AtmosphericAvatarProps> = ({
    userId,
    avatarUrl,
    name,
    size = 'md',
    className = '',
    isPathfinder = false
}) => {
    const theme = getAvatarTheme(userId);
    const Icon = theme.icon;

    const sizeClasses = {
        xs: 'w-6 h-6',
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
        xl: 'w-16 h-16'
    };

    const iconSizes = {
        xs: 12,
        sm: 16,
        md: 20,
        lg: 24,
        xl: 32
    };

    // Check if avatarUrl is actually a valid image URL (not a placeholder)
    const hasValidImage = avatarUrl &&
        !avatarUrl.includes('picsum.photos') &&
        !avatarUrl.includes('unsplash.com') &&
        !avatarUrl.includes('pravatar.cc') &&
        !avatarUrl.includes('ui-avatars.com');

    return (
        <div className={`relative inline-block ${className}`}>
            <div
                className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center border-2 ${isPathfinder ? 'border-tactical-accent' : 'border-white/10 shadow-inner'}`}
                style={{
                    background: hasValidImage ? 'transparent' : theme.gradient
                }}
            >
                {hasValidImage ? (
                    <img
                        src={avatarUrl}
                        alt={name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center relative w-full h-full">
                        {/* Background subtle noise for texture */}
                        <div
                            className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
                            }}
                        />
                        <Icon
                            size={iconSizes[size]}
                            className="text-white/80"
                            strokeWidth={1.5}
                        />
                    </div>
                )}
            </div>

            {isPathfinder && (
                <div className="absolute -bottom-1 -right-1 bg-tactical-accent text-black p-0.5 rounded-full border-2 border-tactical-bg shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
            )}
        </div>
    );
};

export default AtmosphericAvatar;
