"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Music, ShoppingCart, Store, Star } from "lucide-react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { ShortDescriptionText, GOLDMINE_DESCRIPTIONS } from "@/lib/goldmineTooltips";
import { useCart } from "@/contexts/CartContext";
import MusicPreloader from "@/components/MusicPreloader";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<any>(null);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const data = await api.getProduct(id);
      console.log("Product loaded:", data);
      setProduct(data);
      
      // Load vendor layout settings
      const vendorId = data.vendorId || data.vendor?.id;
      
      if (vendorId) {
        console.log("Loading settings for vendorId:", vendorId);
        const settings = await api.getVendorSettings(vendorId);
        console.log("Settings loaded:", settings);
        
        if (settings.productPageLayout) {
          console.log("Applying layout:", settings.productPageLayout);
          setLayout(settings.productPageLayout);
        } else {
          console.log("No productPageLayout found in settings");
        }
      } else {
        console.log("No vendorId in product, checked:", { vendorId: data.vendorId, vendorObj: data.vendor });
      }
    } catch (error: any) {
      console.error("Error loading product:", error);
      setError(error.message || "Error al cargar el producto");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white/80 flex items-center justify-center">
        <MusicPreloader title="Cargando producto" storeName="MundoBeat.cl" message="Preparando el ritmo..." />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-red-500">{error || "Producto no encontrado"}</div>
      </div>
    );
  }

  // Default layout if none configured
  const defaultLayout = {
    left: [{ id: "gallery", enabled: true, order: 1 }],
    rightTop: [
      { id: "title", enabled: true, order: 1 },
      { id: "short-description", enabled: true, order: 2 },
      { id: "price", enabled: true, order: 3 },
      { id: "add-to-cart", enabled: true, order: 4 },
      { id: "buy-now", enabled: true, order: 5 },
    ],
    bottom: [
      { id: "tabs", enabled: true, order: 1 },
    ],
  };

  const activeLayout = layout || defaultLayout;
  
  console.log("Active layout being used:", activeLayout);
  console.log("Layout state:", layout);

  // Render section components
  const renderSection = (section: any, area: string) => {
    if (!section.enabled) return null;

    switch (section.id) {
      case "gallery":
        return <GallerySection key={section.id} product={product} />;
      case "title":
        return <TitleSection key={section.id} product={product} />;
      case "short-description":
        return <ShortDescriptionSection key={section.id} product={product} />;
      case "price":
        return <PriceSection key={section.id} product={product} />;
      case "add-to-cart":
        return <AddToCartButton key={section.id} product={product} />;
      case "buy-now":
        return <BuyNowButton key={section.id} product={product} />;
      case "spotify-player":
        return <SpotifyPlayer key={section.id} product={product} area={area} />;
      case "tabs":
        return <TabsSection key={section.id} product={product} />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-8">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {activeLayout.left
            ?.filter((s: any) => s.enabled)
            .sort((a: any, b: any) => a.order - b.order)
            .map((section: any) => renderSection(section, "left"))}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {activeLayout.rightTop
            ?.filter((s: any) => s.enabled)
            .sort((a: any, b: any) => a.order - b.order)
            .map((section: any) => renderSection(section, "right-top"))}
        </div>
      </div>

      {/* BOTTOM FULL WIDTH */}
      <div className="space-y-6">
        {activeLayout.bottom
          ?.filter((s: any) => s.enabled)
          .sort((a: any, b: any) => a.order - b.order)
          .map((section: any) => renderSection(section, "bottom"))}
      </div>
    </div>
  );
}

// Section Components
function GallerySection({ product }: { product: any }) {
  return (
    <div>
      <div className="bg-gray-200 rounded-lg aspect-square flex items-center justify-center mb-4 overflow-hidden">
        {product.images && product.images.length > 0 ? (
          <img 
            src={product.images[0]} 
            alt={product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <Music className="h-32 w-32 text-gray-400" />
        )}
      </div>
      {product.images && product.images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {product.images.slice(0, 4).map((img: string, i: number) => (
            <div key={i} className="bg-gray-200 rounded aspect-square flex items-center justify-center cursor-pointer hover:border-2 border-primary overflow-hidden">
              <img src={img} alt={`${product.title} ${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TitleSection({ product }: { product: any }) {
  return (
    <div>
      <Badge className="mb-2 capitalize">{product.type}</Badge>
      <h1 className="text-4xl font-bold mb-2">{product.title}</h1>
      {product.artist && <h2 className="text-2xl text-gray-600 mb-4">{product.artist}</h2>}
      
      <div className="flex items-center gap-2">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star 
              key={star} 
              className={`h-5 w-5 ${star <= Math.floor(product.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
            />
          ))}
        </div>
        <span className="text-gray-600">({product.rating || 0})</span>
      </div>
    </div>
  );
}

function ShortDescriptionSection({ product }: { product: any }) {
  if (!product.shortDescription) return null;
  
  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
      <p className="text-gray-700 text-sm whitespace-pre-line"><ShortDescriptionText text={product.shortDescription} /></p>
    </div>
  );
}

function PriceSection({ product }: { product: any }) {
  return (
    <div className="text-4xl font-bold">
      {formatPrice(product.isOnSale && product.salePrice ? product.salePrice : product.price)}
      {product.isOnSale && product.salePrice && (
        <span className="text-xl text-gray-400 line-through ml-3">{formatPrice(product.price)}</span>
      )}
    </div>
  );
}

function AddToCartButton({ product }: { product: any }) {
  const { addItem } = useCart();
  
  const handleAddToCart = () => {
    console.log('[ADD TO CART] Adding product:', {
      productId: product.id,
      vendorId: product.vendor?.id || product.vendorId,
      vendorSlug: product.vendor?.slug || product.vendorSlug,
    });
    
    addItem({
      productId: product.id,
      title: product.title,
      artist: product.artist,
      price: product.price,
      imageUrl: product.imageUrl,
      stock: product.stock,
      vendorId: product.vendor?.id || product.vendorId || '',
      vendorSlug: product.vendor?.slug || product.vendorSlug || '',
    });
  };

  return (
    <Button 
      className="w-full bg-gradient-to-r from-purple-500 to-blue-500" 
      size="lg"
      disabled={product.stock === 0}
      onClick={handleAddToCart}
    >
      <ShoppingCart className="mr-2 h-5 w-5" />
      {product.stock > 0 ? 'Agregar al carrito' : 'Sin stock'}
    </Button>
  );
}

function BuyNowButton({ product }: { product: any }) {
  return (
    <Button 
      variant="outline" 
      className="w-full border-2 border-purple-500 text-purple-600 hover:bg-purple-50" 
      size="lg"
      disabled={product.stock === 0}
    >
      Comprar ahora
    </Button>
  );
}

function SpotifyPlayer({ product, area }: { product: any; area: string }) {
  if (!product.spotifyUrl) return null;

  if (area === "right-top") {
    return (
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 bg-white/20 rounded flex items-center justify-center">
            <Music className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-white font-semibold text-sm">{product.album || product.title}</div>
            <div className="text-white/80 text-xs">{product.artist}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6">
      <h3 className="text-white font-bold text-lg mb-4">Escuchar en Spotify</h3>
      <div className="aspect-[16/9] bg-white/10 rounded-lg flex items-center justify-center">
        <Music className="h-16 w-16 text-white/50" />
      </div>
    </div>
  );
}

function TabsSection({ product }: { product: any }) {
  const [activeTab, setActiveTab] = useState("description");

  const tabs = [
    { id: "description", label: "Descripción" },
    { id: "tracklist", label: "Listado de Temas" },
    { id: "specs", label: "Datos Técnicos" },
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "description" && (
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-line">{product.description || "Sin descripción disponible."}</p>
            </div>
          )}

          {activeTab === "tracklist" && (
            <div className="space-y-2">
              {product.tracklist && product.tracklist.length > 0 ? (
                product.tracklist.map((track: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center font-semibold text-purple-700">
                      {i + 1}
                    </div>
                    <div className="flex-1">{track.title || track}</div>
                    {track.duration && <div className="text-gray-500">{track.duration}</div>}
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No hay listado de canciones disponible.</p>
              )}
            </div>
          )}

          {activeTab === "specs" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {product.condition && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Condición:</span>
                  <span className="font-semibold capitalize">{product.condition === 'used' ? 'Usado' : product.condition === 'new' ? 'Nuevo' : product.condition.replace('_', ' ')}</span>
                </div>
              )}
              {product.mediaGrade && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Media (Disco):</span>
                  <span className="font-semibold underline decoration-dotted cursor-help" title={GOLDMINE_DESCRIPTIONS[product.mediaGrade] || product.mediaGrade}>{product.mediaGrade}</span>
                </div>
              )}
              {product.sleeveGrade && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Sleeve (Portada):</span>
                  <span className="font-semibold underline decoration-dotted cursor-help" title={GOLDMINE_DESCRIPTIONS[product.sleeveGrade] || product.sleeveGrade}>{product.sleeveGrade}</span>
                </div>
              )}
              {product.year && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Año:</span>
                  <span className="font-semibold">{product.year}</span>
                </div>
              )}
              {product.label && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Sello:</span>
                  <span className="font-semibold">{product.label}</span>
                </div>
              )}
              {product.country && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">País:</span>
                  <span className="font-semibold">{product.country}</span>
                </div>
              )}
              {product.genre && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Género:</span>
                  <span className="font-semibold">{product.genre}</span>
                </div>
              )}
              {product.format && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Formato:</span>
                  <span className="font-semibold">{product.format}</span>
                </div>
              )}
              {product.rpm && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">RPM:</span>
                  <span className="font-semibold">{product.rpm}</span>
                </div>
              )}
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Stock:</span>
                <span className={`font-semibold ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
