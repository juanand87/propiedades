/**
 * Utilidad para obtener la URL completa de una imagen
 * Maneja rutas relativas y absolutas
 */
export function getImageUrl(imagePath: string | null | undefined): string {
  
  if (!imagePath || imagePath.trim() === '') {
    return '/placeholder-product.png'; // Imagen por defecto
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
  // Asegurar que la ruta comience con /
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
  
  // Remover /api del final si existe para construir la URL base
  const baseUrl = apiUrl.replace(/\/api$/, '');
  
  return `${baseUrl}${path}`;
}
