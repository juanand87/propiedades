import type { NextConfig } from "next";

for (const key of ['API_URL', 'NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_ASSET_BASE_URL']) {
  if (/mundobeat|clownfish-app-x3a5k|tiendas-chi/i.test(process.env[key] || '')) {
    throw new Error(`Configuración heredada bloqueada: ${key}`);
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Asegurar que las rutas se generen correctamente
  trailingSlash: false,
  async redirects() {
    return [{ source: '/products/:id', destination: '/productos/:id', permanent: true }];
  },
  
  // Configuración de imágenes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'localhost',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.digitaloceanspaces.com',
        pathname: '/**',
      },
      // Permitir imágenes de cualquier dominio externo (necesario para marketplace
      // donde los vendedores pueden tener productos importados desde sus propias tiendas)
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '**',
        pathname: '/**',
      },
    ],
  },
  
  // Permitir acceso desde nombre de host local
  allowedDevOrigins: [
    'victusofi', 
    'victusofi:3000', 
    '192.168.1.206', 
    '192.168.1.206:3000',
    '192.168.1.3',
    '192.168.1.3:3000',
    '192.168.0.64',
    '192.168.0.64:3000'
  ],
  
  // Configuración para producción con subdominios
  async headers() {
    return [
      ...['/dashboard/:path*', '/panel/:path*', '/pedido/:path*', '/tiendas/:slug/pedido/:path*', '/mis-pedidos/:path*', '/checkout/:path*', '/cart/:path*', '/b/:path*'].map(source => ({ source, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] })),
      {
        source: '/:path*',
        headers: [
          {
            key: 'x-forwarded-host',
            value: ':host',
          },
        ],
      },
    ];
  },
  
  // Reescribir rutas API al backend de DigitalOcean
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${(process.env.API_URL || 'http://localhost:3001/api').replace(/\/$/, '')}/:path*`,
      },
    ];
  },
};

export default nextConfig;
