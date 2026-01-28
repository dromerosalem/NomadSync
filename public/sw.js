
const CACHE_NAME = 'nomadsync-cache-v10';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png',
    '/index.css',
    '/assets/vibes/explorer.png',
    '/assets/vibes/relaxer.png',
    '/assets/vibes/foodie.png',
    '/assets/vibes/urbanite.png',
    '/assets/vibes/journey.png',
    '/assets/vibes/digital_nomad.png',
    '/assets/vibes/minimalist.png',
    '/assets/vibes/social.png',
    '/assets/vibes/nature.png',
    '/assets/vibes/ocean.png',
    '/assets/vibes/culture.png',
    '/assets/vibes/night.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== 'nomadsync-map-tiles-v1') {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

const MAP_CACHE = 'nomadsync-map-tiles-v1';

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 0. Global Bypass for non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // 1. Bypass for specific API domains
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('supabase.co')) {
        return;
    }

    // 2. Intercept Map Tile requests
    if (url.hostname.includes('basemaps.cartocdn.com')) {
        event.respondWith(
            caches.open(MAP_CACHE).then((cache) => {
                return cache.match(event.request).then((response) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                    return response || fetchPromise;
                });
            })
        );
        return;
    }

    // 3. Dynamic caching for built assets (fonts, bundles, etc)
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((response) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        // Only cache valid responses
                        if (networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                    return response || fetchPromise;
                });
            })
        );
    }
});

// Background Sync Listener
self.addEventListener('sync', (event) => {
    if (event.tag === 'flush-sync-queue') {
        event.waitUntil(flushSyncQueue());
    }
});

async function flushSyncQueue() {
    console.log('[SW] Background Sync Triggered: flush-sync-queue');
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_REQUESTED' });
    });
}

// 4. Push Notification Listener
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const payload = event.data.json();
        const { title, body, icon, url, tag } = payload;

        const options = {
            body: body || 'New activity in NomadSync',
            icon: icon || '/logo.png',
            badge: '/logo.png', // Small icon for status bar
            vibrate: [100, 50, 100],
            data: { url: url || '/' },
            tag: tag || 'general', // collapse notifications with same tag
            renotify: true
        };

        event.waitUntil(
            self.registration.showNotification(title || 'NomadSync', options)
        );
    } catch (err) {
        console.error('[SW] Push error:', err);
    }
});

// 5. Notification Click Listener (Deep Linking)
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if window is already open
            for (const client of clientList) {
                const clientUrl = new URL(client.url);
                if (clientUrl.pathname === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open new window
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
