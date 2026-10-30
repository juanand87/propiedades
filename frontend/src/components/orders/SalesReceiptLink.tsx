import { ReceiptText } from "lucide-react";
import { getBackendAssetUrl } from "@/lib/utils";

export function SalesReceiptLink({ url, qrImageUrl, token }: { url?: string | null; qrImageUrl?: string | null; token?: string | null }) {
  if (!url) return null;
  const href = token && /^[a-f0-9]{32}$/.test(token) ? `http://localhost:3000/b/${token}` : /^https?:\/\//i.test(url) ? url : getBackendAssetUrl(url);
  try { if (!["http:", "https:"].includes(new URL(href).protocol)) return null; }
  catch { return null; }
  return <div className="space-y-2">{qrImageUrl && /^https?:\/\//i.test(qrImageUrl) && <img src={qrImageUrl} alt="QR de la boleta" className="h-32 w-32 object-contain" loading="lazy" />}<a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 underline underline-offset-2">
    <ReceiptText className="h-4 w-4 shrink-0" />Ver boleta
  </a>{token && <a href={href} target="_blank" rel="noopener noreferrer" className="block break-all text-xs text-sky-700 underline">{href.replace('https://', '')}</a>}</div>;
}
