"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Search, Plus, Edit, Trash2, Upload, Download, ExternalLink, Music, RefreshCw, Columns3, RotateCcw, ChevronDown, Link2Off } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api, API_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/format";
import { getImageUrl } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Product {
  id: string;
  title: string;
  artist: string;
  album?: string;
  type: string;
  price: number;
  stock: number;
  status: string;
  condition: string; // 'new' | 'used'
  sku?: string;
  format?: string;
  label?: string;
  year?: number;
  country?: string;
  barcode?: string;
  createdAt?: string;
  updatedAt?: string;
  woocommerceId?: string;
  mercadoLibreItemId?: string;
  mercadoLibreStatus?: string;
  mercadoLibreStatusDetail?: string;
  mercadoLibreStatusUpdatedAt?: string;
  parisProductId?: string;
  falabellaFeedId?: string;
  spotifyAlbumId?: string;
  spotifyEnabled?: boolean;
  images?: any; // Añadido para las imágenes
  imagen?: string; // Fallback para imagen única
  categories?: {
    id: string;
    name: string;
  }[];
}

type BulkSyncFailure = { productId: string; title: string; reason: string };
type BulkSyncProgress = {
  open: boolean;
  marketplace: string;
  total: number;
  completed: number;
  succeeded: number;
  failures: BulkSyncFailure[];
  currentProduct: string;
  running: boolean;
};

type ProductColumn = 'category' | 'price' | 'stock' | 'status' | 'condition' | 'format' | 'artist' | 'label' | 'year' | 'country' | 'barcode' | 'createdAt';

const productColumnOptions: { key: ProductColumn; label: string }[] = [
  { key: 'category', label: 'Categoría' },
  { key: 'price', label: 'Precio' },
  { key: 'stock', label: 'Stock' },
  { key: 'status', label: 'Estado' },
  { key: 'condition', label: 'Condición' },
  { key: 'format', label: 'Formato' },
  { key: 'artist', label: 'Artista' },
  { key: 'label', label: 'Sello' },
  { key: 'year', label: 'Año' },
  { key: 'country', label: 'País' },
  { key: 'barcode', label: 'Código de barras' },
  { key: 'createdAt', label: 'Fecha de alta' },
];

const defaultProductColumns: ProductColumn[] = ['category', 'price', 'stock', 'status', 'createdAt'];

export default function ProductsPage() {
  const { user, refreshUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active,inactive");
  const [conditionFilter, setConditionFilter] = useState<string>("all"); // all, new, used
  const [categoryFilter, setCategoryFilter] = useState<string>("all"); // all or category ID
  const [stockFilter, setStockFilter] = useState<string>("all"); // all, in-stock, out-of-stock, low-stock
  const [wooFilter, setWooFilter] = useState<string>("all"); // all, synced, not-synced
  const [mercadoLibreFilter, setMercadoLibreFilter] = useState<string>("all"); // all, synced, not-synced
  const [sortBy, setSortBy] = useState<string>("newest"); // newest, updated-desc, name-asc, price-asc, price-desc, stock-desc
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  const [wooCommerceEnabled, setWooCommerceEnabled] = useState(false);
  const [mercadoLibreEnabled, setMercadoLibreEnabled] = useState(false);
  const [parisEnabled, setParisEnabled] = useState(false);
  const [falabellaEnabled, setFalabellaEnabled] = useState(false);
  const [syncingProduct, setSyncingProduct] = useState<string | null>(null);
  const [syncingMercadoLibreProduct, setSyncingMercadoLibreProduct] = useState<string | null>(null);
  const [mercadoLibreContextMenu, setMercadoLibreContextMenu] = useState<{
    product: Product;
    x: number;
    y: number;
  } | null>(null);
  const [syncingParisProduct, setSyncingParisProduct] = useState<string | null>(null);
  const [openingParisProduct, setOpeningParisProduct] = useState<string | null>(null);
  const [syncingFalabellaProduct, setSyncingFalabellaProduct] = useState<string | null>(null);
  const [syncingSelectedWoo, setSyncingSelectedWoo] = useState(false);
  const [syncingSelectedMercadoLibre, setSyncingSelectedMercadoLibre] = useState(false);
  const [syncingSelectedParis, setSyncingSelectedParis] = useState(false);
  const [syncingSelectedFalabella, setSyncingSelectedFalabella] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingWooTrash, setSyncingWooTrash] = useState(false);
  const [lastWooSyncResult, setLastWooSyncResult] = useState<any>(null);
  const [optimizingImages, setOptimizingImages] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockValue, setEditingStockValue] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [visibleColumns, setVisibleColumns] = useState<Set<ProductColumn>>(new Set(defaultProductColumns));
  const [bulkSyncProgress, setBulkSyncProgress] = useState<BulkSyncProgress>({
    open: false,
    marketplace: "",
    total: 0,
    completed: 0,
    succeeded: 0,
    failures: [],
    currentProduct: "",
    running: false,
  });

  // Edición masiva
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditSaving, setBulkEditSaving] = useState(false);
  const [vendorCategories, setVendorCategories] = useState<any[]>([]);
  const [availableFormats, setAvailableFormats] = useState<any[]>([]);
  const [bulkEditFields, setBulkEditFields] = useState({
    applyStatus: false,
    statusValue: 'active' as 'active' | 'inactive',
    applyCondition: false,
    condition: 'new' as 'new' | 'used',
    mediaGrade: '',
    sleeveGrade: '',
    applyStock: false,
    stock: '',
    applyCategories: false,
    categoryIds: [] as string[],
    applyFormat: false,
    formatName: '',
  });

  // Estado para modal de confirmación
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    productId: string | null;
    productName: string;
  }>({
    open: false,
    productId: null,
    productName: "",
  });
  
  const [deleteMultipleDialog, setDeleteMultipleDialog] = useState(false);
  const [emptyTrashDialog, setEmptyTrashDialog] = useState(false);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  
  // Estado para modal de Spotify
  const [spotifyModal, setSpotifyModal] = useState<{
    open: boolean;
    productId: string | null;
    spotifyAlbumId: string;
    spotifyEnabled: boolean;
    spotifyLoading: boolean;
    spotifyResults: any[];
  }>({
    open: false,
    productId: null,
    spotifyAlbumId: '',
    spotifyEnabled: false,
    spotifyLoading: false,
    spotifyResults: [],
  });
  
  // Estado para lightbox de galería
  const [lightbox, setLightbox] = useState<{
    open: boolean;
    images: string[];
    currentIndex: number;
    productTitle: string;
  }>({
    open: false,
    images: [],
    currentIndex: 0,
    productTitle: "",
  });

  // Refresh user profile on mount to ensure vendorId is up to date
  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    const savedColumns = localStorage.getItem('dashboard-product-columns');
    if (!savedColumns) return;

    try {
      const parsed = JSON.parse(savedColumns) as ProductColumn[];
      const validColumns = parsed.filter((column) => productColumnOptions.some((option) => option.key === column));
      setVisibleColumns(new Set(validColumns));
    } catch {
      localStorage.removeItem('dashboard-product-columns');
    }
  }, []);

  const toggleColumn = (column: ProductColumn) => {
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      localStorage.setItem('dashboard-product-columns', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const resetColumns = () => {
    const defaults = new Set(defaultProductColumns);
    setVisibleColumns(defaults);
    localStorage.setItem('dashboard-product-columns', JSON.stringify(defaultProductColumns));
  };

  const formatCreatedAt = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };

  const getMercadoLibreProductUrl = (product: Product) => {
    const itemId = product.mercadoLibreItemId?.trim();
    if (!itemId) return '';
    const formattedItemId = itemId.replace(/^([A-Za-z]{3})-?(\d+)$/, '$1-$2').toUpperCase();
    const titleSlug = product.title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return `https://articulo.mercadolibre.cl/${formattedItemId}-${titleSlug || 'producto'}-_JM`;
  };

  const getMercadoLibreState = (product: Product) => {
    if (!product.mercadoLibreItemId) {
      return {
        className: product.status === 'active' ? 'text-red-600 hover:text-red-700' : 'text-gray-400',
        title: product.status === 'active' ? 'No publicado en Mercado Libre. Haz clic para sincronizar.' : 'Producto local inactivo.',
      };
    }

    const remoteStatus = product.mercadoLibreStatus?.toLowerCase();
    const detail = product.mercadoLibreStatusDetail ? ` (${product.mercadoLibreStatusDetail})` : '';
    if (!remoteStatus) return { className: 'text-green-600', title: 'Vinculado con Mercado Libre. Estado remoto pendiente de actualización.' };
    if (remoteStatus === 'active') return { className: 'text-green-600', title: `Publicación activa en Mercado Libre${detail}.` };
    if (remoteStatus === 'paused' && product.stock > 0) {
      return { className: 'text-amber-500', title: `Publicación pausada en Mercado Libre, pero quedan ${product.stock} unidad(es) en MundoBeat${detail}.` };
    }
    if (remoteStatus === 'paused') return { className: 'text-gray-400', title: `Publicación pausada en Mercado Libre sin stock local${detail}.` };
    if (remoteStatus === 'under_review') return { className: 'text-amber-500', title: `Publicación en revisión por Mercado Libre${detail}.` };
    return { className: 'text-red-600', title: `Publicación ${remoteStatus} en Mercado Libre${detail}.` };
  };

  useEffect(() => {
    if (!mercadoLibreContextMenu) return;
    const closeMenu = () => setMercadoLibreContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mercadoLibreContextMenu]);

  useEffect(() => {
    if (user?.vendorId) {
      loadProducts();
      checkWooCommerceConfig();
      checkMercadoLibreConnection();
      checkParisConnection();
      checkFalabellaConnection();
      loadVendorCategories();
    }
  }, [user?.vendorId, statusFilter]); // Re-load when vendorId or statusFilter changes

  const loadVendorCategories = async () => {
    if (!user?.vendorId) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vendors/${user.vendorId}/categories`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const categories = await response.json();
        setVendorCategories(categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const checkWooCommerceConfig = async () => {
    if (!user?.vendorId) return;
    
    try {
      const settings = await api.getVendorSettings(user.vendorId);
      console.log('WooCommerce settings loaded:', settings);
      
      if (!settings) {
        console.warn('Settings is null or undefined');
        setWooCommerceEnabled(false);
        return;
      }
      
      setWooCommerceEnabled(
        !!(settings.wooStoreUrl && settings.wooClientKey && settings.wooClientSecret)
      );
    } catch (error) {
      console.error('Error checking WooCommerce config:', error);
      setWooCommerceEnabled(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      console.log('Current user:', user);
      console.log('VendorId:', user?.vendorId);
      console.log('Status filter:', statusFilter);
      
      // Usar el endpoint específico para productos del vendor con filtro de estado
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const params = new URLSearchParams();
      params.append('status', statusFilter);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/vendor/me?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await api.deleteProduct(id);
      setProducts(products.filter(p => p.id !== id));
      setSelectedProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      setLastWooSyncResult(summarizeWooTrashResults([result]));
    } catch (error: any) {
      alert(error.message || 'Error al eliminar producto');
    }
  };

  const checkMercadoLibreConnection = async () => {
    try {
      const response = await fetch(`${API_URL}/mercadolibre/connection`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      const connection = await response.json().catch(() => ({}));
      setMercadoLibreEnabled(response.ok && Boolean(connection.connected));
    } catch (error) {
      console.error('Error checking Mercado Libre connection:', error);
      setMercadoLibreEnabled(false);
    }
  };

  const checkParisConnection = async () => {
    try {
      const response = await fetch(`${API_URL}/paris/configuration`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      const configuration = await response.json().catch(() => ({}));
      setParisEnabled(response.ok && Boolean(configuration.connected));
    } catch (error) {
      console.error('Error checking Paris connection:', error);
      setParisEnabled(false);
    }
  };

  const checkFalabellaConnection = async () => {
    try {
      const response = await fetch(`${API_URL}/falabella/configuration`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      const configuration = await response.json().catch(() => ({}));
      setFalabellaEnabled(response.ok && Boolean(configuration.connected));
    } catch (error) {
      console.error('Error checking Falabella connection:', error);
      setFalabellaEnabled(false);
    }
  };

  const handleDeleteClick = (product: Product) => {
    setDeleteDialog({
      open: true,
      productId: product.id,
      productName: `${product.artist} - ${product.title}`,
    });
  };

  const confirmDelete = async () => {
    if (deleteDialog.productId) {
      await handleDelete(deleteDialog.productId);
      setDeleteDialog({ open: false, productId: null, productName: "" });
    }
  };

  const handleSelectProduct = (id: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const pageProductIds = paginatedProducts.map((product) => product.id);
    const allPageProductsSelected = pageProductIds.length > 0
      && pageProductIds.every((id) => selectedProducts.has(id));

    setSelectedProducts((current) => {
      const next = new Set(current);
      pageProductIds.forEach((id) => {
        if (allPageProductsSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const summarizeWooTrashResults = (results: any[], localFailures = 0) => {
    const details = results
      .map((result) => result?.woocommerceDelete || result?.woocommerceTrash)
      .filter(Boolean);
    const permanent = results.some((result) => result?.permanent === true);

    const synced = details.filter((item) => item.success && !item.skipped).length;
    const skipped = details.filter((item) => item.skipped).length;
    const failed = details.filter((item) => !item.success && !item.skipped).length + localFailures;

    return {
      total: results.length + localFailures,
      synced,
      skipped,
      failed,
      details,
      actionLabel: permanent ? 'Eliminados' : 'Sincronizados',
      message: `WooCommerce: ${synced} ${permanent ? 'eliminado(s)' : 'sincronizado(s)'}, ${skipped} omitido(s), ${failed} fallido(s)`,
    };
  };

  const handleDeleteMultiple = async () => {
    if (selectedProducts.size === 0) return;

    setDeletingMultiple(true);
    try {
      const idsToDelete = Array.from(selectedProducts);
      const deletedResults: any[] = [];
      const failedIds = new Set<string>();
      const batchSize = 5;

      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(id => api.deleteProduct(id)));

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            deletedResults.push(result.value);
          } else {
            failedIds.add(batch[index]);
            console.error('Error deleting product:', result.reason);
          }
        });
      }

      setProducts(products.filter(p => !idsToDelete.includes(p.id) || failedIds.has(p.id)));
      setSelectedProducts(new Set());

      const summary = summarizeWooTrashResults(deletedResults, failedIds.size);
      const mercadoLibreClosed = deletedResults.filter(
        (result) => result?.mercadoLibreClose?.success && !result?.mercadoLibreClose?.skipped,
      ).length;
      const mercadoLibreSkipped = deletedResults.filter(
        (result) => result?.mercadoLibreClose?.skipped,
      ).length;
      setLastWooSyncResult(summary);

      alert(
        `Se procesaron ${summary.total} producto(s)\n\n` +
        `Eliminados en MundoBeat: ${deletedResults.length}\n` +
        `Mercado Libre cerrados: ${mercadoLibreClosed}\n` +
        `Mercado Libre sin publicación: ${mercadoLibreSkipped}\n` +
        `WooCommerce ${summary.actionLabel.toLowerCase()}: ${summary.synced}\n` +
        `WooCommerce omitidos: ${summary.skipped}\n` +
        `Fallidos: ${summary.failed}`
      );
    } catch (error: any) {
      console.error('Error deleting products:', error);
      alert(error.message || 'Error al eliminar productos');
    } finally {
      setDeletingMultiple(false);
    }
  };

  const handleSyncProduct = async (productId: string) => {
    if (!user?.vendorId) return;
    
    setSyncingProduct(productId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/woocommerce/sync/${productId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al sincronizar producto');
      }

      const result = await response.json();
      
      // Actualizar el producto local con el woocommerceId
      setProducts(products.map(p => 
        p.id === productId 
          ? { ...p, woocommerceId: result.woocommerceId } 
          : p
      ));
      
      alert('✅ Producto sincronizado exitosamente');
    } catch (error: any) {
      console.error('Error syncing product:', error);
      alert('❌ ' + (error.message || 'Error al sincronizar producto'));
    } finally {
      setSyncingProduct(null);
    }
  };

  const handleSyncAll = async () => {
    if (!user?.vendorId) return;
    
    const activeProducts = products.filter(p => p.status === 'active');
    if (activeProducts.length === 0) {
      alert('No hay productos activos para sincronizar');
      return;
    }

    if (!confirm(`¿Sincronizar ${activeProducts.length} productos activos a WooCommerce?`)) {
      return;
    }
    
    setSyncingAll(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/woocommerce/sync-all/${user.vendorId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al sincronizar productos');
      }

      const result = await response.json();
      
      // Recargar productos para actualizar los woocommerceId
      await loadProducts();
      
      alert(`✅ Sincronización completa\n\n` +
            `Total: ${result.total}\n` +
            `Sincronizados: ${result.synced}\n` +
            `Errores: ${result.errors}`);
    } catch (error: any) {
      console.error('Error syncing all products:', error);
      alert('❌ ' + (error.message || 'Error al sincronizar productos'));
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncTrashToWooCommerce = async () => {
    if (!wooCommerceEnabled) return;

    setSyncingWooTrash(true);
    try {
      const result = await api.syncTrashToWooCommerce();
      setLastWooSyncResult(result);
      alert(result.message || 'Sincronización de papelera finalizada');
    } catch (error: any) {
      console.error('Error syncing WooCommerce trash:', error);
      alert(error.message || 'Error al sincronizar papelera con WooCommerce');
    } finally {
      setSyncingWooTrash(false);
    }
  };

  const handleSyncMercadoLibreProduct = async (product: Product) => {
    setSyncingMercadoLibreProduct(product.id);
    try {
      const response = await fetch(`${API_URL}/mercadolibre/products/${product.id}/publish`, {
        method: 'POST', headers: { Authorization: `Bearer ${api.getToken()}`, 'Content-Type': 'application/json' },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'No se pudo sincronizar con Mercado Libre');
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, mercadoLibreItemId: result.itemId, mercadoLibreStatus: result.status } : item));
      alert('✅ Producto sincronizado con Mercado Libre');
    } catch (error: any) {
      alert(`❌ ${error.message || 'No se pudo sincronizar con Mercado Libre'}`);
    } finally { setSyncingMercadoLibreProduct(null); }
  };

  const handleReconnectMercadoLibreProduct = async (product: Product) => {
    setMercadoLibreContextMenu(null);
    setSyncingMercadoLibreProduct(product.id);
    try {
      const response = await fetch(`${API_URL}/mercadolibre/products/${product.id}/reconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${api.getToken()}`, 'Content-Type': 'application/json' },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'No se pudo reconectar con Mercado Libre');
      setProducts((current) => current.map((item) => (
        item.id === product.id ? { ...item, mercadoLibreItemId: result.itemId || item.mercadoLibreItemId, mercadoLibreStatus: result.status } : item
      )));
      alert(`${result.action === 'paused' ? '⚠️' : '✅'} ${result.message || 'Producto reconectado con Mercado Libre'}`);
    } catch (error: any) {
      alert(`❌ ${error.message || 'No se pudo reconectar con Mercado Libre'}`);
    } finally {
      setSyncingMercadoLibreProduct(null);
    }
  };

  const handleDisconnectMercadoLibreProduct = async (product: Product) => {
    setMercadoLibreContextMenu(null);
    if (!product.mercadoLibreItemId) {
      alert('Este producto no tiene una publicación vinculada en Mercado Libre.');
      return;
    }
    if (!window.confirm('Se intentará finalizar la publicación en Mercado Libre. Si no es posible, quedará pausada. ¿Continuar?')) return;

    setSyncingMercadoLibreProduct(product.id);
    try {
      const response = await fetch(`${API_URL}/mercadolibre/products/${product.id}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${api.getToken()}`, 'Content-Type': 'application/json' },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'No se pudo desconectar de Mercado Libre');
      if (result.action === 'closed' || result.action === 'disconnected') {
        setProducts((current) => current.map((item) => (
          item.id === product.id ? { ...item, mercadoLibreItemId: undefined, mercadoLibreStatus: undefined, mercadoLibreStatusDetail: undefined } : item
        )));
      } else if (result.action === 'paused') {
        setProducts((current) => current.map((item) => (
          item.id === product.id ? { ...item, mercadoLibreStatus: result.status || 'paused' } : item
        )));
      }
      alert(`${result.action === 'paused' ? '⚠️' : '✅'} ${result.message || 'Acción completada en Mercado Libre'}`);
    } catch (error: any) {
      alert(`❌ ${error.message || 'No se pudo desconectar de Mercado Libre'}`);
    } finally {
      setSyncingMercadoLibreProduct(null);
    }
  };

  const handleOpenParisProduct = async (product: Product) => {
    const tab = window.open('about:blank', '_blank');
    if (!tab) { alert('Permite abrir ventanas para ver la publicación en Paris.'); return; }
    tab.opener = null;
    setOpeningParisProduct(product.id);
    try {
      const response = await fetch(`${API_URL}/paris/products/${product.id}/publication-link`, { headers: { Authorization: `Bearer ${api.getToken()}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'No se pudo obtener el enlace de Paris');
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || !['paris.cl', 'www.paris.cl'].includes(url.hostname) || url.username || url.password || url.port) throw new Error('El enlace devuelto por Paris no es válido');
      tab.location.href = url.href;
    } catch (error: any) {
      tab.close(); alert(error.message || 'No se pudo abrir la publicación de Paris');
    } finally { setOpeningParisProduct(null); }
  };

  const handleSyncParisProduct = async (product: Product) => {
    setSyncingParisProduct(product.id);
    try {
      const response = await fetch(`${API_URL}/paris/products/${product.id}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${api.getToken()}`, 'Content-Type': 'application/json' },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'No se pudo sincronizar con París');
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, parisProductId: result.productId } : item));
      alert('✅ Producto sincronizado con Marketplace Paris');
    } catch (error: any) {
      alert(`❌ ${error.message || 'No se pudo sincronizar con Marketplace Paris'}`);
    } finally {
      setSyncingParisProduct(null);
    }
  };

  const handleSyncFalabellaProduct = async (product: Product) => {
    setSyncingFalabellaProduct(product.id);
    try {
      const response = await fetch(`${API_URL}/falabella/products/${product.id}/publish`, {
        method: 'POST', headers: { Authorization: `Bearer ${api.getToken()}`, 'Content-Type': 'application/json' },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'No se pudo sincronizar con Falabella');
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, falabellaFeedId: result.feedId } : item));
      const imageMessage = result.imageFeedId ? ` También se envió el feed de imágenes ${result.imageFeedId}.` : result.imagesPending ? ' Cuando Falabella confirme la creación, sincronízalo nuevamente para cargar las imágenes.' : '';
      alert(`✅ Solicitud aceptada por Falabella (feed ${result.feedId}). Falabella debe procesarla antes de crear el producto; revisa el estado del feed en Seller Center.${imageMessage}`);
    } catch (error: any) {
      alert(`❌ ${error.message || 'No se pudo sincronizar con Falabella'}`);
    } finally { setSyncingFalabellaProduct(null); }
  };

  const syncErrorMessage = (payload: any, fallback: string) => {
    const message = payload?.message ?? payload?.error ?? fallback;
    if (Array.isArray(message)) return message.join(' · ');
    if (typeof message === 'object' && message) return JSON.stringify(message);
    return String(message || fallback);
  };

  const runSelectedSync = async (options: {
    marketplace: string;
    endpoint: (product: Product) => string;
    setSyncing: (value: boolean) => void;
    applyResult: (product: Product, result: any) => void;
    delayBetweenItemsMs?: number;
  }) => {
    const allSelected = products.filter((product) => selectedProducts.has(product.id));
    if (!allSelected.length) return alert(`Selecciona al menos un producto para sincronizar con ${options.marketplace}`);
    if (!confirm(`¿Sincronizar ${allSelected.length} producto(s) seleccionado(s) con ${options.marketplace}?`)) return;
    const selected = allSelected.filter((product) => product.status === 'active');
    const inactiveFailures = allSelected
      .filter((product) => product.status !== 'active')
      .map((product) => ({ productId: product.id, title: product.title, reason: 'El producto no está activo en MundoBeat.' }));

    options.setSyncing(true);
    setBulkSyncProgress({ open: true, marketplace: options.marketplace, total: allSelected.length, completed: inactiveFailures.length, succeeded: 0, failures: inactiveFailures, currentProduct: '', running: true });
    try {
      for (const [index, product] of selected.entries()) {
        setBulkSyncProgress((current) => ({ ...current, currentProduct: product.title }));
        let succeeded = false;
        let reason = '';
        try {
          const response = await fetch(options.endpoint(product), {
            method: 'POST',
            headers: { Authorization: `Bearer ${api.getToken()}`, 'Content-Type': 'application/json' },
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) reason = syncErrorMessage(result, `Error HTTP ${response.status}`);
          else {
            succeeded = true;
            options.applyResult(product, result);
          }
        } catch (error: any) {
          reason = error?.message || 'No se pudo conectar con el servicio';
        }
        setBulkSyncProgress((current) => ({
          ...current,
          completed: current.completed + 1,
          succeeded: current.succeeded + (succeeded ? 1 : 0),
          failures: succeeded ? current.failures : [...current.failures, { productId: product.id, title: product.title, reason }],
        }));
        if (options.delayBetweenItemsMs && index < selected.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, options.delayBetweenItemsMs));
        }
      }
    } finally {
      setSelectedProducts(new Set());
      options.setSyncing(false);
      setBulkSyncProgress((current) => ({ ...current, currentProduct: '', running: false }));
    }
  };

  const handleSyncSelectedWoo = () => runSelectedSync({
    marketplace: 'WooCommerce',
    endpoint: (product) => `${API_URL}/woocommerce/sync/${product.id}`,
    setSyncing: setSyncingSelectedWoo,
    applyResult: (product, result) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, woocommerceId: result.woocommerceId } : item)),
  });

  const handleSyncSelectedMercadoLibre = () => runSelectedSync({
    marketplace: 'Mercado Libre',
    endpoint: (product) => `${API_URL}/mercadolibre/products/${product.id}/publish`,
    setSyncing: setSyncingSelectedMercadoLibre,
    applyResult: (product, result) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, mercadoLibreItemId: result.itemId, mercadoLibreStatus: result.status } : item)),
    delayBetweenItemsMs: 1200,
  });

  const handleSyncSelectedParis = () => runSelectedSync({
    marketplace: 'París',
    endpoint: (product) => `${API_URL}/paris/products/${product.id}/publish`,
    setSyncing: setSyncingSelectedParis,
    applyResult: (product, result) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, parisProductId: result.productId } : item)),
  });

  const handleSyncSelectedFalabella = () => runSelectedSync({
    marketplace: 'Falabella',
    endpoint: (product) => `${API_URL}/falabella/products/${product.id}/publish`,
    setSyncing: setSyncingSelectedFalabella,
    applyResult: (product, result) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, falabellaFeedId: result.feedId } : item)),
  });

  const handleOptimizeExistingImages = async () => {
    if (!user?.vendorId) return;

    const limitRaw = prompt('Cantidad de productos a optimizar en este lote (1-200):', '20');
    if (limitRaw === null) return;

    const offsetRaw = prompt('Desde qué posición comenzar (offset):', '0');
    if (offsetRaw === null) return;

    const limit = Number(limitRaw);
    const offset = Number(offsetRaw);

    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      alert('El límite debe ser un entero entre 1 y 200');
      return;
    }

    if (!Number.isInteger(offset) || offset < 0) {
      alert('El offset debe ser un entero mayor o igual a 0');
      return;
    }

    if (!confirm(`Se optimizarán hasta ${limit} productos desde offset ${offset}. ¿Continuar?`)) {
      return;
    }

    setOptimizingImages(true);
    try {
      const result = await api.optimizeVendorProductImages(user.vendorId, {
        limit,
        offset,
        force: false,
      });

      alert(
        `✅ Optimización completada\n\n` +
        `Candidatos: ${result.totalCandidates}\n` +
        `Procesados: ${result.processed}\n` +
        `Omitidos: ${result.skipped}\n` +
        `Errores: ${result.failed}`,
      );
    } catch (error: any) {
      console.error('Error optimizing existing images:', error);
      alert('❌ ' + (error.message || 'Error al optimizar imágenes existentes'));
    } finally {
      setOptimizingImages(false);
    }
  };

  const confirmDeleteMultiple = async () => {
    await handleDeleteMultiple();
    setDeleteMultipleDialog(false);
  };

  const openBulkEditModal = async () => {
    setBulkEditFields({
      applyStatus: false,
      statusValue: 'active',
      applyCondition: false,
      condition: 'new',
      mediaGrade: '',
      sleeveGrade: '',
      applyStock: false,
      stock: '',
      applyCategories: false,
      categoryIds: [],
      applyFormat: false,
      formatName: '',
    });
    setShowBulkEditModal(true);
    // Cargar datos si no se han cargado aún
    if (vendorCategories.length === 0 || availableFormats.length === 0) {
      try {
        const token = localStorage.getItem('token');
        const [catsRes, fmtsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/vendors/${user?.vendorId}/categories`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/formats`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const cats = await catsRes.json();
        const fmts = await fmtsRes.json();
        setVendorCategories(Array.isArray(cats) ? cats : (cats.categories || []));
        setAvailableFormats(Array.isArray(fmts) ? fmts : []);
      } catch (err) {
        console.error('Error loading bulk edit data:', err);
      }
    }
  };

  const handleBulkEdit = async () => {
    if (!user?.vendorId) return;
    const { applyStatus, statusValue, applyCondition, condition, mediaGrade, sleeveGrade, applyStock, stock, applyCategories, categoryIds, applyFormat, formatName } = bulkEditFields;

    if (!applyStatus && !applyCondition && !applyStock && !applyCategories && !applyFormat) {
      alert('Activa al menos un campo para aplicar');
      return;
    }

    const updates: Record<string, any> = {};
    if (applyStatus) updates.status = statusValue;
    if (applyCondition) {
      updates.condition = condition;
      updates.mediaGrade = condition === 'used' ? mediaGrade : '';
      updates.sleeveGrade = condition === 'used' ? sleeveGrade : '';
    }
    if (applyStock && stock !== '') updates.stock = parseInt(stock);
    if (applyCategories) updates.categoryIds = categoryIds;
    if (applyFormat && formatName) updates.formatName = formatName;

    setBulkEditSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/bulk-update`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: Array.from(selectedProducts), updates }),
      });
      const result = await response.json();
      alert(`✅ Se actualizaron ${result.updated} producto(s)${result.errors > 0 ? ` (${result.errors} con error)` : ''}`);
      setShowBulkEditModal(false);
      setSelectedProducts(new Set());
      await loadProducts();
    } catch (err: any) {
      alert('Error al aplicar edición masiva');
      console.error(err);
    } finally {
      setBulkEditSaving(false);
    }
  };

  const openSpotifyModal = (product: Product) => {
    setSpotifyModal({
      open: true,
      productId: product.id,
      spotifyAlbumId: (product as any).spotifyAlbumId || '',
      spotifyEnabled: (product as any).spotifyEnabled !== false,
      spotifyLoading: false,
      spotifyResults: [],
    });
  };

  const closeSpotifyModal = () => {
    setSpotifyModal({
      open: false,
      productId: null,
      spotifyAlbumId: '',
      spotifyEnabled: false,
      spotifyLoading: false,
      spotifyResults: [],
    });
  };

  const searchSpotifyForProduct = async () => {
    if (!spotifyModal.productId) return;
    const product = products.find(p => p.id === spotifyModal.productId);
    if (!product) return;

    setSpotifyModal(prev => ({ ...prev, spotifyLoading: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/spotify/search?artist=${encodeURIComponent(product.artist)}&album=${encodeURIComponent(product.album || product.title)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setSpotifyModal(prev => ({
        ...prev,
        spotifyResults: data.albums || [],
        spotifyLoading: false,
      }));
    } catch (err) {
      console.error('Error searching Spotify:', err);
      setSpotifyModal(prev => ({ ...prev, spotifyLoading: false }));
      alert('Error al buscar en Spotify');
    }
  };

  const saveSpotifyChanges = async () => {
    if (!spotifyModal.productId) return;
    
    try {
      await api.updateProduct(spotifyModal.productId, {
        spotifyAlbumId: spotifyModal.spotifyAlbumId,
        spotifyEnabled: spotifyModal.spotifyEnabled,
      });
      alert('✅ Reproductor de Spotify actualizado');
      closeSpotifyModal();
      await loadProducts();
    } catch (err) {
      console.error('Error saving Spotify changes:', err);
      alert('Error al guardar cambios');
    }
  };

  const handleEmptyTrash = async () => {
    setEmptyingTrash(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/trash/empty?days=0`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al vaciar papelera');
      }

      const result = await response.json();
      
      // Recargar productos
      await loadProducts();
      
      alert(result.message || `Se eliminaron ${result.deleted} producto(s) de la papelera`);
      setEmptyTrashDialog(false);
    } catch (error: any) {
      console.error('Error emptying trash:', error);
      alert(error.message || 'Error al vaciar papelera');
    } finally {
      setEmptyingTrash(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    // Filtro de búsqueda (el filtro de estado ya se aplica en el servidor)
    const matchesSearch = product.title.toLowerCase().includes(search.toLowerCase()) ||
      product.artist?.toLowerCase().includes(search.toLowerCase());
    
    // Filtro de condición
    const matchesCondition = 
      conditionFilter === "all" ||
      (conditionFilter === "new" && product.condition === "new") ||
      (conditionFilter === "used" && product.condition === "used");
    
    // Filtro de categoría
    const matchesCategory = 
      categoryFilter === "all" ||
      product.categories?.some(cat => cat.id === categoryFilter);
    
    // Filtro de stock
    const matchesStock = 
      stockFilter === "all" ||
      (stockFilter === "in-stock" && product.stock > 0) ||
      (stockFilter === "out-of-stock" && product.stock === 0) ||
      (stockFilter === "low-stock" && product.stock > 0 && product.stock < 5);
    
    // Filtro de sincronización WooCommerce
    const matchesWoo = 
      wooFilter === "all" ||
      (wooFilter === "synced" && product.woocommerceId) ||
      (wooFilter === "not-synced" && !product.woocommerceId);

    const matchesMercadoLibre =
      mercadoLibreFilter === "all" ||
      (mercadoLibreFilter === "synced" && product.mercadoLibreItemId) ||
      (mercadoLibreFilter === "not-synced" && !product.mercadoLibreItemId);
    
    return matchesSearch && matchesCondition && matchesCategory && matchesStock && matchesWoo && matchesMercadoLibre;
  });

  // Ordenar productos
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "name-asc":
        const nameA = `${a.artist} - ${a.title}`.toLowerCase();
        const nameB = `${b.artist} - ${b.title}`.toLowerCase();
        return nameA.localeCompare(nameB);
      
      case "price-asc":
        return a.price - b.price;
      
      case "price-desc":
        return b.price - a.price;
      
      case "stock-desc":
        return b.stock - a.stock;

      case "createdAt-asc":
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();

      case "createdAt-desc":
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();

      case "updated-desc":
        return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();

      case "stock-asc":
        return a.stock - b.stock;

      case "mercadolibre-asc":
        return Number(Boolean(a.mercadoLibreItemId)) - Number(Boolean(b.mercadoLibreItemId));

      case "mercadolibre-desc":
        return Number(Boolean(b.mercadoLibreItemId)) - Number(Boolean(a.mercadoLibreItemId));
      
      case "newest":
      default:
        // Asumir que los productos más recientes vienen primero del backend
        return 0;
    }
  });

  // Calcular paginación
  const effectiveItemsPerPage = itemsPerPage === -1 ? Math.max(sortedProducts.length, 1) : itemsPerPage;
  const totalPages = Math.ceil(sortedProducts.length / effectiveItemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * effectiveItemsPerPage,
    currentPage * effectiveItemsPerPage
  );
  const mercadoLibrePausedWithStock = products.filter((product) => (
    product.mercadoLibreItemId
    && product.mercadoLibreStatus?.toLowerCase() === 'paused'
    && product.stock > 0
  ));

  const toggleSort = (column: 'price' | 'stock' | 'mercadolibre' | 'createdAt') => {
    const ascending = `${column}-asc`;
    const descending = `${column}-desc`;
    setSortBy((current) => current === ascending ? descending : ascending);
  };

  const sortIndicator = (column: 'price' | 'stock' | 'mercadolibre' | 'createdAt') => {
    if (sortBy === `${column}-asc`) return ' ↑';
    if (sortBy === `${column}-desc`) return ' ↓';
    return '';
  };

  // Resetear a página 1 cuando los filtros cambian
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, conditionFilter, categoryFilter, stockFilter, wooFilter, mercadoLibreFilter, sortBy]);

  // Resetear a página 1 cuando cambia itemsPerPage
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="text-gray-600 mt-2">Gestiona tu catálogo de productos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/products/import" className="hidden md:block">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
          </Link>
          <Link href="/dashboard/products/export" className="hidden md:block">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={handleOptimizeExistingImages}
            disabled={optimizingImages}
            className="hidden md:inline-flex"
          >
            {optimizingImages ? 'Optimizando...' : 'Optimizar Imágenes'}
          </Button>
          {wooCommerceEnabled && (
            <Button 
              variant="outline" 
              onClick={handleSyncAll}
              disabled={syncingAll || products.filter(p => p.status === 'active').length === 0}
            >
              {syncingAll ? (
                <>
                  <span className="mr-2 animate-spin">⟳</span>
                  Sincronizando...
                </>
              ) : (
                <>
                  <span className="mr-2">🔄</span>
                  Sincronizar Todos
                </>
              )}
            </Button>
          )}
          <Link href="/dashboard/products/new" className="hidden md:block">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Producto
            </Button>
          </Link>
          <Link href="/dashboard/escanear" className="md:hidden block">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Producto
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="search"
            placeholder="Buscar productos..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={loadProducts}>Actualizar</Button>
      </div>

      {mercadoLibreEnabled && mercadoLibrePausedWithStock.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div>
            <span className="font-semibold">Mercado Libre:</span>{' '}
            {mercadoLibrePausedWithStock.length === 1
              ? 'hay 1 publicación pausada que todavía tiene stock.'
              : `hay ${mercadoLibrePausedWithStock.length} publicaciones pausadas que todavía tienen stock.`}
          </div>
          <button
            type="button"
            className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
            onClick={() => {
              setSearch('');
              setMercadoLibreFilter('synced');
              setStockFilter('in-stock');
            }}
          >
            Revisar publicaciones
          </button>
        </div>
      )}

      {/* Filters - Compact dropdowns in a single row */}
      <div className="flex flex-wrap gap-3 items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        {/* Status */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-700">Mostrar:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
          >
            <option value="active,inactive">📁 Todos</option>
            <option value="active">✅ Activos</option>
            <option value="inactive">⏸️ Inactivos</option>
            <option value="trash">🗑️ Papelera</option>
          </select>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Condition */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-700">Condición:</span>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
          >
            <option value="all">📦 Todos</option>
            <option value="new">✨ Nuevos</option>
            <option value="used">🔄 Usados</option>
          </select>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Stock */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-700">Stock:</span>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
          >
            <option value="all">📊 Todos</option>
            <option value="in-stock">✅ Disponible</option>
            <option value="out-of-stock">❌ Agotado</option>
            <option value="low-stock">⚠️ Bajo</option>
          </select>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Category */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-700">Categoría:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer max-w-[180px]"
          >
            <option value="all">📂 Todas</option>
            {vendorCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon || '📁'} {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-700">Ordenar:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
          >
            <option value="newest">🆕 Más recientes</option>
            <option value="updated-desc">🔄 Últimos actualizados</option>
            <option value="name-asc">🔤 Nombre (A-Z)</option>
            <option value="price-asc">💵 Precio ⬆</option>
            <option value="price-desc">💰 Precio ⬇</option>
            <option value="stock-asc">📉 Stock ⬆</option>
            <option value="stock-desc">📈 Stock ⬇</option>
            {mercadoLibreEnabled && <option value="mercadolibre-asc">ML: no sincronizados primero</option>}
            {mercadoLibreEnabled && <option value="mercadolibre-desc">ML: sincronizados primero</option>}
          </select>
        </div>

        {/* WooCommerce Filter */}
        {wooCommerceEnabled && (
          <>
            <div className="w-px h-6 bg-gray-300" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-700">WooCommerce:</span>
              <select
                value={wooFilter}
                onChange={(e) => setWooFilter(e.target.value)}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
              >
                <option value="all">🔄 Todos</option>
                <option value="synced">✅ Sincronizados</option>
                <option value="not-synced">⚠️ No sincronizados</option>
              </select>
            </div>
          </>
        )}

        {/* Empty Trash button - only visible in trash view */}
        {statusFilter === "trash" && sortedProducts.length > 0 && (
          <>
            <div className="w-px h-6 bg-gray-300" />
            {wooCommerceEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncTrashToWooCommerce}
                disabled={syncingWooTrash}
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncingWooTrash ? 'animate-spin' : ''}`} />
                {syncingWooTrash ? 'Sincronizando...' : 'Sincronizar WooCommerce'}
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setEmptyTrashDialog(true)}
              disabled={emptyingTrash}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {emptyingTrash ? 'Vaciando...' : 'Vaciar Papelera'}
            </Button>
          </>
        )}

        {mercadoLibreEnabled && (
          <>
            <div className="w-px h-6 bg-gray-300" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-700">Mercado Libre:</span>
              <select
                value={mercadoLibreFilter}
                onChange={(e) => setMercadoLibreFilter(e.target.value)}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
              >
                <option value="all">🔄 Todos</option>
                <option value="synced">✅ Sincronizados</option>
                <option value="not-synced">⚠️ No sincronizados</option>
              </select>
            </div>
          </>
        )}
      </div>

      {lastWooSyncResult && (
        <div className={`rounded-lg border p-4 text-sm ${lastWooSyncResult.failed > 0 ? 'border-red-200 bg-red-50 text-red-900' : 'border-green-200 bg-green-50 text-green-900'}`}>
          <div className="font-semibold mb-2">Resultado en WooCommerce</div>
          <div className="grid gap-2 sm:grid-cols-4">
            <span>Total: {lastWooSyncResult.total ?? 0}</span>
            <span>{lastWooSyncResult.actionLabel || 'Sincronizados'}: {lastWooSyncResult.synced ?? 0}</span>
            <span>Omitidos: {lastWooSyncResult.skipped ?? 0}</span>
            <span>Fallidos: {lastWooSyncResult.failed ?? 0}</span>
          </div>
          {lastWooSyncResult.failed > 0 && (
            <p className="mt-2 text-red-700">Revisa la configuración o credenciales de WooCommerce si hay fallos.</p>
          )}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedProducts.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="font-medium text-blue-900">
              {selectedProducts.size} producto(s) seleccionado(s)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline"
              onClick={() => setSelectedProducts(new Set())}
            >
              Deseleccionar
            </Button>
            <Button
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
              onClick={openBulkEditModal}
            >
              ✏️ Edición Masiva
            </Button>
            {(wooCommerceEnabled || mercadoLibreEnabled || parisEnabled || falabellaEnabled) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-amber-300 text-amber-800 hover:bg-amber-50"
                    disabled={syncingSelectedWoo || syncingSelectedMercadoLibre || syncingSelectedParis || syncingSelectedFalabella}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${(syncingSelectedWoo || syncingSelectedMercadoLibre || syncingSelectedParis || syncingSelectedFalabella) ? 'animate-spin' : ''}`} />
                    Sincronizar con tiendas externas
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {mercadoLibreEnabled && <DropdownMenuItem onSelect={handleSyncSelectedMercadoLibre}>Mercado Libre</DropdownMenuItem>}
                  {wooCommerceEnabled && <DropdownMenuItem onSelect={handleSyncSelectedWoo}>WooCommerce</DropdownMenuItem>}
                  {parisEnabled && <DropdownMenuItem onSelect={handleSyncSelectedParis}>París</DropdownMenuItem>}
                  {falabellaEnabled && <DropdownMenuItem onSelect={handleSyncSelectedFalabella}>Falabella Seller Center</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button 
              variant="destructive"
              onClick={() => setDeleteMultipleDialog(true)}
              disabled={deletingMultiple}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deletingMultiple ? 'Eliminando...' : `Eliminar (${selectedProducts.size})`}
            </Button>
          </div>
        </div>
      )}

      {bulkSyncProgress.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="border-b p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Sincronización con {bulkSyncProgress.marketplace}</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {bulkSyncProgress.running
                      ? `Procesando ${Math.min(bulkSyncProgress.completed + 1, bulkSyncProgress.total)} de ${bulkSyncProgress.total}`
                      : `Proceso finalizado: ${bulkSyncProgress.completed} producto(s) revisado(s)`}
                  </p>
                </div>
                {!bulkSyncProgress.running && (
                  <button type="button" onClick={() => setBulkSyncProgress((current) => ({ ...current, open: false }))} className="text-2xl leading-none text-gray-400 hover:text-gray-700" aria-label="Cerrar">×</button>
                )}
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${bulkSyncProgress.failures.length ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${bulkSyncProgress.total ? Math.round((bulkSyncProgress.completed / bulkSyncProgress.total) * 100) : 0}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span>{bulkSyncProgress.completed} / {bulkSyncProgress.total}</span>
                <span className="font-semibold">{bulkSyncProgress.total ? Math.round((bulkSyncProgress.completed / bulkSyncProgress.total) * 100) : 0}%</span>
              </div>
              {bulkSyncProgress.running && bulkSyncProgress.currentProduct && (
                <p className="mt-3 truncate rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">Sincronizando: {bulkSyncProgress.currentProduct}</p>
              )}
            </div>

            <div className="overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-3 text-center"><p className="text-2xl font-bold">{bulkSyncProgress.total}</p><p className="text-xs text-gray-600">Total</p></div>
                <div className="rounded-lg bg-emerald-50 p-3 text-center text-emerald-800"><p className="text-2xl font-bold">{bulkSyncProgress.succeeded}</p><p className="text-xs">Sincronizados</p></div>
                <div className="col-span-2 rounded-lg bg-rose-50 p-3 text-center text-rose-800 sm:col-span-1"><p className="text-2xl font-bold">{bulkSyncProgress.failures.length}</p><p className="text-xs">No sincronizados</p></div>
              </div>

              {bulkSyncProgress.failures.length > 0 && (
                <div className="mt-5">
                  <h3 className="font-semibold text-rose-800">Productos que requieren revisión</h3>
                  <div className="mt-2 space-y-2">
                    {bulkSyncProgress.failures.map((failure) => (
                      <div key={failure.productId} className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">{failure.title}</p>
                            <p className="mt-1 break-words text-rose-700">{failure.reason}</p>
                          </div>
                          <Link href={`/dashboard/products/${failure.productId}/edit`} className="shrink-0 text-xs font-medium text-blue-700 hover:underline">Editar</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!bulkSyncProgress.running && bulkSyncProgress.failures.length === 0 && (
                <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Todos los productos se sincronizaron correctamente.</div>
              )}
            </div>

            {!bulkSyncProgress.running && (
              <div className="flex justify-end border-t p-4">
                <Button type="button" onClick={() => setBulkSyncProgress((current) => ({ ...current, open: false }))}>Cerrar</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-gray-600">Cargando productos...</p>
        </div>
      )}

      {/* Products Table */}
      {!loading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Todos los productos ({sortedProducts.length})</CardTitle>
            <details className="relative">
              <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Columns3 className="h-4 w-4" />
                Columnas
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-56 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-sm font-semibold text-gray-900">Columnas visibles</p>
                <div className="space-y-1">
                  {productColumnOptions.map((option) => (
                    <label key={option.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-gray-700 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(option.key)}
                        onChange={() => toggleColumn(option.key)}
                        className="h-4 w-4"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <button type="button" onClick={resetColumns} className="mt-3 flex w-full items-center justify-center gap-2 border-t pt-3 text-sm text-gray-600 hover:text-gray-900">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restablecer
                </button>
              </div>
            </details>
          </CardHeader>
          <CardContent className="!p-0 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-3 pl-4 font-semibold w-12 hidden md:table-cell">
                      <input
                        type="checkbox"
                        checked={paginatedProducts.length > 0 && paginatedProducts.every((product) => selectedProducts.has(product.id))}
                        onChange={handleSelectAll}
                        className="w-4 h-4 cursor-pointer"
                        title="Seleccionar los productos de esta página"
                      />
                    </th>
                    <th className="pb-3 font-semibold">Producto</th>
                    {visibleColumns.has('category') && <th className="pb-3 font-semibold hidden sm:table-cell">Categoría</th>}
                    {visibleColumns.has('price') && <th className="pb-3 font-semibold hidden sm:table-cell">
                      <button type="button" onClick={() => toggleSort('price')} className="hover:text-blue-600" title="Ordenar por precio">
                        Precio{sortIndicator('price')}
                      </button>
                    </th>}
                    {visibleColumns.has('stock') && <th className="pb-3 font-semibold hidden sm:table-cell">
                      <button type="button" onClick={() => toggleSort('stock')} className="hover:text-blue-600" title="Ordenar por stock">
                        Stock{sortIndicator('stock')}
                      </button>
                    </th>}
                    {visibleColumns.has('status') && <th className="pb-3 font-semibold hidden sm:table-cell">Estado</th>}
                    {visibleColumns.has('condition') && <th className="pb-3 font-semibold hidden sm:table-cell">Condición</th>}
                    {visibleColumns.has('format') && <th className="pb-3 font-semibold hidden sm:table-cell">Formato</th>}
                    {visibleColumns.has('artist') && <th className="pb-3 font-semibold hidden sm:table-cell">Artista</th>}
                    {visibleColumns.has('label') && <th className="pb-3 font-semibold hidden sm:table-cell">Sello</th>}
                    {visibleColumns.has('year') && <th className="pb-3 font-semibold hidden sm:table-cell">Año</th>}
                    {visibleColumns.has('country') && <th className="pb-3 font-semibold hidden sm:table-cell">País</th>}
                    {visibleColumns.has('barcode') && <th className="pb-3 font-semibold hidden sm:table-cell">Código de barras</th>}
                    {visibleColumns.has('createdAt') && (
                      <th className="pb-3 pr-4 font-semibold hidden sm:table-cell whitespace-nowrap">
                        <button type="button" onClick={() => toggleSort('createdAt')} className="hover:text-blue-600" title="Ordenar por fecha de alta">
                          Fecha de alta{sortIndicator('createdAt')}
                        </button>
                      </th>
                    )}
                    {wooCommerceEnabled && (
                      <th className="pb-3 font-semibold text-center hidden sm:table-cell">Woo</th>
                    )}
                    {mercadoLibreEnabled && (
                      <th className="pb-3 font-semibold text-center hidden sm:table-cell">
                        <button type="button" onClick={() => toggleSort('mercadolibre')} className="hover:text-blue-600" title="Ordenar por estado de Mercado Libre">
                          ML{sortIndicator('mercadolibre')}
                        </button>
                      </th>
                    )}
                    {parisEnabled && <th className="pb-3 font-semibold text-center hidden sm:table-cell">París</th>}
                    {falabellaEnabled && <th className="pb-3 font-semibold text-center hidden sm:table-cell">Falabella</th>}
                    <th className="pb-3 font-semibold hidden sm:table-cell">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => {
                    // Parsear imágenes
                    const parseImages = (images: any) => {
                      if (!images) return [];
                      if (Array.isArray(images)) return images;
                      try {
                        return JSON.parse(images);
                      } catch {
                        return [];
                      }
                    };

                    const images = parseImages(product.images);
                    const firstImage = images.length > 0 
                      ? (typeof images[0] === 'string' ? images[0] : images[0]?.url)
                      : product.imagen;
                    const imageUrl = firstImage ? getImageUrl(firstImage) : null;

                    return (
                  <tr key={product.id} className={`border-b ${selectedProducts.has(product.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="py-4 pl-4 hidden md:table-cell">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Thumbnail de la imagen - clickeable para abrir galería */}
                        {imageUrl ? (
                          <img 
                            src={imageUrl} 
                            alt={product.title}
                            className="w-10 h-10 object-cover rounded border border-gray-200 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              const allImages = images.map((img: any) => 
                                typeof img === 'string' ? getImageUrl(img) : getImageUrl(img?.url)
                              ).filter(Boolean);
                              if (allImages.length > 0) {
                                setLightbox({
                                  open: true,
                                  images: allImages,
                                  currentIndex: 0,
                                  productTitle: product.title,
                                });
                              }
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-400 text-xs">📦</span>
                          </div>
                        )}
                        {/* Información del producto */}
                        <div className="min-w-0">
                          <Link href={`/dashboard/products/${product.id}/edit`} className="hover:text-purple-600 hover:underline">
                            <p className="font-normal truncate" title={product.title}>
                              {product.title.length > 35 ? `${product.title.substring(0, 35)}...` : product.title}
                            </p>
                          </Link>
                          <div className="text-sm text-gray-500 hidden sm:flex items-center gap-2 min-w-0">
                            <span className="truncate">
                              {product.sku ? `SKU: ${product.sku}` : <span className="italic text-gray-400">Sin SKU</span>}
                            </span>
                            <a
                              href={`/productos/${product.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver producto"
                              aria-label="Ver producto"
                              className="text-gray-400 hover:text-slate-700 transition-colors flex-shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => openSpotifyModal(product)}
                              title={(product as any).spotifyEnabled && (product as any).spotifyAlbumId ? 'Editar reproductor de Spotify' : 'Agregar reproductor de Spotify'}
                              data-spotify-id={String((product as any).spotifyAlbumId || '')}
                              data-spotify-enabled={(product as any).spotifyEnabled}
                              className={`flex-shrink-0 transition-colors ${
                                (product as any).spotifyEnabled === true && (product as any).spotifyAlbumId
                                  ? 'text-green-500 hover:text-green-700' 
                                  : 'text-red-400 hover:text-red-600'
                              }`}
                            >
                              <Music className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* Móvil: categoría y stock bajo el nombre */}
                          <div className="sm:hidden flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            {product.categories && product.categories.length > 0 && (
                              <span className="text-xs text-gray-500 truncate max-w-[100px]">
                                {product.categories.map(c => c.name).join(', ')}
                              </span>
                            )}
                            <span className={`text-xs ${product.stock < 5 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                              ({product.stock})
                            </span>
                            <span className="text-xs text-gray-400">
                              ({formatPrice(product.price)})
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    {visibleColumns.has('category') && <td className="py-4 hidden sm:table-cell">
                      {product.categories && product.categories.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {product.categories.map(cat => (
                            <Badge key={cat.id} variant="outline">{cat.name}</Badge>
                          ))}
                        </div>
                      ) : (
                        <Badge variant="outline">Sin categoría</Badge>
                      )}
                    </td>}
                    {visibleColumns.has('price') && <td className="py-4 hidden sm:table-cell">{formatPrice(product.price)}</td>}
                    {visibleColumns.has('stock') && <td className="py-4 hidden sm:table-cell">
                      {editingStockId === product.id ? (
                        <form
                          className="flex items-center gap-1"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const val = parseInt(editingStockValue);
                            if (isNaN(val) || val < 0) return;
                            try {
                              await api.updateProduct(product.id, { stock: val });
                              setEditingStockId(null);
                              await loadProducts();
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                        >
                          <input
                            type="number"
                            min="0"
                            className="w-16 px-1 py-0.5 text-sm border border-blue-400 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={editingStockValue}
                            onChange={(e) => setEditingStockValue(e.target.value)}
                            onBlur={() => setEditingStockId(null)}
                            autoFocus
                          />
                        </form>
                      ) : (
                        <span
                          className={`cursor-pointer hover:underline ${product.stock < 5 ? "text-red-600 font-semibold" : ""}`}
                          title="Clic para editar stock"
                          onClick={() => {
                            setEditingStockId(product.id);
                            setEditingStockValue(String(product.stock));
                          }}
                        >
                          {product.stock}
                        </span>
                      )}
                    </td>}
                    {visibleColumns.has('status') && <td className="py-4 hidden sm:table-cell">
                      {product.status === "active" && (
                        <Badge
                          className="bg-green-100 text-green-800 cursor-pointer hover:bg-red-100 hover:text-red-800 transition-colors"
                          title="Cambiar a inactivo"
                          onClick={async () => {
                            try {
                              await api.updateProduct(product.id, { status: "inactive" });
                              await loadProducts();
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                        >✅ Activo</Badge>
                      )}
                      {product.status === "inactive" && (
                        <Badge
                          variant="secondary"
                          className="cursor-pointer hover:bg-green-100 hover:text-green-800 transition-colors"
                          title="Cambiar a activo"
                          onClick={async () => {
                            try {
                              await api.updateProduct(product.id, { status: "active" });
                              await loadProducts();
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                        >⏸️ Inactivo</Badge>
                      )}
                      {product.status === "trash" && (
                        <Badge variant="destructive">🗑️ Papelera</Badge>
                      )}
                    </td>}
                    {visibleColumns.has('condition') && (
                      <td className="py-4 hidden sm:table-cell">{product.condition === 'new' ? 'Nuevo' : 'Usado'}</td>
                    )}
                    {visibleColumns.has('format') && <td className="py-4 hidden sm:table-cell">{product.format || product.type || '—'}</td>}
                    {visibleColumns.has('artist') && <td className="py-4 hidden sm:table-cell">{product.artist || '—'}</td>}
                    {visibleColumns.has('label') && <td className="py-4 hidden sm:table-cell">{product.label || '—'}</td>}
                    {visibleColumns.has('year') && <td className="py-4 hidden sm:table-cell">{product.year || '—'}</td>}
                    {visibleColumns.has('country') && <td className="py-4 hidden sm:table-cell">{product.country || '—'}</td>}
                    {visibleColumns.has('barcode') && <td className="py-4 hidden sm:table-cell">{product.barcode || '—'}</td>}
                    {visibleColumns.has('createdAt') && (
                      <td className="py-4 pr-4 hidden sm:table-cell whitespace-nowrap">{formatCreatedAt(product.createdAt)}</td>
                    )}
                    {wooCommerceEnabled && (
                      <td className="py-4 text-center hidden sm:table-cell">
                        <button
                          onClick={() => handleSyncProduct(product.id)}
                          disabled={syncingProduct === product.id || product.status !== 'active'}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={product.woocommerceId ? 'Sincronizado' : 'Click para sincronizar'}
                        >
                          {syncingProduct === product.id ? (
                            <span className="text-yellow-500 text-xl animate-spin">⟳</span>
                          ) : (
                            <span 
                              className={`text-2xl font-bold ${
                                product.woocommerceId 
                                  ? 'text-green-600' 
                                  : product.status === 'active' 
                                    ? 'text-red-600 hover:text-red-700' 
                                    : 'text-gray-400'
                              }`}
                            >
                              W
                            </span>
                          )}
                        </button>
                      </td>
                    )}
                    {mercadoLibreEnabled && (
                      <td
                        className="py-4 text-center hidden sm:table-cell"
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setMercadoLibreContextMenu({
                            product,
                            x: Math.min(event.clientX, window.innerWidth - 240),
                            y: Math.min(event.clientY, window.innerHeight - 150),
                          });
                        }}
                        title="Clic derecho para ver opciones de Mercado Libre"
                      >
                        <div className="inline-flex items-center justify-center gap-0.5">
                          {(() => {
                            const mercadoLibreState = getMercadoLibreState(product);
                            return <button
                            onClick={() => handleSyncMercadoLibreProduct(product)}
                            disabled={syncingMercadoLibreProduct === product.id || product.status !== 'active'}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={mercadoLibreState.title}
                          >
                            {syncingMercadoLibreProduct === product.id ? <span className="text-yellow-500 text-xl animate-spin">⟳</span> : <span className={`text-sm font-bold ${mercadoLibreState.className}`}>ML</span>}
                          </button>;
                          })()}
                          {product.mercadoLibreItemId && (
                            <a
                              href={getMercadoLibreProductUrl(product)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600"
                              title="Ver publicación en Mercado Libre"
                              aria-label={`Ver ${product.title} en Mercado Libre`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    )}
                    {parisEnabled && (
                      <td className="py-4 text-center hidden sm:table-cell">
                        <div className="inline-flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => handleSyncParisProduct(product)}
                          disabled={syncingParisProduct === product.id || product.status !== 'active'}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={product.parisProductId ? 'Sincronizado con Marketplace Paris' : 'Click para sincronizar con Marketplace Paris'}
                        >
                          {syncingParisProduct === product.id ? (
                            <span className="text-yellow-500 text-xl animate-spin">⟳</span>
                          ) : (
                            <span className={`text-sm font-bold ${product.parisProductId ? 'text-green-600' : product.status === 'active' ? 'text-red-600 hover:text-red-700' : 'text-gray-400'}`}>P</span>
                          )}
                        </button>
                        {product.parisProductId && <button type="button" onClick={() => handleOpenParisProduct(product)} disabled={openingParisProduct === product.id} title="Ver publicación en Paris" aria-label={`Ver ${product.title} en Paris`} className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 disabled:opacity-50"><ExternalLink className={`h-3.5 w-3.5 ${openingParisProduct === product.id ? 'animate-pulse' : ''}`} /></button>}
                        </div>
                      </td>
                    )}
                    {falabellaEnabled && (
                      <td className="py-4 text-center hidden sm:table-cell">
                        <button
                          onClick={() => handleSyncFalabellaProduct(product)}
                          disabled={syncingFalabellaProduct === product.id || product.status !== 'active'}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={product.falabellaFeedId ? 'Enviado a Falabella' : 'Click para enviar a Falabella'}
                        >
                          {syncingFalabellaProduct === product.id ? <span className="text-yellow-500 text-xl animate-spin">⟳</span> : <span className={`text-sm font-bold ${product.falabellaFeedId ? 'text-green-600' : product.status === 'active' ? 'text-red-600 hover:text-red-700' : 'text-gray-400'}`}>F</span>}
                        </button>
                      </td>
                    )}
                    <td className="py-4 hidden sm:table-cell">
                      <div className="flex gap-2">
                        <Link href={`/dashboard/products/${product.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteClick(product)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Paginator */}
              {sortedProducts.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t bg-white">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      Mostrando <span className="font-semibold">{(currentPage - 1) * effectiveItemsPerPage + 1}</span> a <span className="font-semibold">{Math.min(currentPage * effectiveItemsPerPage, sortedProducts.length)}</span> de <span className="font-semibold">{sortedProducts.length}</span> productos
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Por página:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={-1}>Todos</option>
                      </select>
                    </div>
                  </div>
                  
                  {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Página anterior"
                    >
                      ← Anterior
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                        // Mostrar números de página: primero 2, últimos 2, y actual ±1
                        const showPage = 
                          page <= 2 || 
                          page > totalPages - 2 || 
                          Math.abs(page - currentPage) <= 1;
                        
                        if (!showPage && page !== 3 && page !== totalPages - 2) return null;
                        
                        return (
                          <div key={page}>
                            {page === 3 && currentPage > 4 && <span className="text-gray-400 px-1">...</span>}
                            {showPage && (
                              <button
                                onClick={() => setCurrentPage(page)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                  currentPage === page
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {page}
                              </button>
                            )}
                            {page === totalPages - 2 && currentPage < totalPages - 3 && <span className="text-gray-400 px-1">...</span>}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Próxima página"
                    >
                      Siguiente →
                    </button>
                  </div>
                  )}
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Modal Edición Masiva */}
      {showBulkEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b shrink-0">
              <div>
                <h3 className="text-lg font-semibold">Edición Masiva</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Aplica cambios a <strong>{selectedProducts.size}</strong> producto{selectedProducts.size !== 1 ? 's' : ''} seleccionado{selectedProducts.size !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => setShowBulkEditModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3 overflow-y-auto">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ Activa solo los campos que deseas modificar. Los campos desactivados no serán cambiados.
              </p>

              {/* Condición */}
              <div className="border rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 font-medium text-sm cursor-pointer select-none">
                  <input type="checkbox" className="w-4 h-4 accent-purple-600"
                    checked={bulkEditFields.applyCondition}
                    onChange={e => setBulkEditFields(f => ({ ...f, applyCondition: e.target.checked }))} />
                  Condición
                </label>
                {bulkEditFields.applyCondition && (
                  <div className="pl-6 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        onClick={() => setBulkEditFields(f => ({ ...f, condition: 'new', mediaGrade: '', sleeveGrade: '' }))}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          bulkEditFields.condition === 'new'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>🆕 Nuevo</button>
                      <button type="button"
                        onClick={() => setBulkEditFields(f => ({ ...f, condition: 'used' }))}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          bulkEditFields.condition === 'used'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>💿 Usado</button>
                    </div>
                    {bulkEditFields.condition === 'used' && (
                      <div className="grid grid-cols-2 gap-3 bg-amber-50 rounded-lg p-3">
                        <div>
                          <label className="text-xs font-medium block mb-1">Medio (Goldmine)</label>
                          <select className="w-full border rounded px-2 py-1.5 text-sm"
                            value={bulkEditFields.mediaGrade}
                            onChange={e => setBulkEditFields(f => ({ ...f, mediaGrade: e.target.value }))}>
                            <option value="">-- Seleccionar --</option>
                            <option value="M">M — Mint</option>
                            <option value="NM">NM — Near Mint</option>
                            <option value="VG+">VG+ — Very Good Plus</option>
                            <option value="VG">VG — Very Good</option>
                            <option value="G+">G+ — Good Plus</option>
                            <option value="G">G — Good</option>
                            <option value="P">P — Poor</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium block mb-1">Portada (Goldmine)</label>
                          <select className="w-full border rounded px-2 py-1.5 text-sm"
                            value={bulkEditFields.sleeveGrade}
                            onChange={e => setBulkEditFields(f => ({ ...f, sleeveGrade: e.target.value }))}>
                            <option value="">-- Seleccionar --</option>
                            <option value="M">M — Mint</option>
                            <option value="NM">NM — Near Mint</option>
                            <option value="VG+">VG+ — Very Good Plus</option>
                            <option value="VG">VG — Very Good</option>
                            <option value="G+">G+ — Good Plus</option>
                            <option value="G">G — Good</option>
                            <option value="P">P — Poor</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Stock */}
              <div className="border rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 font-medium text-sm cursor-pointer select-none">
                  <input type="checkbox" className="w-4 h-4 accent-purple-600"
                    checked={bulkEditFields.applyStock}
                    onChange={e => setBulkEditFields(f => ({ ...f, applyStock: e.target.checked }))} />
                  Stock
                </label>
                {bulkEditFields.applyStock && (
                  <div className="pl-6">
                    <input type="number" min="0"
                      value={bulkEditFields.stock}
                      onChange={e => setBulkEditFields(f => ({ ...f, stock: e.target.value }))}
                      placeholder="Ej: 5"
                      className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                )}
              </div>

              {/* Categoría */}
              <div className="border rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 font-medium text-sm cursor-pointer select-none">
                  <input type="checkbox" className="w-4 h-4 accent-purple-600"
                    checked={bulkEditFields.applyCategories}
                    onChange={e => setBulkEditFields(f => ({ ...f, applyCategories: e.target.checked }))} />
                  Categoría
                </label>
                {bulkEditFields.applyCategories && (
                  <div className="pl-6 space-y-1">
                    {vendorCategories.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Cargando categorías...</p>
                    ) : (
                      <select multiple size={4}
                        value={bulkEditFields.categoryIds}
                        onChange={e => setBulkEditFields(f => ({ ...f, categoryIds: Array.from(e.target.selectedOptions).map(o => o.value) }))}
                        className="w-full border rounded px-2 py-1.5 text-sm">
                        {vendorCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    )}
                    <p className="text-xs text-muted-foreground">Ctrl/Cmd + clic para seleccionar múltiples</p>
                  </div>
                )}
              </div>

              {/* Estado */}
              <div className="border rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 font-medium text-sm cursor-pointer select-none">
                  <input type="checkbox" className="w-4 h-4 accent-purple-600"
                    checked={bulkEditFields.applyStatus}
                    onChange={e => setBulkEditFields(f => ({ ...f, applyStatus: e.target.checked }))} />
                  Estado (publicar / despublicar)
                </label>
                {bulkEditFields.applyStatus && (
                  <div className="pl-6">
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        onClick={() => setBulkEditFields(f => ({ ...f, statusValue: 'active' }))}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          bulkEditFields.statusValue === 'active'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>✅ Publicar</button>
                      <button type="button"
                        onClick={() => setBulkEditFields(f => ({ ...f, statusValue: 'inactive' }))}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          bulkEditFields.statusValue === 'inactive'
                            ? 'border-gray-500 bg-gray-100 text-gray-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>⏸️ Despublicar</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Formato */}
              <div className="border rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 font-medium text-sm cursor-pointer select-none">
                  <input type="checkbox" className="w-4 h-4 accent-purple-600"
                    checked={bulkEditFields.applyFormat}
                    onChange={e => setBulkEditFields(f => ({ ...f, applyFormat: e.target.checked }))} />
                  Formato
                </label>
                {bulkEditFields.applyFormat && (
                  <div className="pl-6">
                    <select value={bulkEditFields.formatName}
                      onChange={e => setBulkEditFields(f => ({ ...f, formatName: e.target.value }))}
                      className="w-full border rounded px-2 py-1.5 text-sm">
                      <option value="">-- Seleccionar formato --</option>
                      {availableFormats.map(fmt => (
                        <option key={fmt.id} value={fmt.name}>{fmt.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl shrink-0">
              <Button variant="outline" onClick={() => setShowBulkEditModal(false)} disabled={bulkEditSaving}>
                Cancelar
              </Button>
              <Button
                onClick={handleBulkEdit}
                disabled={bulkEditSaving}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {bulkEditSaving
                  ? <><span className="mr-2 inline-block animate-spin">⟳</span>Aplicando...</>
                  : <>✏️ Aplicar a {selectedProducts.size} producto{selectedProducts.size !== 1 ? 's' : ''}</>
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modales de confirmación */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        onConfirm={confirmDelete}
        title={statusFilter === "trash" ? "¿Eliminar permanentemente?" : "¿Eliminar producto?"}
        description={
          statusFilter === "trash"
            ? `¿Estás seguro de que deseas eliminar permanentemente "${deleteDialog.productName}"? Esta acción es DEFINITIVA y no se puede recuperar. Las ventas anteriores conservarán los datos históricos del producto.`
            : `¿Estás seguro de que deseas mover "${deleteDialog.productName}" a la papelera? Podrás recuperarlo después si es necesario.`
        }
        confirmText={statusFilter === "trash" ? "Eliminar Permanentemente" : "Mover a Papelera"}
        cancelText="Cancelar"
        variant="destructive"
      />

      <ConfirmDialog
        open={deleteMultipleDialog}
        onOpenChange={setDeleteMultipleDialog}
        onConfirm={confirmDeleteMultiple}
        title={statusFilter === "trash" ? "¿Eliminar permanentemente?" : "¿Eliminar productos?"}
        description={
          statusFilter === "trash"
            ? `¿Estás seguro de que deseas eliminar permanentemente ${selectedProducts.size} producto(s)? Esta acción es DEFINITIVA y no se puede recuperar. Las ventas anteriores conservarán sus datos históricos.`
            : `¿Estás seguro de que deseas mover ${selectedProducts.size} producto(s) a la papelera? Podrás recuperarlos después si es necesario.`
        }
        confirmText={
          statusFilter === "trash"
            ? `Eliminar Permanentemente ${selectedProducts.size} producto(s)`
            : `Mover ${selectedProducts.size} producto(s) a Papelera`
        }
        cancelText="Cancelar"
        variant="destructive"
        loading={deletingMultiple}
      />

      <ConfirmDialog
        open={emptyTrashDialog}
        onOpenChange={setEmptyTrashDialog}
        onConfirm={handleEmptyTrash}
        title="¿Vaciar papelera?"
        description={`¿Estás seguro de que deseas vaciar la papelera? Se eliminarán permanentemente todos los productos que no tengan ventas asociadas. Los productos con ventas permanecerán en papelera para preservar el historial. Esta acción no se puede deshacer.`}
        confirmText="Vaciar Papelera"
        cancelText="Cancelar"
        variant="destructive"
        loading={emptyingTrash}
      />

      {/* Lightbox Modal para Galería de Imágenes */}
      {lightbox.open && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox({ ...lightbox, open: false })}
        >
          {/* Close Button */}
          <button
            onClick={() => setLightbox({ ...lightbox, open: false })}
            className="absolute top-4 right-4 z-[10000] text-white hover:text-gray-300 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image Counter & Title */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] text-white text-sm bg-black/50 px-4 py-2 rounded-full">
            {lightbox.currentIndex + 1} / {lightbox.images.length} - {lightbox.productTitle}
          </div>

          {/* Previous Arrow */}
          {lightbox.images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(prev => ({
                  ...prev,
                  currentIndex: prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.images.length - 1
                }));
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-[10000] bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all duration-200 hover:scale-110"
              aria-label="Imagen anterior"
            >
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Main Image */}
          <div 
            className="relative max-w-4xl max-h-[80vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.images[lightbox.currentIndex]}
              alt={`${lightbox.productTitle} - ${lightbox.currentIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>

          {/* Next Arrow */}
          {lightbox.images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(prev => ({
                  ...prev,
                  currentIndex: prev.currentIndex < prev.images.length - 1 ? prev.currentIndex + 1 : 0
                }));
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-[10000] bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all duration-200 hover:scale-110"
              aria-label="Imagen siguiente"
            >
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Thumbnails */}
          {lightbox.images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[10000] flex gap-2 bg-black/50 p-2 rounded-lg max-w-[90vw] overflow-x-auto">
              {lightbox.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox(prev => ({ ...prev, currentIndex: idx }));
                  }}
                  className={`w-12 h-12 rounded border-2 overflow-hidden flex-shrink-0 transition-all ${
                    idx === lightbox.currentIndex ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Reproductor de Spotify */}
      {spotifyModal.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <h3 className="text-lg font-semibold">Reproductor de Spotify</h3>
              <button
                onClick={closeSpotifyModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Reproductor Preview */}
              {spotifyModal.spotifyAlbumId && spotifyModal.spotifyEnabled && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Vista Previa</Label>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <iframe
                      style={{ borderRadius: '12px' }}
                      src={`https://open.spotify.com/embed/album/${spotifyModal.spotifyAlbumId}?utm_source=generator&theme=0`}
                      width="100%"
                      height="352"
                      frameBorder="0"
                      allowFullScreen={true}
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    />
                  </div>
                </div>
              )}

              {/* Spotify Album ID */}
              <div className="space-y-2">
                <Label htmlFor="spotify-album-id">ID del Álbum en Spotify</Label>
                <div className="flex gap-2">
                  <Input
                    id="spotify-album-id"
                    value={spotifyModal.spotifyAlbumId}
                    onChange={(e) => setSpotifyModal(prev => ({ ...prev, spotifyAlbumId: e.target.value }))}
                    placeholder="ej: 1DiMWaLpHZ1rY0ZDwmJb9S"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={searchSpotifyForProduct}
                    disabled={spotifyModal.spotifyLoading}
                    variant="outline"
                  >
                    {spotifyModal.spotifyLoading ? '🔍 Buscando...' : '🔍 Buscar'}
                  </Button>
                </div>
              </div>

              {/* Resultados de búsqueda de Spotify */}
              {spotifyModal.spotifyResults.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Resultados de Búsqueda</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                    {spotifyModal.spotifyResults.map((album: any) => (
                      <div
                        key={album.id}
                        onClick={() => setSpotifyModal(prev => ({ ...prev, spotifyAlbumId: album.id, spotifyResults: [] }))}
                        className="border rounded-lg p-3 hover:border-green-500 cursor-pointer transition-colors bg-gray-50 hover:bg-green-50"
                      >
                        <div className="flex gap-3">
                          {album.image && (
                            <img
                              src={album.image}
                              alt={album.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">{album.name}</h4>
                            <p className="text-xs text-gray-600 truncate">{album.artist}</p>
                            <p className="text-xs text-gray-500">{album.releaseDate}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Toggle para mostrar/ocultar reproductor */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                <div className="flex-1">
                  <Label htmlFor="spotify-enabled" className="text-base font-medium cursor-pointer">
                    Mostrar Reproductor
                  </Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Muestra el reproductor en la página del producto
                  </p>
                </div>
                <Switch
                  id="spotify-enabled"
                  checked={spotifyModal.spotifyEnabled}
                  onCheckedChange={(checked) => setSpotifyModal(prev => ({ ...prev, spotifyEnabled: checked }))}
                  disabled={!spotifyModal.spotifyAlbumId}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 border-t shrink-0">
              <Button
                variant="outline"
                onClick={closeSpotifyModal}
              >
                Cancelar
              </Button>
              <Button
                onClick={saveSpotifyChanges}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Guardar Cambios
              </Button>
            </div>
          </div>
        </div>
      )}
      {mercadoLibreContextMenu && typeof document !== 'undefined' && createPortal(
        <div
          role="menu"
          aria-label={`Opciones de Mercado Libre para ${mercadoLibreContextMenu.product.title}`}
          className="fixed z-[100] min-w-56 rounded-md border border-gray-200 bg-white p-1 text-sm text-gray-800 shadow-xl"
          style={{ left: mercadoLibreContextMenu.x, top: mercadoLibreContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            disabled={mercadoLibreContextMenu.product.status !== 'active' || syncingMercadoLibreProduct === mercadoLibreContextMenu.product.id}
            onClick={() => handleReconnectMercadoLibreProduct(mercadoLibreContextMenu.product)}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Reconectar
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!mercadoLibreContextMenu.product.mercadoLibreItemId || syncingMercadoLibreProduct === mercadoLibreContextMenu.product.id}
            onClick={() => handleDisconnectMercadoLibreProduct(mercadoLibreContextMenu.product)}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Link2Off className="h-4 w-4" />
            Desconectar de Mercado Libre
          </button>
          <a
            role="menuitem"
            href={getMercadoLibreProductUrl(mercadoLibreContextMenu.product) || undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!mercadoLibreContextMenu.product.mercadoLibreItemId}
            onClick={(event) => {
              if (!mercadoLibreContextMenu.product.mercadoLibreItemId) event.preventDefault();
              else setMercadoLibreContextMenu(null);
            }}
            className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left focus:outline-none ${
              mercadoLibreContextMenu.product.mercadoLibreItemId
                ? 'hover:bg-gray-100 focus:bg-gray-100'
                : 'pointer-events-none opacity-50'
            }`}
          >
            <ExternalLink className="h-4 w-4" />
            Ver en Mercado Libre
          </a>
        </div>,
        document.body,
      )}
    </div>
  );
}
