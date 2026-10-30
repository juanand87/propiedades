"use client";

import { getImageUrl } from "@/lib/utils";

interface StoreHeaderBadgeProps {
  store?: any;
}

export default function StoreHeaderBadge({ store }: StoreHeaderBadgeProps) {
  if (!store) return null;

  const storeName = store.storeName || store.name || store.slug || "Tienda";
  const logo = store.logo || store.logoUrl || store.imageUrl;

  return (
    <div className="flex items-center gap-2 min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
      {logo ? (
        <img
          src={getImageUrl(logo)}
          alt={storeName}
          className="h-9 w-9 rounded-md object-contain bg-white flex-shrink-0"
        />
      ) : (
        <div className="h-9 w-9 rounded-md theme-gradient-bg text-white flex items-center justify-center font-bold flex-shrink-0">
          {String(storeName).charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-bold text-gray-900">{storeName}</p>
        <p className="truncate text-xs text-gray-500">Tienda en MundoBeat</p>
      </div>
    </div>
  );
}
