import { createHmac, timingSafeEqual } from 'crypto';

export interface EnviaTrackingWebhookData {
  trackingNumber: string;
  status: unknown;
  carrier?: string;
}

export function extractEnviaTrackingWebhook(payload: any): EnviaTrackingWebhookData {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};

  return {
    trackingNumber: String(
      data.tracking_number
      || data.trackingNumber
      || '',
    ).trim(),
    status: data.status ?? data.shipping_status ?? data.shipment_status,
    carrier: data.carrier_name || data.carrierName || data.carrier,
  };
}

export function verifyEnviaWebhookSignature(
  rawBody: Buffer,
  secret: string,
  event: string,
  timestamp: string,
  signature: string,
): boolean {
  if (!rawBody?.length || !secret || !event || !timestamp || !signature) return false;

  const providedHex = signature
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.startsWith('v1='))
    ?.slice(3);
  if (!providedHex || !/^[a-f0-9]{64}$/i.test(providedHex)) return false;

  const signedPayload = `${timestamp}.${event}.${rawBody.toString('utf8')}`;
  const expected = Buffer.from(
    createHmac('sha256', secret).update(signedPayload).digest('hex'),
    'hex',
  );
  const provided = Buffer.from(providedHex, 'hex');

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function shouldApplyEnviaShippingStatus(currentStatus: string, incomingStatus: string): boolean {
  if (!incomingStatus || incomingStatus === 'unknown') return false;
  if (!currentStatus) return true;
  if (currentStatus === incomingStatus) return false;
  if (currentStatus === 'delivered') return false;
  if (incomingStatus === 'failed') return true;

  const progress: Record<string, number> = {
    pending: 0,
    generated: 1,
    picked_up: 2,
    in_transit: 3,
    delivered: 4,
  };
  const currentProgress = progress[currentStatus];
  const incomingProgress = progress[incomingStatus];

  if (currentProgress === undefined || incomingProgress === undefined) return true;
  return incomingProgress > currentProgress;
}
