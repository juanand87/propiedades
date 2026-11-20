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
  it('warns about short generated text without inventing or changing facts', () => {
    const short = 'Casa con jardín y calefacción a leña.';
    const result = normalizeDictation(
      { fields: { title: 'Casa', description: short } },
      catalog,
    );
    expect(result.fields).toEqual({ title: 'Casa', description: short });
    expect(result.warnings.join(' ')).toContain('8 caracteres');
    expect(result.warnings.join(' ')).toContain('40 caracteres');
  });
  it('does not copy a private street address into proposed public text', () => {
    const result = normalizeDictation(
      {
        fields: {
          address: 'Calle Los Robles 123',
          title: 'Casa en Calle Los Robles 123',
          description: 'Casa familiar en Calle Los Robles 123.',
        },
      },
      catalog,
    );
    expect(result.fields.address).toBe('Calle Los Robles 123');
    expect(result.fields).not.toHaveProperty('title');
    expect(result.fields).not.toHaveProperty('description');
    expect(result.warnings.join(' ')).toContain('dirección exacta');
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
  it('extracts extended fields and only explicit catalog amenities', () => {
    const c = {
      ...catalog,
      amenities: [
        { id: 'pool', name: 'Piscina' },
        { id: 'garden', name: 'Jardín' },
        { id: 'water', name: 'Agua' },
      ],
    };
    const result = normalizeDictation(
      {
        fields: {
          summary: 'Resumen de prueba',
          usable_area: '105',
          storage_rooms: '1',
          construction_year: '2020',
          floors: '2',
          floor_number: '-2',
          condition_type: 'renovated',
          latitude: '-41.3',
          longitude: '-72.9',
          common_expenses: '2.5',
          contributions: '4',
          expense_unit: 'UF',
          contributions_period: 'yearly',
          amenities: { pool: false, garden: true, water: null, forged: true },
          show_exact_address: 'true',
        },
      },
      c,
    );
    expect(result.fields).toMatchObject({
      summary: 'Resumen de prueba',
      usable_area: '105',
      storage_rooms: '1',
      construction_year: '2020',
      floors: '2',
      floor_number: '-2',
      condition_type: 'renovated',
      latitude: '-41.3',
      longitude: '-72.9',
      common_expenses: '2.5',
      contributions: '4',
      expense_unit: 'UF',
      contributions_period: 'yearly',
      'amenity:pool': 'false',
      'amenity:garden': 'true',
    });
    expect(result.fields).not.toHaveProperty('amenity:water');
    expect(result.fields).not.toHaveProperty('amenity:forged');
    expect(result.fields).not.toHaveProperty('show_exact_address');
  });
  it('rejects incomplete geography and ambiguous expenses without guessing', () => {
    const result = normalizeDictation(
      {
        fields: {
          latitude: '-41.3',
          longitude: null,
          common_expenses: '120000',
          contributions: '50000',
          expense_unit: null,
          contributions_period: null,
          construction_year: '9999',
          floor_number: '300',
          condition_type: 'forged',
        },
      },
      catalog,
    );
    expect(result.fields).toEqual({});
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(
      normalizeDictation(
        { fields: { latitude: '-91', longitude: '200' } },
        catalog,
      ).fields,
    ).toEqual({});
    expect(
      normalizeDictation(
        { fields: { common_expenses: '0', contributions: '0' } },
        catalog,
      ).fields,
    ).toEqual({ common_expenses: '0', contributions: '0' });
    expect(
      normalizeDictation(
        { fields: { contributions: '4', expense_unit: 'UF' } },
        catalog,
      ).fields,
    ).toEqual({ expense_unit: 'UF' });
  });
  it('keeps exact coordinates out of proposed public text', () => {
    const result = normalizeDictation(
      {
        fields: {
          latitude: '-41.3',
          longitude: '-72.9',
          summary: 'Coordenadas: -41.3, -72.9',
          description: 'Propiedad en latitud -41.3 y longitud -72.9.',
        },
      },
      catalog,
    );
    expect(result.fields.latitude).toBe('-41.3');
    expect(result.fields).not.toHaveProperty('summary');
    expect(result.fields).not.toHaveProperty('description');
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
  it('uses only authorized server video audio and returns a proposal without saving or linking', async () => {
    const { service, estate } = fixture();
    const videos = {
      dictationAudio: jest.fn().mockResolvedValue({
        buffer: Buffer.alloc(100),
        originalname: 'video.m4a',
      }),
    };
    (service as any).videos = videos;
    jest
      .spyOn(service, 'validateAudio')
      .mockResolvedValue({ extension: 'm4a', duration: 6 });
    const f = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response({ text: 'Casa en Puerto Varas por 150 millones de pesos.' }),
      )
      .mockResolvedValueOnce(response(completion()));
    const result = await service.propose(actor, { video_id: 'owned-video' });
    expect(videos.dictationAudio).toHaveBeenCalledWith(actor, 'owned-video');
    expect(result.review_required).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    expect(estate.saveProperty).not.toHaveBeenCalled();
  });
  it('rejects mixed video sources and authorization failures before paid requests', async () => {
    const { service } = fixture();
    const videos = {
      dictationAudio: jest
        .fn()
        .mockRejectedValue(new Error('Este video no te pertenece.')),
    };
    (service as any).videos = videos;
    const f = jest.spyOn(global, 'fetch');
    await expect(
      service.propose(actor, { video_id: 'other', transcript: 'Otro texto' }),
    ).rejects.toThrow('solo un origen');
    expect(videos.dictationAudio).not.toHaveBeenCalled();
    await expect(service.propose(actor, { video_id: 'other' })).rejects.toThrow(
      'no te pertenece',
    );
    expect(f).not.toHaveBeenCalled();
  });
  it('keeps reviewed context and the new dictation together without saving', async () => {
    const { service, estate } = fixture();
    const f = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(response(completion()));
    const result = await service.propose(actor, {
      context_transcript:
        'Casa en Puerto Varas con tres dormitorios por 150 millones de pesos.',
      transcript: 'Además tiene dos baños y 120 metros cuadrados construidos.',
    });
    expect(result.transcript).toContain('tres dormitorios');
    expect(result.transcript).toContain('dos baños');
    const body = JSON.parse(f.mock.calls[0][1]!.body as string);
    expect(body.input[0].content).toContain('Datos previos ya revisados');
    expect(body.instructions).toContain('corrección explícita');
    expect(estate.saveProperty).not.toHaveBeenCalled();
  });
  it('rejects oversized previous context before paying for transcription', async () => {
    const { service } = fixture();
    const f = jest.spyOn(global, 'fetch');
    await expect(
      service.propose(
        actor,
        { context_transcript: 'x'.repeat(12001) },
        { buffer: Buffer.alloc(100), originalname: 'voice.m4a' },
      ),
    ).rejects.toThrow('demasiado larga');
    expect(f).not.toHaveBeenCalled();
  });
});
