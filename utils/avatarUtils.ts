import {
    Fingerprint, Shield, Activity, Wifi, Zap, Target, Crosshair, Map, Key, Cpu,
    Layers, Box, Hexagon, ShieldAlert, Eye, Glasses, Headphones, Mic, Radio,
    Signal, Smartphone, HardDrive, Database, Hash, Binary, LucideIcon
} from 'lucide-react';

export interface AvatarTheme {
    id: number;
    gradient: string;
    icon: LucideIcon;
    label: string;
}

const AVATAR_ICONS = [
    Fingerprint, Shield, Activity, Wifi, Zap, Target, Crosshair, Map, Key, Cpu,
    Layers, Box, Hexagon, ShieldAlert, Eye, Glasses, Headphones, Mic, Radio,
    Signal, Smartphone, HardDrive, Database, Hash, Binary
];

const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #0f172a 0%, #334155 100%)', // Slate
    'linear-gradient(135deg, #18181b 0%, #3f3f46 100%)', // Zinc
    'linear-gradient(135deg, #450a0a 0%, #991b1b 100%)', // Red
    'linear-gradient(135deg, #431407 0%, #9a3412 100%)', // Orange
    'linear-gradient(135deg, #451a03 0%, #92400e 100%)', // Amber
    'linear-gradient(135deg, #3f2d06 0%, #854d0e 100%)', // Yellow
    'linear-gradient(135deg, #1a2e05 0%, #3f6212 100%)', // Lime
    'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', // Emerald
    'linear-gradient(135deg, #083344 0%, #155e75 100%)', // Cyan
    'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)', // Sky
    'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', // Blue
    'linear-gradient(135deg, #312e81 0%, #3730a3 100%)', // Indigo
    'linear-gradient(135deg, #4c1d95 0%, #5b21b6 100%)', // Violet
    'linear-gradient(135deg, #581c87 0%, #6b21a8 100%)', // Purple
    'linear-gradient(135deg, #701a75 0%, #86198f 100%)', // Fuchsia
    'linear-gradient(135deg, #831843 0%, #9d174d 100%)', // Pink
    'linear-gradient(135deg, #881337 0%, #9f1239 100%)', // Rose
    'linear-gradient(135deg, #020617 0%, #1e293b 100%)', // Deep Slate
    'linear-gradient(135deg, #09090b 0%, #27272a 100%)', // Deep Zinc
    'linear-gradient(135deg, #064e3b 0%, #059669 100%)', // Deep Emerald
    'linear-gradient(135deg, #171717 0%, #404040 100%)', // Neutral
    'linear-gradient(135deg, #1c1917 0%, #44403c 100%)', // Stone
    'linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)', // Late Night
    'linear-gradient(135deg, #022c22 0%, #065f46 100%)', // Tactical Green
    'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', // Tactical Indigo
];

const SEMANTIC_LABELS = [
    'Infiltrator', 'Ghost', 'Sentinel', 'Netrunner', 'Operative', 'Pathfinder', 'Scout', 'Navigator', 'Cypher', 'Core',
    'Matrix', 'Node', 'Vector', 'Warning', 'Observer', 'Specter', 'Vocal', 'Static', 'Frequency', 'Link',
    'Interface', 'Drive', 'Vault', 'Tag', 'Logic'
];

export const getAvatarTheme = (userId: string): AvatarTheme => {
    // Simple string hash function
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % 25;

    return {
        id: index,
        gradient: AVATAR_GRADIENTS[index],
        icon: AVATAR_ICONS[index],
        label: SEMANTIC_LABELS[index]
    };
};
