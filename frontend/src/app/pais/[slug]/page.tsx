"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import ProductFilterSidebar from "@/components/ProductFilterSidebar";
import { applyThemeToDocument } from "@/lib/colorThemes";
import { getImageUrl, getProductImageByIndex } from "@/lib/utils";

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

export default function PaisPage() {
  const params = useParams();
  const paisSlug = params.slug as string;
  
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [error, setError] = useState<string>("");

  const parseImages = (images: any) => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    if (typeof images === 'string') {
      try {
        const parsed = JSON.parse(images);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return images.split(',').filter(Boolean).map((url: string, index: number) => ({
          url: url.trim(),
          isPrimary: index === 0
        }));
      }
    }
    return [];
  };

  useEffect(() => {
    if (paisSlug) {
      loadPaisProducts();
    }
  }, [paisSlug]);

  const loadPaisProducts = async () => {
    try {
      setLoading(true);
      
      const marketplaceSettings = await api.getVendorSettings(MARKETPLACE_VENDOR_ID, false);
      setSettings(marketplaceSettings);

      if (marketplaceSettings?.colorTheme) {
        applyThemeToDocument(marketplaceSettings.colorTheme);
      }

      // Cargar productos filtrados por país
      const productsData = await api.getProducts({ 
        marketplaceOnly: true,
        country: paisSlug
      });
      
      const productsList = Array.isArray(productsData) 
        ? productsData 
        : (productsData.products || productsData.data || []);
      
      setProducts(productsList);
      setLoading(false);
    } catch (error: any) {
      console.error("Error loading país products:", error);
      setError(error.message || "Error al cargar los productos");
      setLoading(false);
    }
  };

  const renderHeader = () => {
    if (!settings) return null;

    const vendor = {
      id: MARKETPLACE_VENDOR_ID,
      slug: "marketplace",
      storeName: settings?.storeName || "Marketplace",
      phone: settings?.phone || "",
      email: settings?.email || ""
    };

    const headerType = settings?.headerType 
      ? (typeof settings.headerType === 'number' ? `type${settings.headerType}` : settings.headerType)
      : "type1";

    switch (headerType) {
      case "type1":
        return <HeaderType1 vendor={vendor} config={settings || {}} slug="marketplace" />;
      case "type2":
        return <HeaderType2 vendor={vendor} config={settings || {}} slug="marketplace" />;
      case "type3":
        return <HeaderType3 vendor={vendor} config={settings || {}} slug="marketplace" />;
      default:
        return <HeaderType1 vendor={vendor} config={settings || {}} slug="marketplace" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando país...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        {renderHeader()}
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const gridColumns = settings?.productGridColumns || 4;
  const countryName = products[0]?.country || paisSlug.replace(/-/g, ' ').toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {renderHeader()}

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">País: {countryName}</h1>
          <p className="text-gray-500 mt-2">{products.length} productos encontrados</p>
        </div>

        {products.length > 0 ? (
          <div className={`grid grid-cols-1 md:grid-cols-${gridColumns} gap-6`}>
            {products.map((product) => {
              const primaryImage = getProductImageByIndex(product, 0, 'thumb');
              const secondImage = getProductImageByIndex(product, 1, 'thumb');
              const hasRollover = settings?.imageRolloverEnabled && secondImage;
              
              return (
                <Card key={product.id} className="hover:shadow-lg transition-shadow h-full group cursor-pointer">
                  <CardContent className="p-0">
                    <div className="relative h-48 w-full rounded-t-lg shrink-0">
                      <Link href={`/productos/${product.slug || product.id}`}>
                        <div className="absolute inset-0 overflow-hidden rounded-t-lg">
                          {primaryImage ? (
                            <>
                              <img 
                                src={getImageUrl(primaryImage)}
                                alt={product.title} 
                                className={`h-full w-full object-cover transition-opacity duration-300 ${
                                  hasRollover ? 'group-hover:opacity-0' : ''
                                }`}
                              />
                              {hasRollover && (
                                <img 
                                  src={getImageUrl(secondImage)}
                                  alt={`${product.title} - Vista 2`}
                                  className="absolute top-0 left-0 h-full w-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                />
                              )}
                            </>
                          ) : (
                            <div className="bg-gradient-to-br from-purple-100 to-blue-100 h-full flex items-center justify-center">
                              <span className="text-4xl">🎵</span>
                            </div>
                          )}
                        </div>
                      </Link>
                      {(product as any).categoryIcon && (
                        <div className="absolute top-2 right-2 bg-white/90 shadow-md rounded-lg p-2 z-20 group/badge">
                          {(product as any).categoryIcon.startsWith('/') || (product as any).categoryIcon.startsWith('http') ? (
                            <img src={getImageUrl((product as any).categoryIcon)} alt={(product as any).category || ''} className="w-6 h-6 object-contain" />
                          ) : (
                            <span className="text-xl">{(product as any).categoryIcon}</span>
                          )}
                          {(product as any).category && (
                            <span className="pointer-events-none absolute hidden group-hover/badge:block bg-gray-800 text-white text-xs font-normal rounded px-2 py-1 whitespace-nowrap top-1/2 -translate-y-1/2 right-full mr-2 z-30">{(product as any).category}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <Link href={`/productos/${product.slug || product.id}`}>
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-2 line-clamp-2">{product.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{product.artist}</p>
                      <p className="text-lg font-bold text-purple-600">
                        ${product.price?.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No hay productos de este país</p>
          </div>
        )}
      </div>

      {settings?.footerConfig ? (
        <StoreFooter footerConfig={settings.footerConfig} />
      ) : (
        <footer className="bg-gray-900 text-white py-8 mt-12">
          <div className="container mx-auto px-4 text-center">
            <p>© {new Date().getFullYear()} {settings?.storeName || 'Marketplace'}. Todos los derechos reservados.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
