import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { API_URL } from '@/lib/api';

interface TrackSessionDto {
  vendorId: string;
  sessionId: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
  pagePath: string;
  productId?: string;
  userAgent?: string;
}

interface TrackConversionDto {
  sessionId: string;
  pagePath: string;
  productId?: string;
  vendorId?: string;
  itemsAddedToCart?: number;
  purchaseCompleted?: boolean;
  purchaseValue?: number;
  orderId?: string;
}

const SESSION_STORAGE_KEY = 'analytics_session_id';
const TRACKED_PAGE_PREFIX = 'analytics_tracked_page:';

export const useAnalytics = (vendorId?: string) => {
  const pathname = usePathname();
  const [sessionId, setSessionId] = useState<string>('');
  const analyticsUrl = useCallback((endpoint: string) => `${API_URL}${endpoint}`, []);

  const getOrCreateSessionId = useCallback((): string => {
    if (typeof window === 'undefined') return '';

    const storedSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (storedSessionId) {
      return storedSessionId;
    }

    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
    setSessionId(newSessionId);
    return newSessionId;
  }, []);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, [getOrCreateSessionId]);

  const getTrafficSource = useCallback((): string => {
    if (typeof window === 'undefined') return 'direct';

    const referrer = document.referrer;
    const url = new URL(window.location.href);
    const utmSource = url.searchParams.get('utm_source');

    if (utmSource) return utmSource.toLowerCase();
    if (referrer.includes('google.')) return 'google';
    if (referrer.includes('facebook.')) return 'social';
    if (referrer.includes('instagram.')) return 'social';
    if (referrer.includes('twitter.')) return 'social';
    if (referrer.includes('linkedin.')) return 'social';
    if (referrer.includes('t.co') || referrer.includes('tiktok.')) return 'social';

    const isStorefront = window.location.pathname.startsWith('/tiendas/');
    const isInternalReferrer = referrer ? new URL(referrer).hostname === window.location.hostname : false;
    if (!referrer) return isStorefront ? 'store_direct' : 'marketplace';
    if (isInternalReferrer) return isStorefront ? 'store_internal' : 'marketplace';

    return 'referral';
  }, []);

  const trackPageView = useCallback(
    async (productId?: string, overrideVendorId?: string) => {
      const vid = overrideVendorId || vendorId;
      const activeSessionId = sessionId || getOrCreateSessionId();
      if (!activeSessionId || !vid || typeof window === 'undefined') return;

      const pagePath = pathname || window.location.pathname;
      const dedupeKey = `${TRACKED_PAGE_PREFIX}${vid}:${pagePath}:${productId || 'page'}`;
      if (sessionStorage.getItem(dedupeKey) === activeSessionId) return;

      try {
        const url = new URL(window.location.href);
        const referrer = document.referrer;

        const trackData: TrackSessionDto = {
          vendorId: vid,
          sessionId: activeSessionId,
          source: getTrafficSource(),
          utmSource: url.searchParams.get('utm_source') || undefined,
          utmMedium: url.searchParams.get('utm_medium') || undefined,
          utmCampaign: url.searchParams.get('utm_campaign') || undefined,
          referrer: referrer || undefined,
          pagePath,
          productId,
          userAgent: navigator.userAgent,
        };

        const response = await fetch(analyticsUrl('/analytics/track-session'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(trackData),
        });
        if (response.ok) sessionStorage.setItem(dedupeKey, activeSessionId);
      } catch (error) {
        console.debug('Analytics track-session error:', error);
      }
    },
    [sessionId, pathname, vendorId, getTrafficSource, getOrCreateSessionId, analyticsUrl]
  );

  const trackAddToCart = useCallback(
    async (productId: string, quantity: number = 1, overrideVendorId?: string) => {
      const activeSessionId = sessionId || getOrCreateSessionId();
      if (!activeSessionId || typeof window === 'undefined') return;

      try {
        const trackData: TrackConversionDto = {
          sessionId: activeSessionId,
          pagePath: pathname || window.location.pathname,
          productId,
          itemsAddedToCart: quantity,
          vendorId: overrideVendorId || vendorId,
        };

        await fetch(analyticsUrl('/analytics/track-conversion'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(trackData),
        });
      } catch (error) {
        console.debug('Analytics track-conversion (cart) error:', error);
      }
    },
    [sessionId, pathname, vendorId, getOrCreateSessionId, analyticsUrl]
  );

  const trackPurchase = useCallback(
    async (orderId: string, totalAmount: number, items: Array<{ productId: string; quantity: number }>) => {
      const activeSessionId = sessionId || getOrCreateSessionId();
      if (!activeSessionId || typeof window === 'undefined') return;

      try {
        const trackData: TrackConversionDto = {
          sessionId: activeSessionId,
          pagePath: pathname || window.location.pathname,
          purchaseCompleted: true,
          purchaseValue: totalAmount,
          orderId,
          itemsAddedToCart: items.reduce((sum, item) => sum + item.quantity, 0),
        };

        await fetch(analyticsUrl('/analytics/track-conversion'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(trackData),
        });
      } catch (error) {
        console.debug('Analytics track-conversion (purchase) error:', error);
      }
    },
    [sessionId, pathname, vendorId, getOrCreateSessionId, analyticsUrl]
  );

  return {
    sessionId,
    trackPageView,
    trackAddToCart,
    trackPurchase,
  };
};
