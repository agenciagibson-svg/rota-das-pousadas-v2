/*
 * Service worker do app da estadia (escopo /estadia, registrado em
 * features/estadia/components/register-stay-sw.tsx).
 *
 * - Páginas: sempre da rede, porque carregam os dados da estadia (conta,
 *   pedidos). Sem rede, mostra /offline-estadia.html. Nenhuma página com
 *   dados do hóspede é guardada no aparelho.
 * - Arquivos do build com hash no nome (/_next/static), ícones e telas de
 *   abertura: cache primeiro — não mudam depois de publicados.
 * - Todo o resto (dados do React Server Components, API, imagens otimizadas)
 *   vai direto para a rede.
 *
 * Ao mudar a estratégia, suba VERSION: o activate apaga os caches antigos.
 */
const VERSION = 'estadia-v1'
const STATIC_CACHE = `${VERSION}-static`
const OFFLINE_URL = '/offline-estadia.html'
const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/apple-icon.png']
const MAX_STATIC_ENTRIES = 150

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('estadia-') && !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isImmutableAsset(url) {
  if (url.search) return false
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/pwa/') ||
    /\.(?:png|svg|ico|woff2)$/.test(url.pathname)
  )
}

async function trim(cache) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - MAX_STATIC_ENTRIES; i += 1) await cache.delete(keys[i])
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone())
    trim(cache)
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    )
    return
  }

  if (isImmutableAsset(url)) event.respondWith(cacheFirst(request))
})
