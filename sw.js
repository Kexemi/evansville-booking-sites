/**
 * sw.js — Service Worker for Evansville Booking Sites
 * Cache-first for app shell, network-first for booking data
 */
const CACHE = 'evb-v1';
const ASSETS = [
    '/evansville-booking-sites/',
    '/evansville-booking-sites/app.js',
    '/evansville-booking-sites/index.html'
];

self.addEventListener('install', function(e) {
    e.waitUntil(
        caches.open(CACHE).then(function(cache) {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', function(e) {
    var url = e.request.url;
    // For app pages, try cache first, then network
    if (url.includes('/evansville-booking-sites/apps/')) {
        e.respondWith(
            caches.match(e.request).then(function(cached) {
                return cached || fetch(e.request).then(function(response) {
                    return caches.open(CACHE).then(function(cache) {
                        cache.put(e.request, response.clone());
                        return response;
                    });
                });
            })
        );
        return;
    }
    // For static assets, cache first
    if (url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.json') || url.endsWith('.png')) {
        e.respondWith(
            caches.match(e.request).then(function(cached) {
                return cached || fetch(e.request);
            })
        );
        return;
    }
    // Everything else: network first
    e.respondWith(
        fetch(e.request).catch(function() {
            return caches.match(e.request);
        })
    );
});
