/** @type {import('next').NextConfig} */
const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const nextConfig = {
  images: {
    remotePatterns: [
      // Fotos do banco Unsplash (lib/stock-images.ts).
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/photo-*' },
      ...(storageUrl
        ? [
            {
              protocol: new URL(storageUrl).protocol === 'https:' ? 'https' : 'http',
              hostname: new URL(storageUrl).hostname,
              port: new URL(storageUrl).port,
              pathname: '/storage/v1/object/public/pousadas/**',
            },
          ]
        : []),
    ],
  },
}

export default nextConfig
