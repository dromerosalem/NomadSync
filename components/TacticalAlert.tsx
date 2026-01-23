
import React, { useEffect } from 'react';
import { ScanIcon } from './Icons'; // Using ScanIcon as placeholder, but we should use specific icons

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface TacticalAlertProps {
    title: string;
    message?: string;
    type?: AlertType;
    onClose: () => void;
    duration?: number;
}

export const TacticalAlert: React.FC<TacticalAlertProps> = ({
    title,
    message,
    type = 'info',
    onClose,
    duration = 4000
}) => {

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    const getColors = () => {
        switch (type) {
            case 'error': return 'border-red-500/50 bg-red-950/90 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.3)]';
            case 'success': return 'border-green-500/50 bg-green-950/90 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]';
            case 'warning': return 'border-yellow-500/50 bg-yellow-950/90 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]';
            default: return 'border-tactical-accent/50 bg-black/90 text-tactical-accent shadow-[0_0_15px_rgba(255,215,0,0.2)]';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'error':
                return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
            case 'success':
                return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
            case 'warning':
                return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
            default:
                return <ScanIcon className="w-6 h-6" />;
        }
    }

    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm rounded-xl border p-4 backdrop-blur-md animate-slide-in-top flex items-start gap-4 ${getColors()}`}>
            <div className="shrink-0 mt-0.5">
                {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="font-bold uppercase tracking-wider text-sm">{title}</h4>
                {message && <p className="text-xs opacity-90 mt-1 leading-relaxed font-mono">{message}</p>}
            </div>
            <button onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
        </div>
    );
};
