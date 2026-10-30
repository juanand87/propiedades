"use client";

import Link from "next/link";
import { ShoppingCart, ShoppingBag, User, Menu, Heart, Facebook, Instagram, Twitter, Youtube, Home } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import LocationSelector from "@/components/LocationSelector";
import TopPlayerBar from "@/components/TopPlayerBar";
import { useCart } from "@/contexts/CartContext";
import RadioPlayerButton from "@/components/RadioPlayerButton";
import { useState, useEffect } from "react";
import { getImageUrl } from "@/lib/utils";
import { getProductsUrl, getStoreUrl, getCategoryUrl, getGenreUrl, getPageUrl } from "@/lib/useCustomDomain";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderType2Props {
  vendor: any;
  config: any;
  slug: string;
}

export default function HeaderType2({ vendor, config, slug }: HeaderType2Props) {
  const { getTotalItems, openCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [globalFavoritesEnabled, setGlobalFavoritesEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const loadGlobalFavoritesSetting = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/marketplace/settings/favoritesEnabled`);
        if (response.ok) {
          const value = await response.json();
          setGlobalFavoritesEnabled(value !== false && value !== "false");
        }
      } catch {
        setGlobalFavoritesEnabled(null);
      }
    };

    loadGlobalFavoritesSetting();
  }, []);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getMenuUrl = (item: any) => {
    console.log('🔗 getMenuUrl called:', { 
      linkType: item.linkType, 
      label: item.label,
      categoryId: item.categoryId,
      categorySlug: item.categorySlug,
      pageSlug: item.pageSlug,
      isHomepage: item.isHomepage
    });
    
    let url = '#';
    switch (item.linkType) {
      case 'category':
        url = getCategoryUrl(slug, item.categorySlug || item.categoryId);
        break;
      case 'genre':
        url = getGenreUrl(slug, item.genreSlug || item.genreId);
        break;
      case 'page':
        url = getPageUrl(slug, item.pageSlug || item.pageId, item.isHomepage);
        break;
      case 'condition':
        url = getProductsUrl(slug, { condition: item.condition });
        break;
      case 'offers':
        url = getProductsUrl(slug, { isOnSale: 'true' });
        break;
      case 'custom':
        url = item.customUrl || '#';
        break;
      default:
        url = item.customUrl || '#';
    }
    
    console.log('🔗 Generated URL:', url);
    return url;
  };

  const principalRaw = config?.customMenus?.principal?.items?.length > 0
    ? config.customMenus.principal.items
    : config?.menus?.principal;
  const menuItemsPrincipal = Array.isArray(principalRaw) ? principalRaw : (principalRaw?.items || []);
  const secundarioRaw = config?.customMenus?.secundario?.items?.length > 0
    ? config.customMenus.secundario.items
    : config?.menus?.secundario;
  const menuItemsSecundario = Array.isArray(secundarioRaw) ? secundarioRaw : (secundarioRaw?.items || []);
  
  // Sticky is enabled by default; disabled only when explicitly set to false
  const stickyEnabled = config?.headerConfig?.stickyHeader !== false;
  const favoritesEnabled = (globalFavoritesEnabled ?? config?.favoritesEnabled ?? config?.headerConfig?.favoritesEnabled ?? true) !== false;
  const accountHref = !isAuthenticated
    ? "/login"
    : user?.role === "admin"
      ? "/panel"
      : user?.role === "vendor"
        ? "/dashboard"
        : "/mis-pedidos";

  // 📱 MOBILE HEADER
  if (isMobile) {
    return (
      <>
        <TopPlayerBar config={config} isMarketplace={slug === "marketplace"} />
        <header
          style={stickyEnabled ? { position: 'sticky', top: 0, zIndex: 50 } : {}}
          className="w-full shadow-md bg-white"
        >
          <div className="flex items-center justify-between px-4 py-3">
            {/* Hamburger izquierda */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>

            {/* Logo centro */}
            <Link href={getStoreUrl(slug)} className="flex-shrink-0">
              {config?.headerConfig?.logo ? (
                <img src={getImageUrl(config.headerConfig.logo)} alt={vendor.storeName} className="h-8" />
              ) : (
                <span className="text-lg font-bold theme-gradient-text">
                  {(config?.headerConfig?.storeName || config?.storeName || vendor.storeName).substring(0, 15)}
                </span>
              )}
            </Link>

            {/* Carrito + Radio derecha */}
            <div className="flex items-center gap-1">
              {slug === "marketplace" && <RadioPlayerButton iconOnly buttonClass="text-gray-700 hover:text-purple-600" />}
              <button 
              onClick={openCart}
              className="relative p-2 text-gray-700 theme-hover-text hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ShoppingCart size={24} />
              {getTotalItems() > 0 && (
                <span className="absolute -top-1 -right-1 theme-cart-badge text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {getTotalItems()}
                </span>
              )}
            </button>
            </div>
          </div>

          {/* Buscador móvil */}
          {(config?.headerConfig?.searchEnabled !== false && config?.searchEnabled !== false) && (
            <div className="px-4 pb-3">
              <SearchBar vendor={vendor} slug={slug} />
            </div>
          )}
        </header>

        {/* Menú lateral móvil */}
        {isMobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed left-0 top-0 bottom-0 w-72 bg-white z-50 shadow-xl overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold theme-gradient-text">Menú</h2>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                <nav className="mb-6 space-y-2 border-b border-gray-200 pb-6">
                  <Link
                    href={accountHref}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    <User size={20} />
                    <span>Cuenta</span>
                  </Link>
                  <Link
                    href="/mis-pedidos"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    <ShoppingBag size={20} />
                    <span>Mis compras</span>
                  </Link>
                </nav>

                {/* Menú Principal */}
                {menuItemsPrincipal.length > 0 && (
                  <nav className="space-y-2 mb-6">
                    {menuItemsPrincipal.map((item: any) => (
                      <Link
                        key={item.id}
                        href={getMenuUrl(item)}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {item.showIcon && (item.customIcon || item.categoryIcon) && (
                            <span className="text-xl">
                              {((item.customIcon || item.categoryIcon).startsWith('/') || (item.customIcon || item.categoryIcon).startsWith('http')) ? (
                                <img 
                                  src={getImageUrl(item.customIcon || item.categoryIcon)} 
                                  alt="" 
                                  className="w-5 h-5 object-contain inline-block" 
                                />
                              ) : (
                                item.customIcon || item.categoryIcon
                              )}
                            </span>
                          )}
                          <span>{item.label}</span>
                        </div>
                      </Link>
                    ))}
                  </nav>
                )}

                {/* Menú Secundario */}
                {menuItemsSecundario.length > 0 && (
                  <div className="pt-6 border-t border-gray-200">
                    <nav className="space-y-2">
                      {menuItemsSecundario.map((item: any) => (
                        <Link
                          key={item.id}
                          href={getMenuUrl(item)}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block px-4 py-3 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </nav>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // 💻 DESKTOP HEADER
  return (
    <>
      <TopPlayerBar
        config={config}
        isMarketplace={slug === "marketplace"}
        secondaryMenuItems={menuItemsSecundario}
        getMenuUrl={getMenuUrl}
      />
      <header
        style={stickyEnabled ? { position: 'sticky', top: 0, zIndex: 50 } : {}}
        className="w-full shadow-md bg-white"
      >
      {/* Header Principal */}
      <div className="border-b border-gray-200">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-6">
            {/* Logo */}
            <Link href={getStoreUrl(slug)} className="flex-shrink-0">
              {config?.headerConfig?.logo ? (
                <img src={getImageUrl(config.headerConfig.logo)} alt={vendor.storeName} className="h-12 md:h-16" />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-2xl">
                    {(config?.storeName || vendor.storeName).charAt(0)}
                  </div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    {config?.storeName || vendor.storeName}
                  </span>
                </div>
              )}
            </Link>

            {/* Buscador Central - Grande y Prominente */}
            {config?.searchEnabled !== false && (
              <SearchBar
                vendor={vendor}
                slug={slug}
                className="flex-1 max-w-2xl"
              />
            )}

            {/* Acciones Derecha */}
            <div className="flex items-center gap-2">
              <Link href={accountHref} className="flex items-center gap-2 px-2 py-2 text-gray-700 hover:text-purple-600 transition-colors">
                <User size={22} />
                <span className="hidden md:block text-sm">Cuenta</span>
              </Link>

              <Link href="/mis-pedidos" className="flex items-center gap-2 px-2 py-2 text-gray-700 hover:text-purple-600 transition-colors">
                <ShoppingBag size={22} />
                <span className="hidden md:block text-sm">Mis compras</span>
              </Link>

              <Link href="/favoritos" className="flex items-center gap-2 px-2 py-2 text-gray-700 hover:text-purple-600 transition-colors">
                <Heart size={22} />
                <span className="hidden md:block text-sm">Favoritos</span>
              </Link>

              <button onClick={openCart} className="relative flex items-center gap-2 px-4 py-2 theme-cart-button rounded-lg transition-colors">
                <ShoppingCart size={22} />
                <span className="hidden md:block text-sm font-medium">Carrito</span>
                <span className="absolute -top-2 -right-2 theme-cart-badge text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                  {getTotalItems()}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Menú Principal */}
      <div className="theme-gradient-bg border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-2">
            {/* Menú a la izquierda */}
            <nav className="flex items-center gap-1 overflow-x-auto">
              {menuItemsPrincipal.length > 0 ? (
                menuItemsPrincipal.map((item: any) => {
                  const isHome = ['inicio', 'home'].includes((item.label || '').toLowerCase().trim());
                  return (
                  <Link 
                    key={item.id}
                    href={getMenuUrl(item)}
                    target={item.openInNewTab ? '_blank' : undefined}
                    rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                    className="px-4 py-2 text-sm text-white hover:bg-white/20 rounded-lg transition-all whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      {slug === 'marketplace' ? (
                        isHome && <Home size={15} className="text-white" />
                      ) : (
                        item.showIcon && (item.customIcon || item.categoryIcon) && (
                          <span className="text-lg">
                            {((item.customIcon || item.categoryIcon).startsWith('/') || (item.customIcon || item.categoryIcon).startsWith('http')) ? (
                              <img 
                                src={getImageUrl(item.customIcon || item.categoryIcon)} 
                                alt="" 
                                className="w-4 h-4 object-contain inline-block" 
                              />
                            ) : (
                              item.customIcon || item.categoryIcon
                            )}
                          </span>
                        )
                      )}
                      <span>{item.label}</span>
                    </div>
                  </Link>
                  );
                })
              ) : (
                <>
                  <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 rounded-lg transition-all whitespace-nowrap">
                    <Menu size={18} />
                    <span>Todas las Categorías</span>
                  </button>
                  <Link href={getCategoryUrl(slug, 'vinilo')} className="px-4 py-2 text-sm text-white hover:bg-white/20 rounded-lg transition-all whitespace-nowrap">
                    🎵 Vinilos
                  </Link>
                  <Link href={getCategoryUrl(slug, 'cd')} className="px-4 py-2 text-sm text-white hover:bg-white/20 rounded-lg transition-all whitespace-nowrap">
                    💿 CDs
                  </Link>
                  <Link href={getCategoryUrl(slug, 'cassette')} className="px-4 py-2 text-sm text-white hover:bg-white/20 rounded-lg transition-all whitespace-nowrap">
                    📼 Cassettes
                  </Link>
                  <Link href={getStoreUrl(slug, '/ofertas')} className="px-4 py-2 text-sm text-white font-semibold hover:bg-white/20 rounded-lg transition-all whitespace-nowrap">
                    🔥 Ofertas
                  </Link>
                  <Link href={getStoreUrl(slug, '/novedades')} className="px-4 py-2 text-sm text-white hover:bg-white/20 rounded-lg transition-all whitespace-nowrap">
                    ⭐ Novedades
                  </Link>
                </>
              )}
            </nav>

            {/* Ubicación + redes sociales a la derecha */}
            <div className="flex items-center gap-3">
              <div className="hidden lg:block [&_button]:text-white/80 [&_button:hover]:text-white">
                <LocationSelector />
              </div>
              {(config?.headerConfig?.socialLinks?.facebook || config?.headerConfig?.socialLinks?.instagram || config?.headerConfig?.socialLinks?.twitter || config?.headerConfig?.socialLinks?.youtube || config?.headerConfig?.socialLinks?.whatsapp || config?.headerConfig?.socialLinks?.tiktok) && (
              <div className="flex items-center gap-3 pl-3 ml-1 border-l border-white/30">
                {config?.headerConfig?.socialLinks?.facebook && (
                  <a href={config.headerConfig.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="Facebook">
                    <Facebook size={18} />
                  </a>
                )}
                {config?.headerConfig?.socialLinks?.instagram && (
                  <a href={config.headerConfig.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="Instagram">
                    <Instagram size={18} />
                  </a>
                )}
                {config?.headerConfig?.socialLinks?.twitter && (
                  <a href={config.headerConfig.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="Twitter/X">
                    <Twitter size={18} />
                  </a>
                )}
                {config?.headerConfig?.socialLinks?.youtube && (
                  <a href={config.headerConfig.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="YouTube">
                    <Youtube size={18} />
                  </a>
                )}
                {config?.headerConfig?.socialLinks?.whatsapp && (
                  <a href={`https://wa.me/${config.headerConfig.socialLinks.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="WhatsApp">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  </a>
                )}
                {config?.headerConfig?.socialLinks?.tiktok && (
                  <a href={config.headerConfig.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="TikTok">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>
                  </a>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
      </header>
    </>
  );
}
