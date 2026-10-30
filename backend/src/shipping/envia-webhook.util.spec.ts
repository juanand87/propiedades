import { createHmac } from 'crypto';
import {
  extractEnviaTrackingWebhook,
  shouldApplyEnviaShippingStatus,
  verifyEnviaWebhookSignature,
} from './envia-webhook.util';

describe('Envia webhook utilities', () => {
  it('extracts legacy tracking payloads', () => {
    expect(extractEnviaTrackingWebhook({
      trackingNumber: 'ABC123',
      status: 'Delivered',
      carrierName: 'chilexpress',
    })).toEqual({
      trackingNumber: 'ABC123',
      status: 'Delivered',
      carrier: 'chilexpress',
    });
  });

  it('extracts signed v2 tracking payloads', () => {
    expect(extractEnviaTrackingWebhook({
      type: 'tracking.simple',
      data: {
        tracking_number: 'XYZ789',
        status: 'Shipped',
        carrier_name: 'starken',
      },
    })).toEqual({
      trackingNumber: 'XYZ789',
      status: 'Shipped',
      carrier: 'starken',
    });
  });

  it('verifies the HMAC signature using the raw request body', () => {
    const rawBody = Buffer.from('{"type":"tracking.simple","data":{"tracking_number":"ABC123"}}');
    const secret = 'test-secret';
    const event = 'tracking.simple';
    const timestamp = '1791428268833';
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${event}.${rawBody.toString('utf8')}`)
      .digest('hex');

    expect(verifyEnviaWebhookSignature(
      rawBody,
      secret,
      event,
      timestamp,
      `v1=${signature}`,
    )).toBe(true);
    expect(verifyEnviaWebhookSignature(
      rawBody,
      secret,
      event,
      timestamp,
      `v1=${'0'.repeat(64)}`,
    )).toBe(false);
  });

  it('ignores duplicate and regressive shipment states', () => {
    expect(shouldApplyEnviaShippingStatus('in_transit', 'in_transit')).toBe(false);
    expect(shouldApplyEnviaShippingStatus('in_transit', 'generated')).toBe(false);
    expect(shouldApplyEnviaShippingStatus('delivered', 'in_transit')).toBe(false);
    expect(shouldApplyEnviaShippingStatus('generated', 'in_transit')).toBe(true);
    expect(shouldApplyEnviaShippingStatus('in_transit', 'failed')).toBe(true);
  });
});
