import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export class NotificationManager {

    static async requestPermission(): Promise<NotificationPermission> {
        if (!('Notification' in window)) {
            console.warn('Notifications not supported');
            return 'denied';
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            await this.subscribeToPush();
        }
        return permission;
    }

    static async subscribeToPush() {
        if (!VAPID_PUBLIC_KEY) {
            console.error('Missing VAPID Public Key');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Check if already subscribed
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });
            }

            await this.saveSubscription(subscription);

        } catch (error: any) {
            console.error('Failed to subscribe to push:', error);
            if (error.name === 'AbortError' || error.message.includes('push service error')) {
                console.warn('Push registration aborted. If you are using Brave, please enable "Use Google Services for Push Messaging" in settings.');
                // Optionally trigger a toast or UI alert here explaining the Brave issue
            }
        }
    }

    static async saveSubscription(subscription: PushSubscription) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Create a unique device ID (simple fingerprint for now, ideally persist in localStorage)
        let deviceId = localStorage.getItem('nomadsync_device_id');
        if (!deviceId) {
            deviceId = crypto.randomUUID();
            localStorage.setItem('nomadsync_device_id', deviceId);
        }

        const { error } = await supabase.from('user_devices').upsert({
            user_id: user.id,
            device_id: deviceId,
            subscription: subscription.toJSON(), // Important: Serialize correctly
            platform: 'web',
            last_active: new Date().toISOString()
        }, {
            onConflict: 'user_id, device_id'
        });

        if (error) {
            console.error('Failed to save push token:', error);
        } else {
            console.log('Push token synced with HQ.');
        }
    }

    static async unsubscribe() {
        if (!('Notification' in window)) return;
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            console.log('Unsubscribed from push notifications');
        }
    }

    // Utils
    static urlBase64ToUint8Array(base64String: string) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}
