import { ConfigService } from '@nestjs/config';
import { PropertyDictationService } from './property-dictation.service';
import { dictationSchema, normalizeDictation } from './property-dictation';
import { assertConnectionAllowed } from '../config/project-isolation';

const catalog = {
  types: [
    { id: 'house', name: 'Casa' },
    { id: 'apartment', name: 'Departamento' },
  ],
  regions: [
    { id: 10, name: 'Región de Los Lagos' },
    { id: 13, name: 'Región Metropolitana' },
  ],
  communes: [
    { id: 1, region_id: 10, name: 'Puerto Varas' },
    { id: 2, region_id: 13, name: 'Santiago' },
    { id: 3, region_id: 10, name: 'Nombre repetido' },
    { id: 4, region_id: 13, name: 'Nombre repetido' },
  ],
};
const actor: any = { id: 'owner', role: 'vendor', advertiser_id: 'advertiser' };
const proposal = {
  fields: {
    type_id: 'house',
    operation_type: 'rent',
    price_amount: '850000',
    price_unit: 'CLP',
    bedrooms: '3',
    bathrooms: '2',
    built_area: '120',
    land_area: '300',
    commune_name: 'puerto varas',
    title: 'Casa en Puerto Varas',
    description: 'Casa con tres dormitorios, dos baños y calefacción a leña.',
  },
  warnings: [],
};
const response = (body: any, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;
const completion = (value: any = proposal) => ({
  status: 'completed',
  output: [
    {
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify(value) }],
    },
  ],
});
function fixture(enabled = true) {
  const estate: any = {
    catalog: jest.fn(async () => catalog),
    throttle: jest.fn(),
    saveProperty: jest.fn(),
    db: { query: jest.fn() },
  };
  return {
    estate,
    service: new PropertyDictationService(
      new ConfigService({
        PROPERTY_DICTATION_ENABLED: String(enabled),
        OPENAI_API_KEY: 'test-key',
      }),
      estate,
    ),
  };
}
describe('Property dictation proposals', () => {
  afterEach(() => jest.restoreAllMocks());
  it('maps official geography, retains numeric zero, drops all non-form keys', () => {
    const result = normalizeDictation(
      {
        fields: {
          ...proposal.fields,
          parking: '0',
          publication_status: 'published',
          advertiser_id: 'other',
          media_ids: ['x'],
        },
      },
      catalog,
    );
    expect(result.fields).toMatchObject({
      region_id: '10',
      commune_id: '1',
      parking: '0',
      price_amount: '850000',
      operation_type: 'rent',
    });
    expect(result.fields).not.toHaveProperty('publication_status');
    expect(result.fields).not.toHaveProperty('advertiser_id');
    expect(result.fields).not.toHaveProperty('media_ids');
  });
  it('does not guess ambiguous locations or override a conflicting region', () => {
    expect(
      normalizeDictation(
        { fields: { commune_name: 'Nombre repetido' } },
        catalog,
      ).fields,
    ).not.toHaveProperty('commune_id');
    const conflicting = normalizeDictation(
      {
        fields: { region_name: 'Metropolitana', commune_name: 'Puerto Varas' },
      },
      catalog,
    );
    expect(conflicting.fields).toEqual({ region_id: '13' });
    expect(conflicting.warnings.length).toBeGreaterThan(0);
  });
  it('rejects invalid quantities, separators, missing currency and forged types', () => {
    const result = normalizeDictation(
      {
        fields: {
          price_amount: '150.000.000',
          price_unit: 'CLP',
          bedrooms: '-2',
          bathrooms: '1001',
          built_area: 'NaN',
          type_id: 'forged',
        },
      },
      catalog,
    );
    expect(result.fields).toEqual({ price_unit: 'CLP' });
    expect(
      normalizeDictation({ fields: { price_amount: '150000000' } }, catalog)
        .fields,
    ).toEqual({});
    expect(
      normalizeDictation(
        { fields: { price_amount: '3500.5', price_unit: 'UF' } },
        catalog,
      ).fields.price_amount,
    ).toBe('3500.5');
  });
  it('keeps absent fields absent and schema forbids extra properties', () => {
    expect(normalizeDictation({ fields: {} }, catalog).fields).toEqual({});
    expect(dictationSchema(['house']).additionalProperties).toBe(false);
    expect(() => normalizeDictation(null, catalog)).toThrow();
  });
  it('never contacts IA when disabled or user is not allowed', async () => {
    const fetcher = jest.spyOn(global, 'fetch');
    await expect(
      fixture(false).service.propose(actor, { transcript: 'Una casa grande' }),
    ).rejects.toThrow('no está configurado');
    await expect(
      fixture().service.propose({ id: 'buyer', role: 'customer' } as any, {
        transcript: 'Una casa grande',
      }),
    ).rejects.toThrow('vendedor');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('returns only a reviewable proposal and does not save a property', async () => {
    const { estate, service } = fixture();
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(response(completion()));
    const result = await service.propose(actor, {
      transcript:
        'Arriendo casa en Puerto Varas, tres dormitorios, dos baños por 850 mil pesos.',
    });
    expect(result).toMatchObject({
      review_required: true,
      fields: {
        price_amount: '850000',
        operation_type: 'rent',
        commune_id: '1',
      },
    });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(options!.body as string);
    expect(body.store).toBe(false);
    expect(body.text.format.strict).toBe(true);
    expect(body).not.toHaveProperty('tools');
    expect(estate.saveProperty).not.toHaveBeenCalled();
    expect(estate.db.query).not.toHaveBeenCalled();
  });
  it('transcribes the bounded audio then interprets it without retaining it', async () => {
    const { service } = fixture();
    jest
      .spyOn(service, 'validateAudio')
      .mockResolvedValue({ extension: 'm4a', duration: 6 });
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response({ text: 'Casa en Puerto Varas por 150 millones de pesos.' }),
      )
      .mockResolvedValueOnce(response(completion()));
    const result = await service.propose(
      actor,
      {},
      { buffer: Buffer.alloc(100), originalname: 'voice.m4a' },
    );
    expect(result.transcript).toContain('Puerto Varas');
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual([
      'https://api.openai.com/v1/audio/transcriptions',
      'https://api.openai.com/v1/responses',
    ]);
    expect((fetcher.mock.calls[0][1]!.body as FormData).get('model')).toBe(
      'gpt-transcribe',
    );
  });
  it('does not expose provider errors or retry paid requests automatically', async () => {
    const { service } = fixture();
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(response({ error: 'secret-provider-detail' }, 429));
    await expect(
      service.propose(actor, { transcript: 'Casa en Puerto Varas' }),
    ).rejects.toThrow('no tiene saldo');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('clears active request lock after incomplete provider output', async () => {
    const { service } = fixture();
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(response({ status: 'incomplete' }));
    await expect(
      service.propose(actor, { transcript: 'Casa en Puerto Varas' }),
    ).rejects.toThrow('no completó');
    fetcher.mockResolvedValue(response(completion()));
    await expect(
      service.propose(actor, { transcript: 'Casa en Puerto Varas' }),
    ).resolves.toHaveProperty('review_required', true);
  });
  it('rejects concurrent duplicate proposals', async () => {
    const { service } = fixture();
    let finish!: (value: Response) => void;
    const fetcher = jest.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = service.propose(actor, {
      transcript: 'Casa en Puerto Varas',
    });
    await Promise.resolve();
    await expect(
      service.propose(actor, { transcript: 'Casa en Puerto Varas' }),
    ).rejects.toThrow('Ya hay un dictado');
    finish(response(completion()));
    await first;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects oversized text and invalid audio before any provider request', async () => {
    const { service } = fixture();
    const fetcher = jest.spyOn(global, 'fetch');
    await expect(
      service.propose(actor, { transcript: 'x'.repeat(12001) }),
    ).rejects.toThrow('demasiado larga');
    await expect(
      service.validateAudio({
        buffer: Buffer.alloc(20),
        originalname: 'a.m4a',
      }),
    ).rejects.toThrow();
    await expect(
      service.validateAudio({
        buffer: Buffer.alloc(100),
        originalname: 'a.exe',
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('allows only the configured HTTPS OpenAI host while other integrations stay blocked', () => {
    const env = {
      PROJECT_ID: 'propiedades',
      DB_HOST: 'localhost',
      DB_PORT: '3327',
      PROPERTY_DICTATION_ENABLED: 'true',
      OPENAI_API_KEY: 'test',
      INTEGRATIONS_ENABLED: 'false',
    };
    expect(() =>
      assertConnectionAllowed([443, 'api.openai.com'], env),
    ).not.toThrow();
    for (const host of ['openai.com', 'api.openai.com.evil.test', 'evil.test'])
      expect(() => assertConnectionAllowed([443, host], env)).toThrow();
    expect(() =>
      assertConnectionAllowed([80, 'api.openai.com'], env),
    ).toThrow();
    expect(() =>
      assertConnectionAllowed([443, 'api.openai.com'], {
        ...env,
        PROPERTY_DICTATION_ENABLED: 'false',
      }),
    ).toThrow();
  });
});
