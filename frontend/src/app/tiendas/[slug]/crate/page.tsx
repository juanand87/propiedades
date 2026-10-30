"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Disc3, Loader2, Minus, Plus, Rotate3D, RotateCcw, Search, ShoppingCart, X } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";
import { getStoreUrl, getProductUrl } from "@/lib/useCustomDomain";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import type { CrateMove } from "@/components/crate/RecordCrateScene";
import styles from "./crate.module.css";

const RecordCrateScene = dynamic(() => import("@/components/crate/RecordCrateScene"), {
  ssr: false, loading: () => <div className="grid h-full place-items-center"><Loader2 className="animate-spin text-cyan-700" aria-label="Cargando cajón" /></div>,
});
const price = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
function coverImage(product: any, imageIndex = 0) {
  try {
    const images = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
    return images?.[imageIndex] ? getImageUrl(images[imageIndex]) : imageIndex ? '' : getImageUrl(null);
  } catch { return imageIndex ? '' : getImageUrl(null); }
}
function formatName(product: any) {
  return String(product.format?.name || product.format || product.type || '');
}
function shortDescription(value: unknown) {
  if (!value || typeof window === 'undefined') return '';
  const parsed = new DOMParser().parseFromString(String(value), 'text/html');
  parsed.querySelectorAll('script,style').forEach((node) => node.remove());
  return parsed.body.textContent?.replace(/\s+/g, ' ').trim() || '';
}
function productStyles(product: any): string[] {
  const names = Array.isArray(product.genres) ? product.genres.map((genre: any) => typeof genre === 'string' ? genre : genre?.name).filter(Boolean) : [];
  if (names.length) return names.map((name: string) => name.trim()).filter(Boolean);
  return typeof product.genre === 'string' ? product.genre.split(',').map((name: string) => name.trim()).filter(Boolean) : [];
}

export default function CratePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { addItem, isOpen: cartOpen } = useCart();
  const [preview, setPreview] = useState(false), [previewImage, setPreviewImage] = useState(0);
  const [vendor, setVendor] = useState<any>(null), [settings, setSettings] = useState<any>(null), [layout, setLayout] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]), [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false), [error, setError] = useState('');
  const [format, setFormat] = useState('all'), [query, setQuery] = useState(''), [sort, setSort] = useState('selection');
  const [style, setStyle] = useState('');
  const [index, setIndex] = useState(0), [move, setMove] = useState<CrateMove>(null);
  const [zoom, setZoom] = useState(100), [showBack, setShowBack] = useState(false);
  const moving = useRef(false), serial = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setProducts([]); setStyle(''); setIndex(0); setMove(null); setZoom(100); setShowBack(false); moving.current = false;
    (async () => {
      try {
        const store = await api.getVendorBySlug(slug);
        const [config, result] = await Promise.all([api.getVendorSettings(store.id), api.getProducts({ vendorId: store.id, limit: 100 })]);
        let selectedLayout = null;
        if (config?.selectedLayoutId) {
          try { const response = await fetch(`/api/layouts/${config.selectedLayoutId}`); if (response.ok) selectedLayout = await response.json(); } catch { /* Use the configured store header if the layout is unavailable. */ }
        }
        if (cancelled) return;
        setVendor(store); setSettings(config); setLayout(selectedLayout);
        const items = Array.isArray(result) ? result : result.products || [];
        setProducts(items); setTotal(Number(result.total ?? items.length));
      } catch { if (!cancelled) setError('No se pudo cargar el catálogo de esta tienda.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const availableStyles = useMemo(() => [...new Set(products.flatMap(productStyles))].sort((a, b) => a.localeCompare(b, 'es')), [products]);
  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('es');
    const result = products.filter((product) => {
      const value = formatName(product).toLowerCase();
      const matches = format === 'all' || (format === 'vinyl' ? /vinyl|vinilo|\blp\b/.test(value) : /\bcd\b|compact/.test(value));
      return matches && (!style || productStyles(product).includes(style)) && (!text || `${product.title} ${product.artist || ''}`.toLocaleLowerCase('es').includes(text));
    });
    if (sort === 'price-asc') result.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === 'price-desc') result.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === 'title') result.sort((a, b) => String(a.title).localeCompare(String(b.title), 'es'));
    return result;
  }, [products, query, format, sort, style]);
  const covers = useMemo(() => filtered.map((product) => ({ id: product.id, title: product.title, image: coverImage(product), backImage: coverImage(product, 1) })), [filtered]);
  const selected = filtered[index % Math.max(1, filtered.length)];
  const reset = () => { setIndex(0); setMove(null); setZoom(100); setShowBack(false); moving.current = false; };
  const navigate = useCallback((delta: 1 | -1) => {
    if (moving.current || filtered.length < 2) return;
    setZoom(100); setShowBack(false);
    moving.current = true; setMove({ serial: ++serial.current, delta });
  }, [filtered.length]);
  const settled = useCallback((delta: 1 | -1) => {
    setIndex((value) => (value + delta + filtered.length) % filtered.length);
    setMove(null); moving.current = false;
  }, [filtered.length]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (preview || cartOpen || event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement)?.closest('input,select,textarea,[contenteditable="true"],[role="dialog"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); navigate(event.key === 'ArrowRight' ? 1 : -1); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [navigate, preview, cartOpen]);
  const addSelected = () => {
    if (!selected || !vendor || Number(selected.stock) <= 0) return;
    setPreview(false);
    addItem({ productId: selected.id, title: selected.title, artist: selected.artist, price: Number(selected.price), imageUrl: coverImage(selected), stock: Number(selected.stock), vendorId: selected.vendor?.id || selected.vendorId || vendor.id, vendorSlug: selected.vendor?.slug || selected.vendorSlug || slug });
  };
  let gallery: unknown[] = [];
  try { const images = typeof selected?.images === 'string' ? JSON.parse(selected.images) : selected?.images; if (Array.isArray(images)) gallery = images; } catch { /* Keep the primary image fallback. */ }
  const loadMore = async () => {
    if (loadingMore || !vendor) return;
    setLoadingMore(true); setError('');
    try {
      const result = await api.getProducts({ vendorId: vendor.id, limit: 100, offset: products.length });
      const incoming = Array.isArray(result) ? result : result.products || [];
      setProducts((old) => [...new Map([...old, ...incoming].map((product) => [product.id, product])).values()]);
      setTotal(Number(result.total ?? products.length + incoming.length));
    } catch { setError('No se pudieron cargar más discos.'); }
    finally { setLoadingMore(false); }
  };
  const headerProps = { vendor, slug, config: { ...(settings?.headerConfig || {}), menus: settings?.menus || {}, customMenus: settings?.customMenus || {}, headerConfig: settings?.headerConfig || {} } };
  const headerType = layout?.sections?.find((section: any) => section.id === 'header')?.headerType || settings?.headerType || 'type1';
  const Header = headerType === 'type3' || headerType === 3 ? HeaderType3 : headerType === 'type2' || headerType === 2 ? HeaderType2 : HeaderType1;

  return <div className={styles.page}>
    {vendor && settings && <Header {...headerProps} />}
    <main className={styles.main}>
      <div className={styles.heading}>
        <div><Link className={styles.back} href={getStoreUrl(slug, '/')}><ArrowLeft size={15} />{vendor?.storeName || 'Tienda'}</Link><h1>Cajón de discos</h1></div>
        <Link className={styles.catalog} href={getStoreUrl(slug, '/productos')}>Ver catálogo <ArrowUpRight size={16} /></Link>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.formats} role="group" aria-label="Formato">
          {[['all', 'Todos'], ['vinyl', 'Vinilos'], ['cd', 'CDs']].map(([value, label]) => <button key={value} aria-pressed={format === value} disabled={!!move} onClick={() => { reset(); setFormat(value); }}><Disc3 size={15} />{label}</button>)}
        </div>
        <div className={styles.filters}>
          <label className={styles.search}><Search size={16} /><input aria-label="Buscar discos" placeholder="Buscar artista o disco" value={query} disabled={!!move} onChange={(event) => { reset(); setQuery(event.target.value); }} />{query && <button aria-label="Limpiar búsqueda" onClick={() => { reset(); setQuery(''); }}><X size={14} /></button>}</label>
          <select className={styles.styleFilter} aria-label="Filtrar por estilo" value={style} disabled={!!move} onChange={event => { reset(); setStyle(event.target.value); }}><option value="">Todos los estilos</option>{availableStyles.map(name => <option key={name} value={name}>{name}</option>)}</select>
          <select aria-label="Ordenar discos" value={sort} disabled={!!move} onChange={(event) => { reset(); setSort(event.target.value); }}><option value="selection">Selección de la tienda</option><option value="title">Nombre: A–Z</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option></select>
        </div>
      </div>
      {error && <p className={styles.error} role="alert">{error} {!vendor && <button onClick={() => window.location.reload()}>Reintentar</button>}</p>}
      {loading ? <div className={styles.loading} role="status"><Loader2 size={25} className="animate-spin" />Cargando discos...</div> : selected ? <>
        <div className={styles.showcase}>
        <section className={styles.stage} aria-label="Explorar cajón de discos" tabIndex={0}>
          <RecordCrateScene covers={covers} index={index} move={move} zoom={zoom} showBack={showBack} brand={vendor?.storeName || 'MundoBeat'} onSettled={settled} onSwipe={navigate} />
          <button className={`${styles.arrow} ${styles.previous}`} title="Disco anterior" aria-label="Disco anterior" disabled={!!move || filtered.length < 2} onClick={() => navigate(-1)}><ChevronLeft size={25} /></button>
          <button className={`${styles.arrow} ${styles.next}`} title="Siguiente disco" aria-label="Siguiente disco" disabled={!!move || filtered.length < 2} onClick={() => navigate(1)}><ChevronRight size={25} /></button>
        </section>
        <section className={styles.record} aria-live="polite" aria-atomic="true" aria-busy={!!move}>
          <div className={styles.recordTitle}><span className={styles.counter}>{index + 1} / {filtered.length}</span><h2>{selected.title}</h2><p>{[formatName(selected), selected.year, selected.condition === 'used' ? 'Usado' : selected.condition === 'new' ? 'Nuevo' : ''].filter(Boolean).join(' · ')}</p>{selected.shortDescription && <p className={styles.description}>{shortDescription(selected.shortDescription)}</p>}<strong className={styles.price}>{price.format(Number(selected.price) || 0)}</strong></div>
          <div className={styles.purchase}><div className={styles.purchaseActions}><button className={styles.primaryAction} onClick={() => { setPreviewImage(0); setPreview(true); }}>Ver disco <ArrowUpRight size={17} /></button><button className={styles.cartAction} title="Agregar al carro" aria-label="Agregar al carro" disabled={Number(selected.stock) <= 0} onClick={addSelected}><ShoppingCart size={19} /></button></div>
            <div className={styles.inspectionTools}>
              <div className={styles.zoomControls}>
                <button title="Reducir zoom" aria-label="Reducir zoom" disabled={!!move || zoom <= 100} onClick={() => setZoom((value) => Math.max(100, value - 25))}><Minus size={18} /></button>
                <output>{zoom}%</output>
                <button title="Aumentar zoom" aria-label="Aumentar zoom" disabled={!!move || zoom >= 250} onClick={() => setZoom((value) => Math.min(250, value + 25))}><Plus size={18} /></button>
              </div>
              <input type="range" min="100" max="250" value={zoom} disabled={!!move} aria-label="Zoom del disco" onChange={(event) => setZoom(Number(event.target.value))} />
              <div className={styles.zoomControls}>
                <button title={showBack ? 'Ver portada' : coverImage(selected, 1) ? 'Ver contraportada' : 'Sin contraportada'} aria-label={showBack ? 'Ver portada' : 'Ver contraportada'} aria-pressed={showBack} disabled={!!move || !coverImage(selected, 1)} onClick={() => setShowBack((value) => !value)}><Rotate3D size={19} /></button>
                <button title="Restablecer vista" aria-label="Restablecer vista" disabled={!!move} onClick={() => { setZoom(100); setShowBack(false); }}><RotateCcw size={18} /></button>
              </div>
              <span className={styles.counter}>{showBack ? 'Contraportada' : !coverImage(selected, 1) ? 'Sin contraportada' : 'Portada'}</span>
            </div>
          </div>
        </section>
        </div>
        <div className={styles.progress} aria-hidden="true"><span style={{ width: `${((index + 1) / filtered.length) * 100}%` }} /></div>
      </> : !error && <div className={styles.empty}><Disc3 size={35} /><h2>No hay discos {query || style ? 'para esta búsqueda' : 'en este formato'}</h2><button onClick={() => { reset(); setQuery(''); setFormat('all'); setStyle(''); }}>Ver todos</button></div>}
      {!loading && products.length < total && <div className={styles.more}><button disabled={loadingMore || !!move} onClick={loadMore}>{loadingMore ? 'Cargando...' : 'Cargar más discos'}</button><span>{products.length} de {total}</span></div>}
    </main>
    <Dialog open={preview && !!selected} onOpenChange={setPreview}>
      <DialogContent className="sm:max-w-4xl max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
        <DialogTitle className="text-xl font-bold">Vista Previa</DialogTitle>
        {selected && <div className={styles.previewGrid}>
          <div><img className={styles.previewCover} src={coverImage(selected, previewImage)} alt={selected.title} /><div className={styles.thumbnails}>{gallery.map((_, imageIndex) => <button key={imageIndex} aria-label={`Imagen ${imageIndex + 1}`} aria-pressed={previewImage === imageIndex} onClick={() => setPreviewImage(imageIndex)}><img src={coverImage(selected, imageIndex)} alt="" /></button>)}</div></div>
          <div className={styles.previewInfo}><h3>{selected.title}</h3>{selected.artist && <p>{selected.artist}</p>}<strong className={styles.price}>{price.format(Number(selected.price) || 0)}</strong><span className={styles.stock}>Stock disponible: {selected.stock}</span>
            <dl>{[['Formato', formatName(selected)], ['Género', selected.genre?.name || selected.genre], ['Condición', selected.condition === 'used' ? 'Usado' : selected.condition === 'new' ? 'Nuevo' : selected.condition], ['Año', selected.year]].filter(([, value]) => !!value).map(([label, value]) => <div key={label}><dt>{label}:</dt><dd>{String(value)}</dd></div>)}</dl>
            <div className={styles.previewActions}><Link href={getProductUrl(selected, slug)}>Ver detalles completos</Link><button className={styles.primaryAction} disabled={Number(selected.stock) <= 0} onClick={addSelected}><ShoppingCart size={19} />Agregar</button></div>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
    {vendor && <StoreFooter footerConfig={settings?.footerConfig} vendorSlug={slug} />}
  </div>;
}
