import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return new NextResponse('Boleta no encontrada', { status: 404 });
  try {
    const base = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
    const result = await fetch(`${base}/orders/receipts/${token}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!result.ok) return new NextResponse('Boleta no disponible', { status: result.status === 404 ? 404 : 503 });
    const { url } = await result.json();
    const target = new URL(url);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error('Invalid receipt');
    const response = NextResponse.redirect(target, 307);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  } catch { return new NextResponse('Boleta no disponible temporalmente', { status: 503 }); }
}
