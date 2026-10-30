import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBackendAssetUrl(assetPath: string | undefined | null): string {
  if (!assetPath) return "";
  const backendBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api")
    .replace(/\/api\/?$/, "");

  try {
    const url = new URL(assetPath, backendBase);
    if (url.pathname.startsWith("/uploads/")) {
      return `${backendBase}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // Preserve unexpected legacy values instead of breaking their links.
  }

  return assetPath;
}

// Helper para construir URLs completas de imágenes desde el backend
export function getImageUrl(imagePath: string | undefined | null): string {
  if (!imagePath || imagePath.trim() === '') {
    return '/placeholder-product.png';
  }

  // Assets bundled with the storefront must be served by the current domain.
  if (imagePath.startsWith('/images/')) {
    return imagePath;
  }

  // Si es una URL completa con localhost, reemplazar por la IP configurada
  if (imagePath.includes('localhost:3001') || imagePath.includes('127.0.0.1:3001')) {
    // Obtener la URL base del API
    let apiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    // Si apiUrl es relativa, convertirla a absoluta usando window.location
    if (typeof window !== 'undefined') {
      if (!apiUrl || apiUrl.startsWith('/')) {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port;
        const portStr = port && port !== '80' && port !== '443' ? `:${port}` : '';
        apiUrl = `${protocol}//${hostname}${portStr}${apiUrl || '/api'}`;
      }
    } else if (!apiUrl || apiUrl.startsWith('/')) {
      // En el servidor, usar localhost como fallback
      apiUrl = 'http://localhost:3001/api';
    }
    
    const baseUrl = apiUrl.replace(/\/api$/, '');
    
    const newUrl = imagePath
      .replace('http://localhost:3001', baseUrl)
      .replace('https://localhost:3001', baseUrl)
      .replace('http://127.0.0.1:3001', baseUrl)
      .replace('https://127.0.0.1:3001', baseUrl);
    
    return newUrl;
  }

  // Si ya es una URL completa (http/https), devolverla tal cual
  // Forzar https para evitar mixed-content en sitios con SSL
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    const httpsUrl = imagePath.replace(/^http:\/\//, 'https://');
    // Si es la URL de imgproxy del backend, extraer la URL original y reencaminarla por el proxy del frontend
    if (httpsUrl.includes('/api/imgproxy?url=')) {
      try {
        const inner = new URL(httpsUrl).searchParams.get('url');
        if (inner) return `/api/imgproxy?url=${encodeURIComponent(inner)}`;
      } catch { /* fallthrough */ }
    }
    // Si es nuestro CDN o backend, devolver directo
    const trustedDomains = [
      'digitaloceanspaces.com',
      'ondigitalocean.app',
      'mundobeat.cl',
      'localhost',
      '127.0.0.1',
    ];
    const isTrusted = trustedDomains.some(d => httpsUrl.includes(d));
    if (isTrusted) return httpsUrl;
    // Imagen externa: pasar por proxy para evitar hotlink/CORS
    return `/api/imgproxy?url=${encodeURIComponent(httpsUrl)}`;
  }

  // Si es una ruta relativa, agregar el prefijo del backend
  const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  // Usar la URL del API desde variables de entorno o construir desde window.location
  let apiUrl = process.env.NEXT_PUBLIC_API_URL;
  
  // Si apiUrl es relativa, convertirla a absoluta usando window.location
  if (typeof window !== 'undefined') {
    if (!apiUrl || apiUrl.startsWith('/')) {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port;
      const portStr = port && port !== '80' && port !== '443' ? `:${port}` : '';
      apiUrl = `${protocol}//${hostname}${portStr}${apiUrl || '/api'}`;
    }
  } else if (!apiUrl || apiUrl.startsWith('/')) {
    // En el servidor, usar localhost como fallback
    apiUrl = 'http://localhost:3001/api';
  }
  
  const baseUrl = apiUrl.replace(/\/api$/, '');
  
  return `${baseUrl}${path}`;
}

const normalizeToArray = (value: any): any[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      if (value.includes(',')) {
        return value.split(',').map((v) => v.trim()).filter(Boolean);
      }
      return [value];
    }
  }

  return [];
};

const getRawImageAtIndex = (images: any[], index: number): string | null => {
  const item = images[index];
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (typeof item?.url === 'string') return item.url;
  return null;
};

export function getProductImageByIndex(
  product: any,
  index: number,
  variant: 'thumb' | 'large' = 'large',
): string | null {
  if (!product || index < 0) return null;

  const metaArray = normalizeToArray(product.imagesMeta);
  const meta = metaArray[index];

  if (meta && typeof meta === 'object') {
    if (variant === 'thumb' && typeof meta.thumb300Url === 'string' && meta.thumb300Url.trim() !== '') {
      return meta.thumb300Url;
    }
    if (variant === 'large' && typeof meta.large700Url === 'string' && meta.large700Url.trim() !== '') {
      return meta.large700Url;
    }
  }

  const imagesArray = normalizeToArray(product.images);
  return getRawImageAtIndex(imagesArray, index);
}
