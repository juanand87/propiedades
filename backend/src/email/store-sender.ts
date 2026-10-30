import type { SmtpConfig } from './email.service';

export function withStoreSender<T extends Partial<SmtpConfig>>(config: T, storeName?: string | null): T {
  const name = storeName?.replace(/[\r\n\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return name ? { ...config, fromName: name } : { ...config };
}
