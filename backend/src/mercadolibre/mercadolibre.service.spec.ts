import axios from 'axios';
import { MercadoLibreService } from './mercadolibre.service';

describe('MercadoLibreService synchronization', () => {
  afterEach(() => jest.restoreAllMocks());

  it('imports a linked Mercado Libre question without duplicating identifiers', async () => {
    const settingsRow: any = {
      vendorId: 'vendor-1',
      mercadoLibreUserId: '42907108',
      mercadoLibreAccessToken: 'access-token',
      mercadoLibreRefreshToken: 'refresh-token',
      mercadoLibreTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      mercadoLibreConfig: {},
    };
    const products = {
      findOne: jest.fn().mockResolvedValue({ id: 'product-1', mercadoLibreItemId: 'MLC2233253607' }),
    };
    const settings = {
      findOneBy: jest.fn().mockResolvedValue(settingsRow),
      save: jest.fn(async (value) => value),
    };
    const questions = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'question-local-1' })),
    };
    const questionMessages = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const service = new MercadoLibreService(
      products as any,
      settings as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      questions as any,
      questionMessages as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        total: 1,
        questions: [{
          id: 123456789,
          item_id: 'MLC2233253607',
          buyer_id: 987654321,
          status: 'UNANSWERED',
          text: '¿Está disponible?',
          date_created: '2026-10-15T10:00:00.000Z',
          answer: null,
        }],
      },
    });

    const result = await service.syncQuestions('vendor-1', false);

    expect(result).toMatchObject({ fetched: 1, imported: 1, updated: 0, unchanged: 0, unlinked: 0 });
    expect(axios.get).toHaveBeenCalledWith('https://api.mercadolibre.com/questions/search', expect.objectContaining({
      params: expect.objectContaining({ limit: 50, offset: 0, status: 'UNANSWERED' }),
    }));
    expect(questions.create).toHaveBeenCalledWith(expect.objectContaining({
      productId: 'product-1',
      vendorId: 'vendor-1',
      source: 'mercadolibre',
      externalQuestionId: '123456789',
      status: 'pending',
    }));
    expect(questionMessages.create).toHaveBeenCalledWith(expect.objectContaining({
      questionId: 'question-local-1',
      authorType: 'customer',
      content: '¿Está disponible?',
    }));
  });

  it('stores the remote item status without changing local stock or status', async () => {
    const product: any = {
      id: 'product-1',
      stock: 3,
      status: 'active',
      mercadoLibreItemId: 'MLC2233253607',
    };
    const products = {
      findOne: jest.fn().mockResolvedValue(product),
      save: jest.fn(async (value) => value),
    };
    const settings = {
      findOneBy: jest.fn().mockResolvedValue({
        vendorId: 'vendor-1',
        mercadoLibreUserId: '42907108',
        mercadoLibreAccessToken: 'access-token',
        mercadoLibreRefreshToken: 'refresh-token',
        mercadoLibreTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }),
    };
    const service = new MercadoLibreService(
      products as any,
      settings as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: { id: 'MLC2233253607', status: 'paused', sub_status: ['out_of_stock'] },
    });

    const result = await service.processNotification({
      topic: 'items',
      resource: '/items/MLC2233253607',
      user_id: 42907108,
    });

    expect(result).toMatchObject({ synchronized: true, itemId: 'MLC2233253607', status: 'paused' });
    expect(products.save).toHaveBeenCalledWith(expect.objectContaining({
      mercadoLibreStatus: 'paused',
      mercadoLibreStatusDetail: 'out_of_stock',
      stock: 3,
      status: 'active',
    }));
  });
});
