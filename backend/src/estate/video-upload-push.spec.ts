import { JWT } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PushService } from './push.service';

describe('video processing completion push', () => {
  afterEach(() => jest.restoreAllMocks());
  const device = 'fcm_local_processing_token_0123456789';
  function setup() {
    jest
      .spyOn(JWT.prototype, 'getAccessToken')
      .mockResolvedValue({ token: 'local-test-access' });
    const query = jest.fn().mockResolvedValue([{ token: device }]);
    const service = new PushService(
      { query } as unknown as DataSource,
      new ConfigService({
        FIREBASE_PROJECT_ID: 'local-test',
        FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
          project_id: 'local-test',
          client_email: 'test@local-test.iam.gserviceaccount.com',
          private_key: '-----BEGIN PRIVATE KEY-----test',
        }),
      }),
    );
    return { service, query };
  }
  it.each([false, true])(
    'sends the owner a safe durable destination, failed=%s',
    async (failed) => {
      const { service } = setup();
      const network = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({
          ok: true,
          json: async () => ({ name: 'accepted' }),
        } as Response);
      expect(
        await service.videoUploadReady('owner', 'video', 'upload', failed),
      ).toBe(true);
      const payload = JSON.parse(
        network.mock.calls[0][1]!.body as string,
      ).message;
      expect(payload.token).toBe(device);
      expect(payload.data).toMatchObject({
        type: 'video_ready',
        uploadId: 'upload',
        videoId: 'video',
      });
      expect(payload.notification.title).toBe(
        failed ? 'Revisa la carga de tu video' : 'Tu video está listo',
      );
      expect(payload.android.notification.tag).toBe('video-ready-upload');
      expect(network.mock.calls[0][0]).toBe(
        'https://fcm.googleapis.com/v1/projects/local-test/messages:send',
      );
    },
  );
  it('propagates an outage so the durable worker retries later', async () => {
    const { service } = setup();
    jest.spyOn(global, 'fetch').mockRejectedValue(Error('offline'));
    await expect(
      service.videoUploadReady('owner', 'video', 'upload'),
    ).rejects.toThrow('offline');
  });
  it('removes an unregistered device without claiming delivery', async () => {
    const { service, query } = setup();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: { details: [{ errorCode: 'UNREGISTERED' }] },
        }),
      } as Response);
    expect(await service.videoUploadReady('owner', 'video', 'upload')).toBe(
      false,
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM estate_push_devices'),
      [device, 'owner'],
    );
  });
});
