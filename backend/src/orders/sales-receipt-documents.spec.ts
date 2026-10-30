import axios from 'axios';
import sharp from 'sharp';
import { SalesReceiptDocumentsService } from './sales-receipt-documents.service';

jest.mock('axios');
const get = axios.get as jest.Mock;
const pdfUrl = 'https://eboleta.s3.amazonaws.com/prod/pdf/boleta.pdf?Signature=example';

describe('QR receipt document storage', () => {
  let service: SalesReceiptDocumentsService;
  let storage: any;
  let image: Express.Multer.File;
  beforeEach(async () => {
    get.mockReset();
    storage = { uploadFile: jest.fn(async file => ({ url: `https://cdn.example.com/${file.originalname}` })) };
    service = new SalesReceiptDocumentsService(storage);
    image = { buffer: await sharp({ create: { width: 10, height: 10, channels: 3, background: 'white' } }).png().toBuffer() } as Express.Multer.File;
  });
  it('saves the QR and PDF, with both email attachments', async () => {
    get.mockResolvedValue({ data: Buffer.from('%PDF-1.4 test') });
    const saved = await service.prepare(pdfUrl, image);
    expect(saved.receiptUrl).toBe('https://cdn.example.com/boleta.pdf');
    expect(saved.qrImageUrl).toBe('https://cdn.example.com/qr.png');
    expect(saved.pdfSaved).toBe(true);
    expect(saved.attachments).toEqual(expect.arrayContaining([
      expect.objectContaining({ cid: 'boleta-qr', contentType: 'image/png', content: expect.any(Buffer) }),
      expect.objectContaining({ filename: 'boleta.pdf', contentType: 'application/pdf', content: expect.any(Buffer) }),
    ]));
    expect(get).toHaveBeenCalledWith(pdfUrl, expect.objectContaining({ maxRedirects: 0, timeout: 10000, maxContentLength: 10485760, proxy: false }));
  });
  it.each(['https://127.0.0.1/boleta.pdf', 'http://eboleta.s3.amazonaws.com/a.pdf', 'https://eboleta.s3.amazonaws.com.evil.test/a.pdf', 'https://example.com/a.pdf', 'https://eboleta.s3.amazonaws.com:444/a.pdf'])('does not fetch unapproved URLs: %s', async url => {
    const result = await service.prepare(url, image);
    expect(get).not.toHaveBeenCalled();
    expect(result.receiptUrl).toBe(url);
    expect(result.pdfSaved).toBe(false);
  });
  it('preserves the original URL when the download fails', async () => {
    get.mockRejectedValue(new Error('expired URL'));
    const saved = await service.prepare(pdfUrl, image);
    expect(saved.receiptUrl).toBe(pdfUrl);
    expect(saved.attachments).toHaveLength(1);
  });
  it('rejects a response that is not a PDF', async () => {
    get.mockResolvedValue({ data: Buffer.from('<html>not a PDF</html>') });
    expect((await service.prepare(pdfUrl, image)).pdfSaved).toBe(false);
  });
  it('rejects invalid images before storing them', async () => {
    await expect(service.prepare(pdfUrl, { buffer: Buffer.from('bad image') } as Express.Multer.File)).rejects.toThrow();
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });
  it('keeps the PDF attached if permanent PDF storage fails', async () => {
    get.mockResolvedValue({ data: Buffer.from('%PDF-1.4 test') });
    storage.uploadFile.mockImplementation(async file => { if (file.originalname.endsWith('.pdf')) throw new Error('storage failure'); return { url: 'https://cdn.example.com/qr.png' }; });
    const result = await service.prepare(pdfUrl, image);
    expect(result.pdfSaved).toBe(false);
    expect(result.receiptUrl).toBe(pdfUrl);
    expect(result.attachments).toHaveLength(2);
  });
});
