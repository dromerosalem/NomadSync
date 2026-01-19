
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

self.addEventListener('fetch', (event) => {
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
