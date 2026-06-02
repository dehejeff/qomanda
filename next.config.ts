import type { NextConfig } from 'next'
// @ts-expect-error no types for next-pwa
import withPWA from 'next-pwa'

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  turbopack: {},
  async redirects() {
    return [
      { source: '/dashboard/waiter', destination: '/garcom/pedidos', permanent: false },
      { source: '/dashboard/waiter/payments', destination: '/garcom/pagamentos', permanent: false },
      { source: '/dashboard/waiter/tables', destination: '/garcom/mesas', permanent: false },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
}

export default pwaConfig(nextConfig)
