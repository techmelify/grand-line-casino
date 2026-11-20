/* Grand Line Casino — minimal offline-capable service worker. */
"use strict";

const CACHE = "grand-line-casino-v2";

const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/manifest.webmanifest",
  "/js/core.js",
  "/js/slots.js",
  "/js/blackjack.js",
  "/js/roulette.js",
  "/js/mines.js",
  "/js/main.js",
  "/assets/luffy-manga.jpg",
  "/assets/ace-manga.jpg",
  "/assets/og-image.png",
  "/assets/icon-192.png",
  "/assets/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () {})
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (key) {
          return key !== CACHE;
        }).map(function (key) {
          return caches.delete(key);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copy);
          }).catch(function () {});
        }
        return response;
      })
      .catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match("/index.html");
        });
      })
  );
});
