import type { NextConfig } from "next";
for (const key of ["API_URL", "NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_SITE_URL"]) {
  if (/mundobeat|clownfish-app-x3a5k|tiendas-chi/i.test(process.env[key] || ""))
    throw new Error("Configura destinos propios para Propiedades.");
}
const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  async rewrites() {
    const api = (process.env.API_URL || "http://localhost:3001/api").replace(
      /\/$/,
      "",
    );
    return [{ source: "/api/:path*", destination: `${api}/:path*` }];
  },
};
export default nextConfig;
