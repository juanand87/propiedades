import { getImageUrl } from '@/lib/utils';

export default function ProductFormatBadge({ product }: { product: any }) {
  const format = Array.isArray(product?.formats) ? product.formats[0] : product?.format;
  const label = String(format?.name || format || product?.category || '').trim();
  if (!label) return null;

  const icon = String(format?.icon || product?.categoryIcon || '').trim();
  const isImage = icon.startsWith('/') || icon.startsWith('http');

  return (
    <div
      className="absolute left-2 top-2 z-10 flex min-h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-md bg-white/95 px-1 py-1 shadow-sm ring-1 ring-black/5"
      title={`Formato: ${label}`}
      aria-label={`Formato: ${label}`}
    >
      {isImage ? (
        <img src={getImageUrl(icon)} alt="" className="h-4 w-4 shrink-0 object-contain" />
      ) : (
        <span className={`shrink-0 text-base leading-none${icon === '💿' ? ' disc-spin' : ''}`} aria-hidden="true">
          {icon || '💿'}
        </span>
      )}
      <span className="w-full truncate text-center text-[7px] font-semibold leading-none text-gray-700">{label}</span>
    </div>
  );
}
