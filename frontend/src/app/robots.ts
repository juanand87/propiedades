import type { MetadataRoute } from 'next';

// Mantener la copia fuera de los buscadores hasta terminar la separación.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
