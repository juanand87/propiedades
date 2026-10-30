import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  if (process.env.INTEGRATIONS_ENABLED !== 'true') {
    return new NextResponse('Integraciones deshabilitadas', { status: 503 });
  }
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('Missing url param', { status: 400 });
  }

  // Si la URL es un imgproxy del backend, extraer la URL interna
  let targetUrl = url;
  try {
    const parsed = new URL(url);
    if (parsed.pathname === '/api/imgproxy') {
      const inner = parsed.searchParams.get('url');
      if (inner) targetUrl = inner;
    }
  } catch { /* usar url tal cual */ }

  // Solo permitir URLs http/https
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return new NextResponse('Invalid url', { status: 400 });
  }

  // Extraer el origen de la imagen para usar como Referer (bypasea hotlink protection)
  let imageOrigin = targetUrl;
  try {
    imageOrigin = new URL(targetUrl).origin + '/';
  } catch { /* usar targetUrl */ }

  // Intentar con Referer propio del dominio de la imagen (bypass hotlink)
  const tryFetch = async (referer: string | null) => {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
    };
    if (referer) headers['Referer'] = referer;
    return fetch(targetUrl, { headers, redirect: 'follow' });
  };

  try {
    // Primer intento: Referer = mismo dominio de la imagen
    let response = await tryFetch(imageOrigin);

    // Si falla (403/hotlink), segundo intento: sin Referer
    if (!response.ok && (response.status === 403 || response.status === 401)) {
      response = await tryFetch(null);
    }

    if (!response.ok) {
      return new NextResponse(`Upstream error: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[imgproxy] Error fetching:', targetUrl, error);
    return new NextResponse('Proxy error', { status: 502 });
  }
}
