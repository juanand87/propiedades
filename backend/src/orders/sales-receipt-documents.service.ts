import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';
import { StorageService } from '../storage/storage.service';
import { EmailAttachment } from '../email/email.service';
import { validateSalesReceiptUrl } from './sales-receipt-url';

export function receiptShortUrl(token: string) {
  return `${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/b/${token}`;
}

@Injectable()
export class SalesReceiptDocumentsService {
  constructor(private readonly storage: StorageService) {}

  private absolute(url: string) {
    const base = (process.env.API_PUBLIC_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/api\/?$/, '').replace(/\/$/, '');
    return url.startsWith('/uploads/') ? `${base}${url}` : url;
  }

  async downloadPdf(url: string): Promise<Buffer | null> {
    const parsed = new URL(validateSalesReceiptUrl(url));
    // Only this known document provider is fetched. Other QR links remain usable without server-side fetching.
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'eboleta.s3.amazonaws.com' || (parsed.port && parsed.port !== '443') || !parsed.pathname.endsWith('.pdf')) return null;
    try {
      const response = await axios.get<ArrayBuffer>(parsed.href, { responseType: 'arraybuffer', timeout: 10000, maxRedirects: 0, maxContentLength: 10 * 1024 * 1024, maxBodyLength: 10 * 1024 * 1024, proxy: false });
      const buffer = Buffer.from(response.data);
      return buffer.length <= 10 * 1024 * 1024 && buffer.subarray(0, 5).toString() === '%PDF-' ? buffer : null;
    } catch { return null; }
  }

  async prepare(url: string, file: Express.Multer.File) {
    url = validateSalesReceiptUrl(url);
    let qr: Buffer;
    try { qr = await sharp(file.buffer, { limitInputPixels: 16000000 }).rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).png().toBuffer(); }
    catch { throw new BadRequestException('La imagen del QR no es válida o es demasiado grande'); }
    const image = await this.storage.uploadFile({ originalname: 'qr.png', mimetype: 'image/png', buffer: qr }, 'comprobantes/boletas/qr');
    const attachments: EmailAttachment[] = [{ filename: 'qr-boleta.png', content: qr, contentType: 'image/png', cid: 'boleta-qr' }];
    const pdf = await this.downloadPdf(url);
    let receiptUrl = url;
    let pdfSaved = false;
    if (pdf) {
      try {
        const document = await this.storage.uploadFile({ originalname: 'boleta.pdf', mimetype: 'application/pdf', buffer: pdf }, 'comprobantes/boletas');
        receiptUrl = this.absolute(document.url);
        attachments.push({ filename: 'boleta.pdf', content: pdf, contentType: 'application/pdf' });
        pdfSaved = true;
      } catch { /* Keep the original signed link and attach the downloaded PDF even if storage failed. */
        attachments.push({ filename: 'boleta.pdf', content: pdf, contentType: 'application/pdf' });
      }
    }
    return { receiptUrl, qrImageUrl: this.absolute(image.url), attachments, pdfSaved };
  }
}
