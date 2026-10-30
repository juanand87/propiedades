"use client";
import { getProductPrice } from "@/lib/productSeo";

import { useState, useEffect, use, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Music, ShoppingCart, Store, Star, ArrowLeft, ChevronLeft, ChevronRight, AlignLeft, List, Cpu, Truck, Mic2, Clock, RotateCcw, Heart, Share2, MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { getImageUrl, getProductImageByIndex } from "@/lib/utils";
import { ShortDescriptionText, GOLDMINE_DESCRIPTIONS } from "@/lib/goldmineTooltips";
import { getCategoryUrl, getProductsUrl, getStoreUrl } from "@/lib/useCustomDomain";
import { useAnalytics } from "@/hooks/useAnalytics";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import LateralMenu, { shouldShowLateralMenu } from "@/components/LateralMenu";
import { useCart } from "@/contexts/CartContext";
import { usePathname } from "next/navigation";
import MusicPreloader from "@/components/MusicPreloader";
import ProductQuestions from "@/components/ProductQuestions";
import ProductFormatBadge from "@/components/ProductFormatBadge";

export default function ProductDetailPage({ params, initialContent }: { params: Promise<{ slug: string; id: string }>; initialContent?: React.ReactNode }) {
  const { slug, id } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const { addItem } = useCart();
  const { trackPageView, trackAddToCart } = useAnalytics();
  const [product, setProduct] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [productVendor, setProductVendor] = useState<any>(null); // Vendor del producto (puede ser diferente al marketplace)
  const [settings, setSettings] = useState<any>(null);
  const [layout, setLayout] = useState<any>(null);
  const [tabsOrder, setTabsOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [activeTracklistTab, setActiveTracklistTab] = useState<string>('General');
  const [isMobile, setIsMobile] = useState(false);
  const [prevProductId, setPrevProductId] = useState<string | null>(null);
  const [nextProductId, setNextProductId] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [animationClass, setAnimationClass] = useState<string>('');
  const [preloadedProducts, setPreloadedProducts] = useState<{[key: string]: any}>({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritesEnabled, setFavoritesEnabled] = useState(true);
  const preloadingRef = useRef<Set<string>>(new Set());
  const loadingAdjacentRef = useRef<boolean>(false);
  const pageRootRef = useRef<HTMLDivElement>(null);
  const productInfoBarRef = useRef<HTMLDivElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImageIndex, setLightboxImageIndex] = useState(0);
  const [tracklistExpanded, setTracklistExpanded] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [activeDetailsTab, setActiveDetailsTab] = useState<string | null>(null);

  const openQuestionsTab = () => {
    setActiveDetailsTab('questions-tab');
    if (typeof window !== 'undefined') {
      window.setTimeout(() => document.getElementById('preguntas')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#preguntas') {
      openQuestionsTab();
    }
  }, [product?.id]);

  // Helper para parsear imágenes
  const parseImages = (images: any) => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    try {
      return JSON.parse(images);
    } catch {
      return [];
    }
  };

  useEffect(() => {
    loadData();
  }, [id, slug]);

  useEffect(() => {
    if (!product?.id || typeof window === 'undefined') return;
    setIsFavorite(getFavoriteIds().includes(product.id));
  }, [product?.id]);

  useEffect(() => {
    const pageRoot = pageRootRef.current;
    if (loading || !pageRoot || typeof window === 'undefined') return;

    const stickyHeader = pageRoot.querySelector('header');
    const infoBar = productInfoBarRef.current;
    let frameId: number | null = null;

    const updateStickyOffsets = () => {
      frameId = null;
      const headerHeight = settings?.headerConfig?.stickyHeader === false
        ? 0
        : stickyHeader?.getBoundingClientRect().height || 0;
      const infoBarHeight = infoBar?.getBoundingClientRect().height || 0;

      pageRoot.style.setProperty('--product-info-sticky-top', `${headerHeight + 12}px`);
      pageRoot.style.setProperty('--product-purchase-sticky-top', `${headerHeight + infoBarHeight + 24}px`);
    };

    const requestUpdate = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(updateStickyOffsets);
    };

    const resizeObserver = new ResizeObserver(requestUpdate);
    if (stickyHeader) resizeObserver.observe(stickyHeader);
    if (infoBar) resizeObserver.observe(infoBar);
    window.addEventListener('resize', requestUpdate);
    requestUpdate();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', requestUpdate);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [loading, product?.id, settings?.headerType, settings?.headerConfig?.stickyHeader]);

  const getFavoriteIds = () => {
    if (typeof window === 'undefined') return [] as string[];
    const keys = ['mundobeat:favorites', 'favoriteProductIds', 'favorites'];
    for (const key of keys) {
      try {
        const value = JSON.parse(window.localStorage.getItem(key) || '[]');
        if (Array.isArray(value)) {
          return value.map((item) => typeof item === 'string' ? item : item?.id || item?.productId).filter(Boolean);
        }
      } catch {}
    }
    return [];
  };

  const toggleFavorite = () => {
    if (!product?.id || typeof window === 'undefined') return;
    const ids = getFavoriteIds();
    const nextIds = ids.includes(product.id) ? ids.filter((item) => item !== product.id) : [...ids, product.id];
    window.localStorage.setItem('mundobeat:favorites', JSON.stringify(nextIds));
    window.localStorage.setItem('favoriteProductIds', JSON.stringify(nextIds));
    window.dispatchEvent(new CustomEvent('favorites:updated', { detail: nextIds }));
    setIsFavorite(nextIds.includes(product.id));
  };

  const shareProduct = async () => {
    if (typeof window === 'undefined' || !product) return;
    const shareData = {
      title: product.title,
      text: product.artist ? `${product.title} - ${product.artist}` : product.title,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Enlace copiado');
      }
    } catch {}
  };

  useEffect(() => {
    if (vendor && product) {
      loadingAdjacentRef.current = false; // Reset flag cuando cambia el producto
      loadAdjacentProducts();
    }
  }, [vendor?.id, product?.id]);

  const loadAdjacentProducts = async () => {
    try {
      if (!vendor?.id || !product?.id) return;
      
      // Evitar llamadas duplicadas
      if (loadingAdjacentRef.current) return;
      loadingAdjacentRef.current = true;
      
      // Obtener lista de productos del vendor para encontrar anterior/siguiente
      const response = await api.getProducts({
        vendorId: vendor.id,
        limit: 1000, // Cargar todos para encontrar posición
      });
      
      const products = response.products || [];
      const currentIndex = products.findIndex((p: any) => p.id === product.id);
      
      if (currentIndex > 0) {
        const prevId = products[currentIndex - 1].id;
        setPrevProductId(prevId);
      } else {
        setPrevProductId(null);
      }
      
      if (currentIndex < products.length - 1 && currentIndex !== -1) {
        const nextId = products[currentIndex + 1].id;
        setNextProductId(nextId);
      } else {
        setNextProductId(null);
      }

      // Precargar productos después de actualizar los IDs
      setTimeout(() => preloadAdjacentProducts(), 100);
    } catch (error) {
      console.error('Error loading adjacent products:', error);
    } finally {
      loadingAdjacentRef.current = false;
    }
  };

  // Precargar productos adyacentes en segundo plano
  const preloadAdjacentProducts = async () => {
    try {
      // Precargar siguiente producto
      if (nextProductId && !preloadedProducts[nextProductId] && !preloadingRef.current.has(nextProductId)) {
        console.log('🔄 Precargando siguiente producto:', nextProductId);
        preloadingRef.current.add(nextProductId);
        
        api.getProduct(nextProductId).then(product => {
          console.log('✅ Producto siguiente cargado:', product.title);
          setPreloadedProducts(prev => ({ ...prev, [nextProductId]: product }));
          preloadingRef.current.delete(nextProductId);
          
          // Precargar imágenes del producto de forma agresiva
          const images = parseImages(product.images);
          console.log('🖼️ Precargando', images.length, 'imágenes del siguiente producto');
          
          images.forEach((img: string, index: number) => {
            const imageUrl = getImageUrl(img);
            const image = new window.Image();
            image.onload = () => console.log(`✅ Imagen ${index + 1}/${images.length} cargada`);
            image.onerror = () => console.log(`❌ Error cargando imagen ${index + 1}`);
            image.src = imageUrl;
            
            // También hacer fetch para forzar cache del navegador
            fetch(imageUrl, { mode: 'no-cors', cache: 'force-cache' }).catch(() => {});
          });
        }).catch(error => {
          console.error('Error precargando siguiente:', error);
          preloadingRef.current.delete(nextProductId);
        });
      }
      
      // Precargar producto anterior
      if (prevProductId && !preloadedProducts[prevProductId] && !preloadingRef.current.has(prevProductId)) {
        console.log('🔄 Precargando producto anterior:', prevProductId);
        preloadingRef.current.add(prevProductId);
        
        api.getProduct(prevProductId).then(product => {
          console.log('✅ Producto anterior cargado:', product.title);
          setPreloadedProducts(prev => ({ ...prev, [prevProductId]: product }));
          preloadingRef.current.delete(prevProductId);
          
          // Precargar imágenes del producto de forma agresiva
          const images = parseImages(product.images);
          console.log('🖼️ Precargando', images.length, 'imágenes del producto anterior');
          
          images.forEach((img: string, index: number) => {
            const imageUrl = getImageUrl(img);
            const image = new window.window.Image();
            image.onload = () => console.log(`✅ Imagen ${index + 1}/${images.length} cargada`);
            image.onerror = () => console.log(`❌ Error cargando imagen ${index + 1}`);
            image.src = imageUrl;
            
            // También hacer fetch para forzar cache del navegador
            fetch(imageUrl, { mode: 'no-cors', cache: 'force-cache' }).catch(() => {});
          });
        }).catch(error => {
          console.error('Error precargando anterior:', error);
          preloadingRef.current.delete(prevProductId);
        });
      }
    } catch (error) {
      console.error('Error preloading products:', error);
    }
  };

  const navigateToProduct = async (productId: string, direction: 'next' | 'prev') => {
    if (navigating) return;
    
    setNavigating(true);
    console.log('🎬 Navegando a producto:', productId, 'dirección:', direction);
    console.log('📦 Productos precargados disponibles:', Object.keys(preloadedProducts));
    
    try {
      // Aplicar animación de salida
      setAnimationClass(direction === 'next' ? 'slide-out-left' : 'slide-out-right');
      
      // Esperar que termine la animación
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Usar producto precargado si existe, sino cargarlo
      const newProduct = preloadedProducts[productId] || await api.getProduct(productId);
      console.log('✅ Producto cargado:', newProduct.title);
      setProduct(newProduct);
      setSelectedImageIndex(0);
      setActiveTracklistTab('General');
      
      // Limpiar producto precargado del cache
      if (preloadedProducts[productId]) {
        console.log('🧹 Limpiando cache del producto:', productId);
        setPreloadedProducts(prev => {
          const updated = { ...prev };
          delete updated[productId];
          return updated;
        });
      }
      
      // Aplicar animación de entrada desde el lado opuesto
      setAnimationClass(direction === 'next' ? 'slide-in-right' : 'slide-in-left');
      
      // Actualizar URL
      if (typeof window !== 'undefined') {
        const cleanUrl = window.location.hostname !== 'localhost' &&
                        window.location.hostname !== '127.0.0.1' &&
                        window.location.hostname !== 'mundobeat.cl' &&
                        window.location.hostname !== 'www.mundobeat.cl' &&
                        !window.location.hostname.includes('vercel.app')
          ? `/productos/${productId}`
          : `/tiendas/${slug}/productos/${productId}`;
        
        window.history.pushState({}, '', cleanUrl);
      }
      
      // Scroll y limpiar animación
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await new Promise(resolve => setTimeout(resolve, 300));
      setAnimationClass('');
      
      // Actualizar productos adyacentes
      await loadAdjacentProducts();
      
    } catch (error) {
      console.error('Error loading product:', error);
      router.push(getStoreUrl(slug, `/productos/${productId}`));
    } finally {
      setNavigating(false);
    }
  };

  // Helper para obtener iconos de campos
  const getFieldIcon = (fieldName: string, product: any, categoryIcon?: string) => {
    switch(fieldName) {
      case 'format':
        // Usar el icono de la categoría si existe
        if (categoryIcon) {
          const isImagePath = categoryIcon.startsWith('/icons/') || 
                              categoryIcon.startsWith('http') || 
                              categoryIcon.includes('digitaloceanspaces.com');
          if (isImagePath) {
            return <img src={getImageUrl(categoryIcon)} alt="format" className="w-4 h-4 object-contain" />;
          }
        }
        return '💿'; // Fallback emoji
      case 'country':
        // Mapeo de países a banderas
        const countryFlags: Record<string, string> = {
          'Chile': '🇨🇱',
          'US': '🇺🇸',
          'USA': '🇺🇸',
          'United States': '🇺🇸',
          'Estados Unidos': '🇺🇸',
          'UK': '🇬🇧',
          'United Kingdom': '🇬🇧',
          'Reino Unido': '🇬🇧',
          'England': '🇬🇧',
          'Argentina': '🇦🇷',
          'Brazil': '🇧🇷',
          'Brasil': '🇧🇷',
          'Mexico': '🇲🇽',
          'México': '🇲🇽',
          'Spain': '🇪🇸',
          'España': '🇪🇸',
          'France': '🇫🇷',
          'Francia': '🇫🇷',
          'Germany': '🇩🇪',
          'Alemania': '🇩🇪',
          'Italy': '🇮🇹',
          'Italia': '🇮🇹',
          'Japan': '🇯🇵',
          'Japón': '🇯🇵',
          'Canada': '🇨🇦',
          'Canadá': '🇨🇦',
          'Australia': '🇦🇺',
          'Netherlands': '🇳🇱',
          'Holanda': '🇳🇱',
          'Belgium': '🇧🇪',
          'Bélgica': '🇧🇪',
          'Sweden': '🇸🇪',
          'Suecia': '🇸🇪',
          'Norway': '🇳🇴',
          'Noruega': '🇳🇴',
          'Denmark': '🇩🇰',
          'Dinamarca': '🇩🇰',
          'Portugal': '🇵🇹',
          'Austria': '🇦🇹',
          'Switzerland': '🇨🇭',
          'Suiza': '🇨🇭',
          'Ireland': '🇮🇪',
          'Irlanda': '🇮🇪',
          'Poland': '🇵🇱',
          'Polonia': '🇵🇱',
          'Russia': '🇷🇺',
          'Rusia': '🇷🇺',
          'China': '🇨🇳',
          'Korea': '🇰🇷',
          'Corea': '🇰🇷',
          'South Korea': '🇰🇷',
          'India': '🇮🇳',
        };
        return countryFlags[product?.country] || '🌍'; // Bandera específica o globo terráqueo
      case 'artist':
        return '🎤'; // Micrófono
      case 'album':
        return '💿'; // Disco/álbum
      case 'label':
        return null; // Sin icono según requisitos
      case 'year':
        return null; // Sin icono según requisitos
      default:
        return null;
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!product || (!prevProductId && !nextProductId)) return;

    const previousOffset = document.documentElement.style.getPropertyValue('--floating-cart-bottom-offset');
    document.documentElement.style.setProperty('--floating-cart-bottom-offset', '5.75rem');

    return () => {
      if (previousOffset) {
        document.documentElement.style.setProperty('--floating-cart-bottom-offset', previousOffset);
      } else {
        document.documentElement.style.removeProperty('--floating-cart-bottom-offset');
      }
    };
  }, [product, prevProductId, nextProductId]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const images = parseImages(product?.images);
      
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setLightboxImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
      } else if (e.key === 'ArrowRight') {
        setLightboxImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, product]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar vendor por slug
      const foundVendor = await api.getVendorBySlug(slug);
      setVendor(foundVendor);
      
      // Cargar configuraciones del vendor
      const vendorSettings = await api.getVendorSettings(foundVendor.id, false);
      setSettings(vendorSettings);
      api.getMarketplaceSettings()
        .then((marketplaceSettings) => setFavoritesEnabled(marketplaceSettings.favoritesEnabled !== false))
        .catch(() => setFavoritesEnabled(true));
      console.log("Vendor Settings:", vendorSettings);
      console.log("productInfoBar config:", vendorSettings?.productInfoBar);
      console.log("Spotify Enabled:", vendorSettings?.spotifyEnabled);
      
      // Aplicar tema de colores
      if (vendorSettings?.colorTheme) {
        const { applyThemeToDocument } = await import('@/lib/colorThemes');
        applyThemeToDocument(vendorSettings.colorTheme, vendorSettings.customColors);
      }
      
      // Cargar producto
      const data = await api.getProduct(id);
      if (data.status !== "active") {
        throw new Error("Producto no disponible");
      }
      console.log("📦 Product data:", data);
      console.log("📦 Product category:", data?.category);
      console.log("📦 Product categoryId:", data?.categoryId);
      
      // El backend ya devuelve las categorías con el producto
      // Si tiene múltiples categorías, usar la primera como categoría principal
      if (data.categories && data.categories.length > 0 && !data.category) {
        data.category = data.categories[0];
        console.log("✅ Category from product.categories:", data.category);
      }
      console.log("Product type:", data?.type);
      console.log("Product format:", data?.format);
      console.log("Product label:", data?.label);
      console.log("Product year:", data?.year);
      console.log("Product country:", data?.country);
      console.log("Product condition:", data?.condition);
      console.log("Product mediaGrade:", data?.mediaGrade);
      console.log("Product sleeveGrade:", data?.sleeveGrade);
      console.log("Spotify Album ID:", data?.spotifyAlbumId);
      
      // Cargar orden de columna derecha
      if (vendorSettings?.productPageRightColumnOrder) {
        console.log("✅ Right column order encontrado:", vendorSettings.productPageRightColumnOrder);
        setLayout(vendorSettings.productPageRightColumnOrder);
      } else {
        console.log("⚠️ No custom order found, using default");
        // Orden por defecto
        setLayout([
          { id: "title", name: "Título del Producto", enabled: true, order: 1 },
          { id: "price", name: "Precio", enabled: true, order: 2 },
          { id: "short-description", name: "Descripción Corta", enabled: true, order: 3 },
          { id: "product-details", name: "Detalles del Producto (Goldmine)", enabled: true, order: 4 },
          { id: "product-actions", name: "Botones de acción", enabled: true, order: 5 },
          { id: "description", name: "Descripción", enabled: true, order: 7 },
          { id: "spotify-player", name: "Reproductor Spotify", enabled: true, order: 8 },
        ]);
      }

      // Cargar orden de pestañas
      if (vendorSettings?.productPageTabsOrder) {
        console.log("✅ Tabs order encontrado:", vendorSettings.productPageTabsOrder);
        // Migrar tracklist a tracklist-tab si es necesario
        const migratedTabs = vendorSettings.productPageTabsOrder.map((tab: any) =>
          tab.id === 'tracklist' ? { ...tab, id: 'tracklist-tab' } : tab
        );
        setTabsOrder(migratedTabs);
      } else {
        console.log("⚠️ No custom tabs order, using default");
        setTabsOrder([
          { id: "tracklist-tab", name: "Listado de Temas", enabled: true, order: 1 },
          { id: "description-tab", name: "Descripción", enabled: true, order: 2 },
          { id: "technical", name: "Datos Técnicos", enabled: true, order: 3 },
        ]);
      }
      
      console.log("Product vendorId:", data.vendorId);
      console.log("Vendor id:", foundVendor.id);
      console.log("Match:", data.vendorId === foundVendor.id);
      
      // Verificar que el producto pertenece a este vendor
      if (data.vendorId && foundVendor.id && data.vendorId !== foundVendor.id) {
        throw new Error("Este producto no pertenece a esta tienda");
      }
      
      setProduct(data);
      // Track page view para analytics - pasar foundVendor.id directamente porque el estado aún no se actualizó
      trackPageView(id, foundVendor.id);
      // Registrar visita (sin esperar —no bloquea la carga)
      api.trackProductView(data.id || id);

      // Cargar productos relacionados por género o categoría
      try {
        const genreId = data?.genres?.[0]?.id;
        const categoryId = data?.category?.id || data?.categories?.[0]?.id;
        const filters: any = { vendorId: foundVendor.id };
        if (genreId) filters.genreId = genreId;
        else if (categoryId) filters.categoryId = categoryId;
        const relData = await api.getProducts(filters);
        const relList = Array.isArray(relData) ? relData : relData.products || relData.data || [];
        setRelatedProducts(relList.filter((p: any) => p.id !== data.id).slice(0, 6));
      } catch {}

    } catch (error: any) {
      console.error("Error loading product:", error);
      setError(error.message || "Error al cargar el producto");
    } finally {
      setLoading(false);
    }
  };

  // Función para renderizar header (debe estar antes de los returns)
  const renderHeader = () => {
    if (!settings?.headerType || !vendor) return null;
    
    const headerProps = {
      vendor,
      settings,
      slug: vendor.slug || slug,
      config: {
        ...(settings.headerConfig || {}),
        menus: settings.menus || {},
        customMenus: settings.customMenus || {},
        headerConfig: settings.headerConfig || {},
      },
    };

    switch (settings.headerType) {
      case 1:
        return <HeaderType1 {...headerProps} />;
      case 2:
        return <HeaderType2 {...headerProps} />;
      case 3:
        return <HeaderType3 {...headerProps} />;
      default:
        return <HeaderType1 {...headerProps} />;
    }
  };

  if (loading || !vendor || !settings) {
    if (initialContent) return initialContent;
    return (
      <div className="min-h-screen bg-white/80 flex items-center justify-center">
        <MusicPreloader title="Cargando producto" storeName={vendor?.storeName || vendor?.name || slug || "MundoBeat.cl"} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        {renderHeader()}
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="text-red-500 mb-4">{error || "Producto no encontrado"}</div>
          <Link href={`/tiendas/${slug}`}>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a la tienda
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Funciones de renderizado para cada sección de la columna derecha
  const renderTitle = () => (
    <div key="title" className="border-b border-gray-200 pb-4">
      <h1 className="text-2xl lg:text-3xl font-bold leading-tight mb-2">{product.title}</h1>
      {/* Rating de estrellas */}
      <div className="flex items-center gap-1 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
        ))}
        <span className="text-sm text-gray-500 ml-1">(28)</span>
      </div>
    </div>
  );

  const renderPrice = () => {
    const formatPrice = (price: number) => {
      return Math.round(price).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const isNew = product.condition === 'new';

    return (
      <div key="price">
        {/* Precio */}
        <div className="flex items-baseline gap-2 lg:gap-3 mb-3">
          <span className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--color-primary, #9333ea)' }}>
            ${formatPrice(getProductPrice(product))}
          </span>
          {getProductPrice(product) < Number(product.price) && (
            <span className="text-base lg:text-lg text-gray-400 line-through">${formatPrice(product.price)}</span>
          )}
        </div>

        {/* Condición y Stock - misma línea */}
        <div className="flex items-center gap-4 flex-wrap pb-1">
          {product.condition && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-green-700">
                {isNew ? 'Nuevo / Sellado' : 'Usado'}
              </span>
            </div>
          )}
          {Number(product.stock) <= 0 && <p className="font-medium text-gray-600">Agotado</p>}
          {product.stock > 0 && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-green-700">
                Stock disponible ({product.stock} {product.stock === 1 ? 'unidad' : 'unidades'})
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  const renderShortDescription = () => (
    product.shortDescription ? (
      <div key="short-description" className="border-y border-gray-200 py-4">
        <p className="text-xs lg:text-sm text-gray-700 whitespace-pre-line leading-relaxed"><ShortDescriptionText text={product.shortDescription} /></p>
      </div>
    ) : null
  );

  const renderProductActions = () => {
    const thumbImage = getProductImageByIndex(product, 0, 'thumb');
    const imageUrl = thumbImage ? getImageUrl(thumbImage) : undefined;
    
    return (
      <div key="product-actions" className="space-y-2">
        <button 
          className="w-full text-white font-semibold py-3 rounded-sm transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
          style={{ background: 'var(--color-primary, #008a12)' }}
          disabled={Number(product.stock) <= 0}
          onClick={() => {
            api.trackProductCart(product.id);
            trackAddToCart(product.id, 1, vendor.id);
            addItem({
              productId: product.id,
              title: product.title,
              artist: product.artist,
              price: getProductPrice(product),
              imageUrl: imageUrl,
              stock: product.stock || 1,
              vendorId: vendor.id,
              vendorSlug: slug,
            });
          }}
        >
          <ShoppingCart className="h-5 w-5" />
          {product.stock > 0 ? 'Añadir al carrito' : 'Sin stock'}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={shareProduct}
            className="flex items-center justify-center gap-2 rounded-sm border bg-white/50 px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-white"
            style={{ borderColor: 'var(--color-primary, #9333ea)' }}
          >
            <Share2 className="h-5 w-5" />
            Compartir
          </button>
          {favoritesEnabled && (
          <button
            type="button"
            aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            onClick={toggleFavorite}
            className="flex items-center justify-center gap-2 rounded-sm border bg-white/50 px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-white"
            style={{ borderColor: 'var(--color-primary, #9333ea)', color: isFavorite ? 'var(--color-primary, #9333ea)' : undefined }}
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
            Añadir a la lista de deseos
          </button>
          )}
        </div>
      </div>
    );
  };

  const renderDescription = () => (
    product.description ? (
      <div key="description" className="p-3 lg:p-4 bg-white rounded-lg border mb-3 lg:mb-4">
        <p className="text-xs lg:text-sm text-gray-700 whitespace-pre-line leading-relaxed">{product.description}</p>
      </div>
    ) : null
  );

  const renderSpotifyPlayer = () => (
    product.spotifyEnabled && product.spotifyAlbumId ? (
      <div key="spotify-player" className="border-t border-gray-200 pt-4">
        <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Escuchar en Spotify</h3>
        <iframe
          src={`https://open.spotify.com/embed/album/${product.spotifyAlbumId}?utm_source=generator&theme=0`}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="rounded-lg"
        ></iframe>
      </div>
    ) : null
  );

  const renderTracklist = () => {
    if (!product.tracklist) return null;

    // Parsear lados del tracklist detectando patrones como A1, A2, B1, B2, C1, C2, etc.
    const lines = product.tracklist.split('\n');
    const sides: Record<string, string[]> = {};
    let currentSide = 'General';

    lines.forEach((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Detectar patrones como "A1.", "B2.", "C1.", etc. al inicio o después del número
      // Ejemplos: "1.A1. Song", "A1. Song", "1. A1 Song"
      // Soporta hasta 10 lados (A-J) para 5 discos
      const sideMatch = trimmed.match(/[A-J]\d+/i);
      
      if (sideMatch) {
        const sideCode = sideMatch[0].toUpperCase();
        // Extraer solo la letra (A, B, C, D, E, F, G, H, I, J)
        const sideLetter = sideCode.match(/[A-J]/i)?.[0];
        if (sideLetter) {
          currentSide = `Lado ${sideLetter.toUpperCase()}`;
          if (!sides[currentSide]) {
            sides[currentSide] = [];
          }
        }
      }

      // Agregar la línea al lado actual
      if (!sides[currentSide]) {
        sides[currentSide] = [];
      }
      sides[currentSide].push(trimmed);
    });

    const sideKeys = Object.keys(sides).filter(side => sides[side].length > 0);
    
    // Establecer la primera pestaña si no hay una activa
    if (activeTracklistTab === 'General' && sideKeys.length > 0 && !sides['General']) {
      setActiveTracklistTab(sideKeys[0]);
    }

    const currentTab = activeTracklistTab || sideKeys[0] || 'General';

    return (
      <div key="tracklist" className="bg-white rounded-lg border mb-3 lg:mb-4 overflow-hidden">
        <button
          onClick={() => setTracklistExpanded(!tracklistExpanded)}
          className="w-full px-3 lg:px-4 py-2 lg:py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <h3 className="text-xs lg:text-sm font-semibold text-gray-700">🎵 Listado de Temas</h3>
          <svg 
            className={`w-4 h-4 lg:w-5 lg:h-5 text-gray-600 transition-transform duration-200 ${tracklistExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {tracklistExpanded && (
          <>
            {/* Tabs de lados */}
            {sideKeys.length > 1 && (
              <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
                {sideKeys.map((side) => (
                  <button
                    key={side}
                    onClick={() => setActiveTracklistTab(side)}
                    className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      currentTab === side
                        ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {side}
                  </button>
                ))}
              </div>
            )}

            {/* Contenido del lado activo */}
            <div className="p-2 lg:p-3">
              <div className="space-y-0.5 text-xs">
                {sides[currentTab]?.map((track: string, index: number) => (
                  <div key={index} className="flex gap-2 py-0.5">
                    <span className="text-gray-700">{track}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderProductDetails = () => {
    const hasGoldmineData = product.mediaGrade || product.sleeveGrade;
    const isNew = product.condition === 'new';
    const isUsed = product.condition === 'used';
    
    // Si no hay datos de condición ni Goldmine, no mostrar
    if (!product.condition && !hasGoldmineData) return null;
    
    // Si es nuevo sin datos Goldmine, no mostrar
    if (isNew && !hasGoldmineData) return null;

    return (
      <div key="product-details" className="p-3 lg:p-4 bg-white rounded-lg border mb-3 lg:mb-4">
        <h3 className="text-xs lg:text-sm font-semibold text-gray-700 mb-2 lg:mb-3">Condición del Producto</h3>
        <div className="space-y-1.5 lg:space-y-2 text-xs lg:text-sm">
          {/* Mostrar condición si existe */}
          {product.condition && (
            <div className="flex justify-between">
              <span className="text-gray-600">Estado:</span>
              <span className="font-medium capitalize">{isNew ? 'Nuevo' : 'Usado'}</span>
            </div>
          )}
          
          {/* Mostrar escalas Goldmine si existen (independiente de condition) */}
          {hasGoldmineData && (
            <>
              {product.mediaGrade && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Media (Disco):</span>
                  <span className="font-medium underline decoration-dotted cursor-help" title={GOLDMINE_DESCRIPTIONS[product.mediaGrade] || product.mediaGrade}>{product.mediaGrade}</span>
                </div>
              )}
              {product.sleeveGrade && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Sleeve (Portada):</span>
                  <span className="font-medium underline decoration-dotted cursor-help" title={GOLDMINE_DESCRIPTIONS[product.sleeveGrade] || product.sleeveGrade}>{product.sleeveGrade}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // Mapa de funciones de renderizado
  const sectionRenderers: Record<string, () => React.ReactNode> = {
    'title': renderTitle,
    'price': renderPrice,
    'short-description': renderShortDescription,
    'product-details': renderProductDetails,
    'product-actions': renderProductActions,
    'add-to-cart': renderProductActions,
    'buy-now': () => null,
    'description': renderDescription,
    'tracklist': renderTracklist,
    'tracklist-block': renderTracklist, // Soporte para ambos IDs
    'spotify-player': renderSpotifyPlayer,
  };

  // Default layout si no hay configuración
  const defaultLayout = {
    left: [{ id: "gallery", enabled: true, order: 1 }],
    rightTop: [
      { id: "title", enabled: true, order: 1 },
      { id: "price", enabled: true, order: 2 },
      { id: "product-actions", enabled: true, order: 3 },
      { id: "description", enabled: true, order: 5 },
      { id: "spotify-player", enabled: true, order: 6 },
    ],
    bottom: [
      { id: "tabs", enabled: true, order: 1 },
    ],
  };

  const activeLayout = layout || defaultLayout;
  console.log("🎨 Using layout:", activeLayout);

  // Determinar si mostrar menú lateral (incluye categoría del producto)
  const productCategorySlug = product?.category?.slug || null;
  console.log("🔍 Product category slug:", productCategorySlug);
  console.log("🔍 Settings menus lateral:", settings?.menus?.lateral);
  console.log("🔍 Visibility config:", settings?.menus?.lateral?.visibility);
  
  const showLateralMenu = settings?.menus?.lateral && product
    ? shouldShowLateralMenu(
        settings.menus.lateral, 
        pathname, 
        slug, 
        undefined, 
        undefined, 
        undefined,
        productCategorySlug
      )
    : false;
    
  console.log("🎯 Show lateral menu in product:", showLateralMenu);

  const productCategory = product.category || product.categories?.[0];
  const breadcrumbItems = [
    { label: "Inicio", href: getStoreUrl(slug) },
    { label: "Productos", href: getProductsUrl(slug) },
    ...(productCategory?.slug
      ? [{ label: productCategory.name || "Categoria", href: getCategoryUrl(slug, productCategory.slug) }]
      : []),
    { label: product.title },
  ];
  const stickyPurchasePanel = settings?.productPageLayout?.stickyPurchasePanel !== false;

  return (
    <div ref={pageRootRef} className="min-h-screen bg-gray-50 pb-24">
      <style>{`
        [data-state="active"][role="tab"] {
          color: #2563eb !important;
          border-bottom-color: #2563eb !important;
        }
      `}</style>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideOutLeft {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-100%); opacity: 0; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .slide-out-left {
          animation: slideOutLeft 0.3s ease-out forwards;
        }
        .slide-out-right {
          animation: slideOutRight 0.3s ease-out forwards;
        }
        .slide-in-left {
          animation: slideInLeft 0.3s ease-out forwards;
        }
        .slide-in-right {
          animation: slideInRight 0.3s ease-out forwards;
        }
      `}} />
      
      
      {/* Header de la tienda */}
      {vendor && renderHeader()}

      <div className="container mx-auto px-3 lg:px-4 py-4 lg:py-8 space-y-4 lg:space-y-6">
        <nav aria-label="Breadcrumb" className="text-xs lg:text-sm text-gray-500">
          <ol className="flex flex-wrap items-center gap-2">
            {breadcrumbItems.map((item, index) => {
              const isLast = index === breadcrumbItems.length - 1;
              return (
                <li key={`${item.label}-${index}`} className={`${isLast ? 'hidden sm:flex' : 'flex'} min-w-0 items-center gap-2`}>
                  {index > 0 && <span className="text-gray-300">/</span>}
                  {item.href && !isLast ? (
                    <Link href={item.href} className="hover:text-gray-900 hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="max-w-[210px] truncate font-medium text-gray-700 sm:max-w-none">{item.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className={`${showLateralMenu && !isMobile ? 'lg:flex gap-6' : ''}`}>
          {/* Menú Lateral Desktop - Costado (solo visible en lg+) */}
          {showLateralMenu && !isMobile && (
            <aside className={`hidden lg:block ${settings.menus.lateral.position === 'left' ? 'lg:order-1' : 'lg:order-2'} lg:w-64 flex-shrink-0`}>
              <div className="sticky top-4">
                <LateralMenu config={settings.menus.lateral} vendorSlug={slug} />
              </div>
            </aside>
          )}

          {/* Contenedor de transición */}
          <div className={`${showLateralMenu && !isMobile ? (settings.menus.lateral.position === 'left' ? 'lg:order-2' : 'lg:order-1') + ' lg:flex-1' : 'w-full'}`}>
            {/* Contenedor de producto con animación */}
            <div className={animationClass}>
        {/* Barra informativa superior - Mostrar si tiene datos musicales y está habilitada */}
        {(product.format || product.genre || product.label || product.year || product.country || product.album) && 
         (settings?.productInfoBar?.enabled !== false) && (
          <div
            ref={productInfoBarRef}
            className="bg-white rounded-lg border shadow-sm mb-4 lg:mb-6 px-3 lg:px-6 py-3 lg:py-4 lg:sticky lg:z-40"
            style={{ top: 'var(--product-info-sticky-top, 1rem)' }}
          >
            <div className="flex items-center justify-between gap-2 lg:gap-4 text-xs lg:text-sm text-gray-700 flex-wrap">
              {/* Campos alineados a la izquierda - Respetar configuración del dashboard */}
              <div className="flex items-center gap-3 flex-wrap">
                {(() => {
                  // Campos configurados o valores por defecto
                  const leftFields = settings?.productInfoBar?.leftFields || ['format', 'label', 'year'];
                  const showIcons = settings?.productInfoBar?.showIcons !== false; // Por defecto true
                  const categoryIcon = product.category?.icon;
                  const fields = [];

                  if (leftFields.includes('format') && product.format) {
                    const icon = showIcons ? getFieldIcon('format', product, categoryIcon) : null;
                    fields.push(
                      <span key="format" className="flex items-center gap-2 text-gray-600">
                        {icon && (
                          typeof icon === 'string' 
                            ? <span className="text-base">{icon}</span>
                            : icon
                        )}
                        {product.format.split(/[,(]/)[0].trim()}
                      </span>
                    );
                  }
                  if (leftFields.includes('label') && product.label) {
                    const icon = showIcons ? getFieldIcon('label', product) : null;
                    fields.push(
                      <span key="label" className="flex items-center gap-2 text-gray-600">
                        {icon && <span className="text-base">{icon}</span>}
                        {product.label}
                      </span>
                    );
                  }
                  if (leftFields.includes('year') && product.year) {
                    const icon = showIcons ? getFieldIcon('year', product) : null;
                    fields.push(
                      <span key="year" className="flex items-center gap-2 text-gray-600">
                        {icon && <span className="text-base">{icon}</span>}
                        {product.year}
                      </span>
                    );
                  }
                  if (leftFields.includes('country') && product.country) {
                    const icon = showIcons ? getFieldIcon('country', product) : null;
                    fields.push(
                      <span key="country" className="flex items-center gap-2 text-gray-600">
                        {icon && <span className="text-base">{icon}</span>}
                        {product.country}
                      </span>
                    );
                  }
                  if (leftFields.includes('artist') && product.artist) {
                    const icon = showIcons ? getFieldIcon('artist', product) : null;
                    fields.push(
                      <span key="artist" className="flex items-center gap-2 text-gray-600">
                        {icon && <span className="text-base">{icon}</span>}
                        {product.artist}
                      </span>
                    );
                  }
                  if (leftFields.includes('album') && product.album) {
                    const icon = showIcons ? getFieldIcon('album', product) : null;
                    fields.push(
                      <span key="album" className="flex items-center gap-2 font-semibold text-gray-900">
                        {icon && <span className="text-base">{icon}</span>}
                        {product.album}
                      </span>
                    );
                  }

                  // Intercalar separadores
                  return fields.map((field, index) => (
                    <span key={`field-${index}`} className="flex items-center gap-3">
                      {field}
                      {index < fields.length - 1 && <span className="text-gray-300 flex items-center">|</span>}
                    </span>
                  ));
                })()}
              </div>

              {/* Campos alineados a la derecha - Respetar configuración del dashboard */}
              <div className="flex items-center gap-4 flex-wrap ml-auto">
                {(() => {
                  // Campos configurados o valores por defecto (solo goldmine)
                  const rightFields = settings?.productInfoBar?.rightFields || ['goldmine'];
                  const showGoldmine = rightFields.includes('goldmine') && (product.mediaGrade || product.sleeveGrade);
                  
                  console.log('🔍 Info Bar Debug:', {
                    rightFields,
                    showGoldmine,
                    mediaGrade: product.mediaGrade,
                    sleeveGrade: product.sleeveGrade
                  });

                  return (
                    <>
                      {/* Escala Goldmine */}
                      {showGoldmine && (
                        <div className="flex items-center gap-2 px-2 lg:px-3 py-1.5 lg:py-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center gap-2 text-[10px] lg:text-xs">
                            {product.mediaGrade && (
                              <div className="flex items-center gap-1">
                                <span
                                  className="relative h-4 w-4 shrink-0 rounded-full border-2 border-amber-600 bg-amber-50 after:absolute after:left-1/2 after:top-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-amber-600"
                                  title="Estado del disco"
                                  aria-label="Estado del disco"
                                />
                                <span className="px-1.5 lg:px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded cursor-help" title={GOLDMINE_DESCRIPTIONS[product.mediaGrade] || product.mediaGrade}>{product.mediaGrade}</span>
                              </div>
                            )}
                            {product.sleeveGrade && (
                              <div className="flex items-center gap-1">
                                <span
                                  className="h-4 w-4 shrink-0 rounded-sm border-2 border-orange-600 bg-orange-50"
                                  title="Estado de la portada"
                                  aria-label="Estado de la portada"
                                />
                                <span className="px-1.5 lg:px-2 py-0.5 bg-orange-100 text-orange-800 font-bold rounded cursor-help" title={GOLDMINE_DESCRIPTIONS[product.sleeveGrade] || product.sleeveGrade}>{product.sleeveGrade}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)] gap-6 lg:gap-12 ${stickyPurchasePanel ? 'lg:relative' : ''}`}>
          {/* Product Images */}
          <div className="flex justify-center">
            {(() => {
              const images = parseImages(product.images);
              const selectedLarge = getProductImageByIndex(product, selectedImageIndex, 'large') || getProductImageByIndex(product, selectedImageIndex, 'thumb');
              const mainImage = selectedLarge ? getImageUrl(selectedLarge) : null;
              
              return (
                <div className="flex gap-2 lg:gap-4 w-full">
                  {/* Thumbnails - Side Left */}
                  {images.length > 1 && (
                    <div className="flex flex-col gap-2">
                      {images.map((img: any, i: number) => {
                        const rawThumb = getProductImageByIndex(product, i, 'thumb') || getProductImageByIndex(product, i, 'large');
                        const thumbUrl = rawThumb ? getImageUrl(rawThumb) : '/placeholder-product.png';
                        return (
                          <div
                            key={i}
                            onClick={() => setSelectedImageIndex(i)}
                            className={`relative bg-white rounded aspect-square w-16 h-16 lg:w-20 lg:h-20 flex items-center justify-center cursor-pointer hover:border-2 hover:border-purple-500 overflow-hidden flex-shrink-0 ${
                              selectedImageIndex === i ? 'border-2 border-purple-600' : 'border'
                            }`}
                          >
                            <img src={thumbUrl} alt={`${product.title} ${i + 1}`} className="h-full w-full object-cover" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Main Image */}
                  <div className="flex-1">
                    <div 
                      className="relative bg-white rounded-lg aspect-square flex items-center justify-center overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        setLightboxImageIndex(selectedImageIndex);
                        setLightboxOpen(true);
                      }}
                    >
                      {mainImage ? (
                        <img
                          src={mainImage}
                          alt={product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Music className="h-32 w-32 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Product Info - Dynamic Layout */}
          <div className={stickyPurchasePanel ? "lg:absolute lg:right-0 lg:top-0 lg:h-full lg:w-[calc(40%-1.2rem)]" : ""}>
            <div
              className={stickyPurchasePanel ? "lg:sticky lg:overflow-y-auto" : ""}
              style={stickyPurchasePanel ? {
                top: 'var(--product-purchase-sticky-top, 1rem)',
                maxHeight: 'calc(100vh - var(--product-purchase-sticky-top, 1rem) - 1rem)',
              } : undefined}
            >
            {layout && Array.isArray(layout) ? (
              // Renderizar secciones según orden configurado
              <div className="space-y-4">
                {layout.map((item: any, index: number) => {
                  // Verificar si es formato nuevo (con type) o antiguo (sin type)
                  if (item.type === 'row') {
                    // Renderizar fila con 2 columnas (50/50)
                    const leftSection = item.sections[0];
                    const rightSection = item.sections[1];
                    
                    // Pre-renderizar para verificar qué bloques tienen contenido
                    const leftContent = leftSection?.enabled && sectionRenderers[leftSection.id] 
                      ? sectionRenderers[leftSection.id]() 
                      : null;
                    const rightContent = rightSection?.enabled && sectionRenderers[rightSection.id] 
                      ? sectionRenderers[rightSection.id]() 
                      : null;
                    
                    // Contar cuántos bloques realmente tienen contenido
                    const visibleBlocks = [leftContent, rightContent].filter(content => content !== null).length;
                    
                    // Si ninguno tiene contenido, no renderizar nada
                    if (visibleBlocks === 0) return null;
                    
                    // Ajustar grid según bloques visibles
                    const gridClass = visibleBlocks === 2 ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-1';
                    
                    return (
                      <div key={`row-${index}`} className={gridClass}>
                        {leftContent && <div>{leftContent}</div>}
                        {rightContent && <div>{rightContent}</div>}
                      </div>
                    );
                  } else if (item.type === 'single') {
                    // Renderizar bloque individual (nuevo formato)
                    const section = item.section;
                    if (!section?.enabled) return null;
                    
                    const renderer = sectionRenderers[section.id];
                    return renderer ? <div key={section.id}>{renderer()}</div> : null;
                  } else {
                    // Formato antiguo (compatibilidad hacia atrás)
                    if (!item.enabled) return null;
                    const renderer = sectionRenderers[item.id];
                    return renderer ? <div key={item.id}>{renderer()}</div> : null;
                  }
                })}
              </div>
            ) : (
              // Fallback: orden por defecto si no hay layout
              <>
                {renderTitle()}
                {renderPrice()}
                {renderShortDescription()}
                {renderProductActions()}
                {renderDescription()}
                {renderSpotifyPlayer()}
              </>
            )}
            </div>
          </div>

        {/* Tabs debajo de galería y descripción - Orden dinámico */}
        <div className="mt-12 lg:col-start-1">
          {(() => {
            const productCategories = Array.isArray(product.categories) ? product.categories : [];
            const usesMusicMetadata = productCategories.length > 0
              ? productCategories.some((category: any) => category.usesMusicMetadata !== false)
              : product.category?.usesMusicMetadata !== false;
            const hasTechnicalSpecs = typeof product.technicalSpecs === 'string'
              ? product.technicalSpecs.trim().length > 0
              : Boolean(product.technicalSpecs);
            const isTabAvailable = (tabId: string) => {
              if (tabId === 'tracklist-tab') return usesMusicMetadata;
              if (tabId === 'technical') return hasTechnicalSpecs;
              return true;
            };

            // Definir todas las pestañas disponibles
            const allTabs: Record<string, { value: string; label: string; icon: React.ReactNode; content: React.ReactNode }> = {
              'tracklist-tab': {
                value: 'tracklist-tab',
                label: 'Listado de temas',
                icon: <List size={15} />,
                content: (() => {
                  if (!product.tracklist) return (
                    <Card><CardContent className="p-6"><p className="text-gray-500 italic">No hay listado de temas disponible</p></CardContent></Card>
                  );

                  // Parsear temas en lados
                  const lines: string[] = product.tracklist.split('\n').map((l: string) => l.trim()).filter(Boolean);
                  const sides: Record<string, { num: string; title: string; duration: string }[]> = {};
                  let currentSide = 'General';

                  lines.forEach((line: string) => {
                    // Detectar encabezado de lado: "Lado A", "Side A", "A", "A:", etc.
                    const headerMatch = line.match(/^(?:Lado|Side)?\s*([A-J])\s*[:\-]?$/i);
                    if (headerMatch) {
                      currentSide = `Lado ${headerMatch[1].toUpperCase()}`;
                      if (!sides[currentSide]) sides[currentSide] = [];
                      return;
                    }

                    // Parsear línea de track: "A1. Título 3:30" o "01. Título 3:30" o "1 Título 3:30"
                    const trackMatch = line.match(/^([A-J]?\d{1,2})[.\s)]\s*(.+?)(?:\s+(\d{1,2}:\d{2}))?$/);
                    if (trackMatch) {
                      const rawNum = trackMatch[1];
                      // Detectar cambio de lado por prefijo de letra
                      const letterMatch = rawNum.match(/^([A-J])/i);
                      if (letterMatch) {
                        const newSide = `Lado ${letterMatch[1].toUpperCase()}`;
                        if (newSide !== currentSide) {
                          currentSide = newSide;
                          if (!sides[currentSide]) sides[currentSide] = [];
                        }
                      } else if (!sides[currentSide]) {
                        sides[currentSide] = [];
                      }
                      const num = rawNum.replace(/[A-J]/i, '');
                      sides[currentSide].push({ num: num.padStart(2, '0'), title: trackMatch[2].trim(), duration: trackMatch[3] || '' });
                    } else {
                      // Línea sin formato reconocido: agregarla como item sin número
                      if (!sides[currentSide]) sides[currentSide] = [];
                      sides[currentSide].push({ num: '', title: line, duration: '' });
                    }
                  });

                  const sideKeys = Object.keys(sides);
                  const hasSides = sideKeys.length > 1 || (sideKeys.length === 1 && sideKeys[0] !== 'General');

                  // Calcular estadísticas del álbum
                  const trackCount = sideKeys.reduce((acc, s) => acc + sides[s].length, 0);
                  const totalSeconds = sideKeys.reduce((acc, s) =>
                    acc + sides[s].reduce((t, track) => {
                      if (!track.duration) return t;
                      const [m, sec] = track.duration.split(':').map(Number);
                      return t + m * 60 + sec;
                    }, 0), 0);
                  const totalDuration = totalSeconds > 0
                    ? `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`
                    : null;
                  const albumThumbRaw = getProductImageByIndex(product, 0, 'thumb');
                  const albumThumbUrl = albumThumbRaw ? getImageUrl(albumThumbRaw) : null;

                  return (
                    <Card>
                      <CardContent className="p-6">
                        {/* Cabecera del álbum */}
                        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
                          {albumThumbUrl && (
                            <img src={albumThumbUrl} alt={product.title} className="w-14 h-14 rounded object-cover flex-shrink-0 border" />
                          )}
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{product.album || product.title}</p>
                            <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                              {trackCount > 0 && (
                                <span className="flex items-center gap-1.5">
                                  <Music size={12} />
                                  {trackCount} {trackCount === 1 ? 'canción' : 'canciones'}
                                </span>
                              )}
                              {totalDuration && (
                                <span className="flex items-center gap-1.5">
                                  <Clock size={12} />
                                  Duración total: {totalDuration}
                                </span>
                              )}
                              {product.format && (
                                <span className="flex items-center gap-1.5">
                                  💿 Formato: {product.format.split(/[,(]/)[0].trim()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={`grid gap-8 ${sideKeys.length === 2 ? 'md:grid-cols-2' : sideKeys.length >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                          {sideKeys.map((side) => (
                            <div key={side}>
                              {hasSides && (
                                <h4 className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-3">{side}</h4>
                              )}
                              <div className="space-y-0">
                                {sides[side].map((track, i) => (
                                  <div key={i} className="flex items-baseline gap-3 py-2.5 border-b border-gray-100 last:border-0">
                                    {track.num && (
                                      <span className="text-sm font-bold w-6 shrink-0" style={{ color: 'var(--color-primary, #9333ea)' }}>
                                        {track.num}
                                      </span>
                                    )}
                                    <span className="flex-1 text-sm text-gray-800">{track.title}</span>
                                    {track.duration && (
                                      <span className="text-xs text-gray-400 shrink-0">{track.duration}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()
              },
              'description-tab': {
                value: 'description',
                label: 'Descripción',
                icon: <AlignLeft size={15} />,
                content: (
                  <Card>
                    <CardContent className="p-6">
                      {product.description ? (
                        <div className="text-gray-700 whitespace-pre-line">
                          {product.description}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No hay descripción disponible</p>
                      )}
                    </CardContent>
                  </Card>
                )
              },
              'technical': {
                value: 'technical',
                label: 'Información técnica',
                icon: <Cpu size={15} />,
                content: (
                  <Card>
                    <CardContent className="p-6">
                      {product.technicalSpecs ? (
                        <div className="whitespace-pre-line text-gray-700">
                          {product.technicalSpecs}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No hay datos técnicos disponibles</p>
                      )}
                    </CardContent>
                  </Card>
                )
              },
              'spotify-tab': {
                value: 'spotify-tab',
                label: 'Spotify',
                icon: <Music size={15} />,
                content: (
                  <Card>
                    <CardContent className="p-6">
                      <iframe
                        src={`https://open.spotify.com/embed/album/${product.spotifyAlbumId}?utm_source=generator&theme=0`}
                        width="100%"
                        height="352"
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        title={`Escuchar ${product.title} en Spotify`}
                        className="rounded-lg"
                      />
                    </CardContent>
                  </Card>
                )
              },
              'questions-tab': {
                value: 'questions-tab',
                label: 'Preguntas',
                icon: <MessageCircle size={15} />,
                content: (
                  <Card>
                    <CardContent className="p-6">
                      <ProductQuestions productId={product.id} embedded />
                    </CardContent>
                  </Card>
                )
              }
            };

            // Obtener pestañas ordenadas y filtradas
            const baseTabs = tabsOrder && Array.isArray(tabsOrder)
              ? tabsOrder
                  .filter((tab: any) => tab.enabled && allTabs[tab.id] && isTabAvailable(tab.id) && (tab.id !== 'spotify-tab' || (product.spotifyEnabled && product.spotifyAlbumId)))
                  .sort((a: any, b: any) => a.order - b.order)
                  .map((tab: any) => allTabs[tab.id])
              : Object.values(allTabs).filter((tab) => tab.value !== 'questions-tab' && tab.value !== 'spotify-tab' && isTabAvailable(tab.value));

            // Agregar siempre la pestaña de preguntas al final
            const orderedTabs = baseTabs.some((t: any) => t.value === 'questions-tab')
              ? baseTabs
              : [...baseTabs, allTabs['questions-tab']];

            if (orderedTabs.length === 0) return null;

            const firstTabValue = orderedTabs[0].value;

            return (
              <Tabs value={activeDetailsTab && orderedTabs.some((tab) => tab.value === activeDetailsTab) ? activeDetailsTab : firstTabValue} onValueChange={setActiveDetailsTab} className="w-full">
                <div className="border-b border-gray-100 bg-white">
                  <TabsList className="flex h-auto bg-transparent p-0 gap-0 overflow-x-auto">
                    {orderedTabs.map((tab: any) => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-gray-700 border-b-4 border-transparent rounded-none bg-transparent transition-all duration-250 hover:bg-gray-50/80 whitespace-nowrap data-[state=active]:text-blue-600 data-[state=active]:border-b-4 data-[state=active]:border-blue-600 data-[state=active]:bg-blue-50/40"
                      >
                        {tab.icon}
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {orderedTabs.map((tab) => (
                  <TabsContent key={tab.value} value={tab.value} className="mt-0">
                    {tab.content}
                  </TabsContent>
                ))}
              </Tabs>
            );
          })()}
        </div>
        </div>

        {/* Recomendados para ti */}
        {relatedProducts.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recomendados para ti</h2>
              <a href={`/tiendas/${slug}/productos`} className="text-sm font-medium" style={{ color: 'var(--color-primary, #9333ea)' }}>Ver todos</a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {relatedProducts.map((rp) => {
                const rpImage = getProductImageByIndex(rp, 0, 'thumb');
                const rpPrice = getProductPrice(rp);
                return (
                  <a key={rp.id} href={`/tiendas/${slug}/productos/${rp.slug || rp.id}`} className="group block">
                    <div className="relative mb-2 aspect-square overflow-hidden rounded-lg bg-gray-100">
                      <ProductFormatBadge product={rp} />
                      {rpImage ? (
                        <img
                          src={getImageUrl(rpImage)}
                          alt={rp.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🎵</div>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-gray-800 line-clamp-2 mb-0.5">{rp.title}</p>
                    {rp.artist && <p className="text-xs text-gray-500 line-clamp-1">{rp.artist}</p>}
                    <p className="text-sm font-bold mt-1" style={{ color: 'var(--color-primary, #9333ea)' }}>
                      ${Math.round(rpPrice).toLocaleString('es-CL')}
                    </p>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Menú Lateral Móvil - Debajo del contenido */}
    {showLateralMenu && isMobile && (
      <div className="w-full mt-6">
        <LateralMenu config={settings.menus.lateral} vendorSlug={slug} />
      </div>
    )}
    </div>
    </div>

    {/* Footer de la Tienda */}
    <StoreFooter footerConfig={settings?.footerConfig} vendorSlug={slug} />

    {/* Lightbox Modal for Images */}
    {lightboxOpen && (() => {
      const images = parseImages(product.images);
      const currentImage = images[lightboxImageIndex];
      const imageUrl = getImageUrl(typeof currentImage === 'string' ? currentImage : currentImage?.url);
      
      return (
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close Button */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-[10000] text-white hover:text-gray-300 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] text-white text-sm bg-black/50 px-4 py-2 rounded-full">
            {lightboxImageIndex + 1} / {images.length}
          </div>

          {/* Previous Arrow */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-[10000] bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all duration-200 hover:scale-110"
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}

          {/* Main Image */}
          <div 
            className="relative max-w-7xl max-h-[90vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt={`${product.title} - ${lightboxImageIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>

          {/* Next Arrow */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-[10000] bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all duration-200 hover:scale-110"
              aria-label="Siguiente imagen"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}

          {/* Thumbnail Strip (optional - for easier navigation) */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[10000] flex gap-2 bg-black/50 p-3 rounded-lg max-w-[90vw] overflow-x-auto">
              {images.map((img: any, i: number) => {
                const rawThumb = getProductImageByIndex(product, i, 'thumb') || getProductImageByIndex(product, i, 'large');
                const thumbUrl = rawThumb ? getImageUrl(rawThumb) : '/placeholder-product.png';
                return (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxImageIndex(i);
                    }}
                    className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${
                      lightboxImageIndex === i ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={thumbUrl} alt={`Miniatura ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    })()}

    {/* Navegación entre productos */}
    {!navigating && (prevProductId || nextProductId) && (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
          <button
            type="button"
            onClick={() => prevProductId && navigateToProduct(prevProductId, 'prev')}
            disabled={!prevProductId}
            className="flex-1 rounded-md border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: prevProductId ? 'var(--color-primary, #0ea5e9)' : '#d1d5db',
              color: prevProductId ? 'var(--color-primary, #0ea5e9)' : '#6b7280',
            }}
          >
            Producto anterior
          </button>
          <button
            type="button"
            onClick={() => nextProductId && navigateToProduct(nextProductId, 'next')}
            disabled={!nextProductId}
            className="flex-1 rounded-md px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: nextProductId ? 'var(--color-primary, #0ea5e9)' : '#9ca3af',
            }}
          >
            Siguiente producto
          </button>
        </div>
      </div>
    )}
    </div>
  );
}
