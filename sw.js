// Morse Practice · Service Worker
// 策略：HTML 入口 network-first（保证升级），静态资源 cache-first
// 升级：手动把下方 CACHE_VERSION 从 v1 改为 v2、v3... 即可触发旧 cache 清理

const CACHE_VERSION = 'morse-cache-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/main.css',
  '/src/main.js',
  '/src/core/morse-table.js',
  '/src/core/encoder.js',
  '/src/core/audio.js',
  '/src/modes/forward.js',
  '/src/modes/listen.js',
  '/src/modes/straightkey.js',
  '/src/modes/translator.js',
  '/src/storage/progress.js',
  '/src/i18n/index.js',
  '/src/i18n/zh.js',
  '/src/i18n/en.js',
  '/src/data/words.js',
  '/src/data/sentences.js',
  '/src/ui/app.js',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable-512.png'
];

// 安装：预缓存所有资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE))
  );
  // 立即激活新 SW（不等旧 SW 退出）
  self.skipWaiting();
});

// 激活：清旧版本 cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// fetch 拦截
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // 只处理 GET
  if (req.method !== 'GET') return;
  // 只处理同源
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML 入口 → network-first
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // 其他静态资源 → cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // 只缓存成功响应
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        return res;
      });
    })
  );
});