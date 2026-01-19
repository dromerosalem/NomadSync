
const CACHE_NAME = 'nomadsync-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png',
    '/index.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

const MAP_CACHE = 'nomadsync-map-tiles-v1';

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 0. Global Bypass for non-GET requests (Mutations/RPCs should never be cached)
    if (event.request.method !== 'GET') {
        return;
    }

    // 1. Bypass for specific API domains to avoid proxy overhead/timeouts
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('supabase.co') || url.hostname.includes('generativelanguage.googleapis.com')) {
        return;
    }

    // 3. Intercept Map Tile requests for Offline Sat-Link
    if (url.hostname.includes('basemaps.cartocdn.com')) {
        event.respondWith(
            caches.open(MAP_CACHE).then((cache) => {
                return cache.match(event.request).then((response) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                    // Fallback to network if not in cache, but always update cache in background
                    return response || fetchPromise;
                });
            })
        );
        return;
    }

    // 4. Default Cache-First strategy for static assets
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// Background Sync Listener
self.addEventListener('sync', (event) => {
    if (event.tag === 'flush-sync-queue') {
        event.waitUntil(flushSyncQueue());
    }
});

async function flushSyncQueue() {
    // We can't easily access Dexie/Supabase here without bundling.
    // The main thread will also be triggered by the 'online' event.
    // This is a placeholder for background sync if we had a bundled SW.
    console.log('[SW] Background Sync Triggered: flush-sync-queue');

    // Notify all clients that they should try to sync
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_REQUESTED' });
    });
}

// Notification Click Listener
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Open app or focus existing tab
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return self.clients.openWindow('/');
        })
    );
});
