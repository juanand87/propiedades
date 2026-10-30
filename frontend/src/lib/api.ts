// Detectar si estamos en localhost o en red local
const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Fallback por defecto (nunca debería llegar aquí en producción)
  console.warn('⚠️ NEXT_PUBLIC_API_URL not defined, using fallback: http://localhost:3001/api');
  return 'http://localhost:3001/api';
};

export const API_URL = getApiUrl();

class ApiService {
  private getHeaders(includeAuth = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  setToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  }

  removeToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }

  // Auth
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    const result = await response.json();
    if (result.access_token) {
      this.setToken(result.access_token);
    }
    return result;
  }

  async login(email: string, password: string) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const result = await response.json();
    if (result.access_token) {
      this.setToken(result.access_token);
    }
    return result;
  }

  async panelLogin(email: string, password: string) {
    const response = await fetch(`${API_URL}/auth/panel/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Panel login failed');
    }

    const result = await response.json();
    if (result.access_token) {
      this.setToken(result.access_token);
    }
    return result;
  }

  async createStoreSsoUrl(vendorId?: string) {
    const response = await fetch(`${API_URL}/auth/store-sso`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ vendorId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create store SSO URL' }));
      throw new Error(error.message || 'Failed to create store SSO URL');
    }

    return response.json();
  }

  async consumeStoreSsoToken(token: string, vendorSlug: string) {
    const response = await fetch(`${API_URL}/auth/store-sso/consume`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ token, vendorSlug }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to consume store SSO token' }));
      throw new Error(error.message || 'Failed to consume store SSO token');
    }

    const data = await response.json();
    if (data.access_token) {
      this.setToken(data.access_token);
    }
    return data;
  }
  async getProfile() {
    const response = await fetch(`${API_URL}/auth/profile`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to get profile');
    }

    return response.json();
  }

  // Products
  async getProducts(filters?: {
    type?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    vendorId?: string;
    categoryId?: string;
    marketplaceOnly?: boolean;
    limit?: number;
    offset?: number;
    condition?: string; // 'new' or 'used'
    isFeatured?: boolean;
    sortBy?: string;
    format?: string;
    genreId?: string;
    year?: string;
    artistSlug?: string;
    label?: string;
    country?: string;
    rpm?: string;
    size?: string;
    edition?: string;
    barcode?: string;
    isOnSale?: boolean;
    includeOutOfStock?: boolean;
  }) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }

    const url = `${API_URL}/products${params.toString() ? `?${params}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }

    return response.json();
  }

  async searchVendorProducts(vendorId: string, searchQuery: string) {
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (vendorId) params.append('vendorId', vendorId);
    params.append('limit', '10');
    
    const url = `${API_URL}/products?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to search products');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : (data.products || data.data || []);
  }

  // Buscar productos para el slider de portada (marketplace o vendor)
  async searchProducts(vendorId: string, searchQuery: string, limit: number = 10) {
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    // Si es el marketplace vendor, buscar todos los productos del marketplace
    if (vendorId === '00000000-0000-0000-0000-000000000001') {
      params.append('marketplaceOnly', 'true');
    } else {
      params.append('vendorId', vendorId);
    }
    params.append('limit', limit.toString());
    params.append('status', 'published');
    
    const url = `${API_URL}/products?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to search products');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : (data.products || data.data || []);
  }

  async getProduct(id: string) {
    const response = await fetch(`${API_URL}/products/${id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch product');
    }

    return response.json();
  }

  // Product questions
  async getProductQuestions(productId: string) {
    const response = await fetch(`${API_URL}/questions/product/${productId}`);
    if (!response.ok) throw new Error('No se pudieron cargar las preguntas');
    return response.json();
  }

  async createProductQuestion(productId: string, message: string) {
    const response = await fetch(`${API_URL}/questions/product/${productId}`, {
      method: 'POST', headers: this.getHeaders(true), body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(Array.isArray(error.message) ? error.message[0] : error.message || 'No se pudo enviar la pregunta');
    }
    return response.json();
  }

  async getMyQuestions() {
    const response = await fetch(`${API_URL}/questions/mine`, { headers: this.getHeaders(true) });
    if (!response.ok) throw new Error('No se pudieron cargar tus preguntas');
    return response.json();
  }

  async getVendorQuestions(status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await fetch(`${API_URL}/questions/vendor${query}`, { headers: this.getHeaders(true) });
    if (!response.ok) throw new Error('No se pudieron cargar las preguntas');
    return response.json();
  }

  async getMercadoLibreQuestionSyncStatus() {
    const response = await fetch(`${API_URL}/mercadolibre/questions/sync-status`, { headers: this.getHeaders(true) });
    if (!response.ok) throw new Error('No se pudo consultar la sincronización de Mercado Libre');
    return response.json();
  }

  async syncMercadoLibreQuestions() {
    const response = await fetch(`${API_URL}/mercadolibre/questions/sync`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'No se pudieron sincronizar las preguntas de Mercado Libre');
    }
    return response.json();
  }

  async replyToQuestion(questionId: string, message: string) {
    const response = await fetch(`${API_URL}/questions/${questionId}/reply`, {
      method: 'POST', headers: this.getHeaders(true), body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'No se pudo enviar la respuesta');
    }
    return response.json();
  }

  async getAdminQuestions(search = '', status = '') {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    const response = await fetch(`${API_URL}/questions/admin/all?${params}`, { headers: this.getHeaders(true) });
    if (!response.ok) throw new Error('No se pudieron cargar las preguntas');
    return response.json();
  }

  async moderateQuestionMessage(messageId: string, action: 'review' | 'penalize' | 'annul', reason?: string, annulQuestion?: boolean) {
    const response = await fetch(`${API_URL}/questions/admin/messages/${messageId}`, {
      method: 'PATCH', headers: this.getHeaders(true), body: JSON.stringify({ action, reason, annulQuestion }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'No se pudo moderar el mensaje');
    }
    return response.json();
  }

  // AI Images
  async getAiImagesAccess() {
    const response = await fetch(`${API_URL}/ai-images/access`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to get AI image access' }));
      throw new Error(error.message || 'Failed to get AI image access');
    }

    return response.json();
  }

  async getAiImagesHistory(limit: number = 40) {
    const response = await fetch(`${API_URL}/ai-images/history?limit=${limit}`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to get AI image history' }));
      throw new Error(error.message || 'Failed to get AI image history');
    }

    return response.json();
  }

  async generateAiImages(data: {
    productIds: string[];
    scenario: string;
    style: string;
    decoration?: string;
    size?: string;
    model?: string;
    quality?: string;
  }) {
    const response = await fetch(`${API_URL}/ai-images/generate`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to generate AI images' }));
      throw new Error(error.message || 'Failed to generate AI images');
    }

    return response.json();
  }
  async trackProductView(id: string) {
    try {
      await fetch(`${API_URL}/products/${id}/view`, { method: 'POST' });
    } catch {
      // silencioso — no bloquear la carga del producto si falla
    }
  }

  async trackProductCart(id: string) {
    try {
      await fetch(`${API_URL}/products/${id}/cart`, { method: 'POST' });
    } catch {
      // silencioso
    }
  }

  async getVendorProductStats() {
    const response = await fetch(`${API_URL}/products/vendor/product-stats`, {
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch product stats');
    }
    return response.json();
  }

  async createPosOrder(data: {
    items: { productId: string; quantity: number; price: number }[];
    paymentMethod: 'efectivo' | 'debito' | 'credito' | 'transferencia';
    subtotal: number;
    total: number;
    receivedAmount?: number;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    notes?: string;
  }, posToken?: string, posShiftId?: string) {
    const response = await fetch(`${API_URL}/orders/pos`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(true),
        ...(posToken ? { 'X-Pos-Token': posToken } : {}),
        ...(posShiftId ? { 'X-Pos-Shift-Id': posShiftId } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al procesar venta POS');
    }
    return response.json();
  }

  async createProduct(data: any) {
    console.log('API Service - Sending product data:', JSON.stringify(data, null, 2));
    const response = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create product';
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch (e) {
        // Si no se puede parsear el JSON, usar el mensaje por defecto
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async updateProduct(id: string, data: any) {
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update product');
    }

    return response.json();
  }

  async deleteProduct(id: string) {
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'No se pudo eliminar el producto');
    }

    return response.json();
  }

  async syncTrashToWooCommerce(productIds?: string[]) {
    const response = await fetch(API_URL + '/products/trash/sync-woocommerce', {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ productIds }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Error al sincronizar papelera con WooCommerce');
    }

    return response.json();
  }

  /**
   * Descarga imágenes desde Discogs y las sube a DigitalOcean Spaces
   * @param images Array de objetos con { uri: string }
   * @param slug Slug del producto para organizar en Spaces
   * @returns Promesa con array de URLs de imágenes en Spaces
   */
  async downloadDiscogsImages(images: Array<{ uri: string }>, slug: string): Promise<string[]> {
    console.log('📸 Downloading Discogs images for slug:', slug);
    const response = await fetch(`${API_URL}/products/download-discogs-images`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ images, slug }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to download images from Discogs');
    }

    const result = await response.json();
    return result.images || [];
  }

  /**
   * Migra todas las imágenes de Discogs existentes a DigitalOcean Spaces
   * @param dryRun Si es true, solo reporta qué se haría sin ejecutar
   * @param vendorId Opcional, filtrar por vendedor específico
   * @returns Resumen de la migración con estadísticas
   */
  async migrateDiscogsImages(dryRun: boolean = false, vendorId?: string): Promise<{
    migrated: number;
    failed: number;
    skipped: number;
    total: number;
    details: Array<{
      productId: string;
      title: string;
      slug: string;
      status: 'migrated' | 'failed' | 'skipped';
      message: string;
      oldImages?: string[];
      newImages?: string[];
    }>;
  }> {
    console.log('🔄 Starting Discogs images migration...');
    const params = new URLSearchParams();
    if (dryRun) params.append('dryRun', 'true');
    if (vendorId) params.append('vendorId', vendorId);

    const response = await fetch(`${API_URL}/products/migrate-discogs-images?${params}`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to migrate images');
    }

    return response.json();
  }

  // Vendors
  async getVendors() {
    const response = await fetch(`${API_URL}/vendors`);

    if (!response.ok) {
      throw new Error('Failed to fetch vendors');
    }

    return response.json();
  }

  async submitVendorApplication(data: Record<string, any>) {
    const response = await fetch(`${API_URL}/vendors/aplicar`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al enviar solicitud' }));
      throw new Error(error.message || 'Error al enviar solicitud');
    }

    return response.json();
  }

  async uploadVendorApplicationLogo(file: File) {
    const body = new FormData();
    body.append('logo', file);
    const response = await fetch(`${API_URL}/vendors/aplicar/logo`, {
      method: 'POST',
      body,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'No se pudo subir el logo' }));
      throw new Error(error.message || 'No se pudo subir el logo');
    }
    return response.json();
  }

  async getVendorApplications(status?: 'pending' | 'approved' | 'rejected') {
    const params = new URLSearchParams();
    if (status) {
      params.set('status', status);
    }

    const response = await fetch(`${API_URL}/vendors/aplicaciones${params.toString() ? `?${params.toString()}` : ''}`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('No se pudieron cargar las solicitudes');
    }

    return response.json();
  }

  async approveVendorApplication(applicationId: string, adminNotes?: string) {
    const response = await fetch(`${API_URL}/vendors/aplicaciones/${applicationId}/aprobar`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ adminNotes }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'No se pudo aprobar la solicitud' }));
      throw new Error(error.message || 'No se pudo aprobar la solicitud');
    }

    return response.json();
  }

  async rejectVendorApplication(applicationId: string, reason: string) {
    const response = await fetch(`${API_URL}/vendors/aplicaciones/${applicationId}/rechazar`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'No se pudo rechazar la solicitud' }));
      throw new Error(error.message || 'No se pudo rechazar la solicitud');
    }

    return response.json();
  }

  async setVendorAiImagesAccess(vendorId: string, enabled: boolean) {
    const response = await fetch(`${API_URL}/ai-images/vendors/${vendorId}/access`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'No se pudo actualizar el acceso a IA' }));
      throw new Error(error.message || 'No se pudo actualizar el acceso a IA');
    }

    return response.json();
  }
  async getVendor(id: string) {
    const response = await fetch(`${API_URL}/vendors/${id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch vendor');
    }

    return response.json();
  }

  async getVendorByDomain(domain: string) {
    const url = `${API_URL}/vendors/domain/${encodeURIComponent(domain)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch vendor by domain (${response.status})`);
    }
    return response.json();
  }

  async getVendorBySlug(slug: string) {
    const url = `${API_URL}/vendors/slug/${slug}`;
    console.log('🔵 Fetching vendor by slug:', { slug, url });
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to fetch vendor:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        url: url,
      });
      throw new Error(`Failed to fetch vendor (${response.status}: ${response.statusText})`);
    }

    const data = await response.json();
    console.log('✅ Vendor loaded:', data);
    return data;
  }

  async getVendorStats(id: string, filters?: { days?: number; startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (filters?.days) params.set('days', String(filters.days));
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    const response = await fetch(`${API_URL}/vendors/${id}/stats${params.size ? `?${params}` : ''}`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch vendor stats');
    }

    return response.json();
  }

  async getMyVendor() {
    try {
      const response = await fetch(`${API_URL}/vendors/my/profile?t=${Date.now()}`, {
        headers: this.getHeaders(true),
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error('Get vendor response:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error body:', errorText);
        throw new Error(`Failed to fetch vendor profile: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('getMyVendor error:', error);
      throw error;
    }
  }

  async createVendor(data: {
    storeName: string;
    description?: string;
    address?: string;
    city?: string;
    country?: string;
  }) {
    const token = this.getToken();
    console.log('Token disponible:', token ? 'Sí' : 'No');
    console.log('Token:', token?.substring(0, 20) + '...');
    
    const headers = this.getHeaders(true);
    console.log('Headers enviados:', headers);
    console.log('URL:', `${API_URL}/vendors`);
    console.log('Body:', JSON.stringify(data));

    const response = await fetch(`${API_URL}/vendors`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data),
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const error = await response.json();
      console.log('Error response:', error);
      throw new Error(error.message || 'Failed to create vendor');
    }

    return response.json();
  }

  async updateVendor(id: string, data: any) {
    const response = await fetch(`${API_URL}/vendors/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update vendor');
    }

    return response.json();
  }

  async getVendorBillingProfile(id: string) {
    const response = await fetch(`${API_URL}/vendors/${id}/billing-profile`, {
      headers: this.getHeaders(true),
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'No se pudieron cargar los datos de facturación');
    return payload;
  }

  async updateVendorBillingProfile(id: string, data: Record<string, string>) {
    const response = await fetch(`${API_URL}/vendors/${id}/billing-profile`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'No se pudieron guardar los datos de facturación');
    return payload;
  }

  async getVendorSettings(id: string, requireAuth = true) {
    const url = `${API_URL}/vendors/${id}/settings`;
    console.log('🔵 Fetching vendor settings from:', url, { requireAuth });
    
    const response = await fetch(url, {
      headers: this.getHeaders(requireAuth),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to fetch vendor settings:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        url: url,
      });
      throw new Error(`Failed to fetch vendor settings (${response.status}: ${response.statusText})`);
    }

    const data = await response.json();
    console.log('✅ Vendor settings loaded:', data);
    
    // Normalize settings to prevent .map() errors on null/undefined fields
    if (data) {
      if (!Array.isArray(data.gridConfig)) data.gridConfig = [];
      if (!Array.isArray(data.banners)) data.banners = [];
      if (!Array.isArray(data.slides)) data.slides = [];
      if (!data.menus || typeof data.menus !== 'object') data.menus = {};
      if (!data.customMenus || typeof data.customMenus !== 'object') data.customMenus = {};
      if (!data.footerConfig || typeof data.footerConfig !== 'object') data.footerConfig = { enabled: false, rows: [] };
    }
    
    return data;
  }

  async updateVendorSettings(id: string, data: any, requireAuth: boolean = false) {
    console.log('Updating vendor settings:', { id, data, url: `${API_URL}/vendors/${id}/settings` });

    try {
      const response = await fetch(`${API_URL}/vendors/${id}/settings`, {
        method: 'PATCH',
        headers: this.getHeaders(requireAuth),
        body: JSON.stringify(data),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || 'Failed to update vendor settings');
      }

      return response.json();
    } catch (error) {
      console.error('Error in updateVendorSettings:', error);
      throw error;
    }
  }

  async getMyVendorSettings() {
    const response = await fetch(`${API_URL}/vendors/my/settings`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to fetch my vendor settings:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
      });
      throw new Error(`Failed to fetch vendor settings (${response.status})`);
    }

    return response.json();
  }

  async updateMyVendorSettings(data: any) {
    console.log('Updating my vendor settings:', data);

    try {
      const response = await fetch(`${API_URL}/vendors/my/settings`, {
        method: 'PATCH',
        headers: this.getHeaders(true),
        body: JSON.stringify(data),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || 'Failed to update vendor settings');
      }

      return response.json();
    } catch (error) {
      console.error('Error in updateMyVendorSettings:', error);
      throw error;
    }
  }

  async getVendorGridConfig(vendorId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/grid-config`, {
      headers: this.getHeaders(false),
    });

    if (!response.ok) {
      throw new Error('Failed to get grid config');
    }

    return response.json();
  }

  async updateVendorGridConfig(vendorId: string, gridConfig: any[]) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/grid-config`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify({ gridConfig }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update grid config');
    }

    return response.json();
  }

  async searchSpotify(vendorId: string, query: string) {
    const response = await fetch(
      `${API_URL}/vendors/${vendorId}/spotify/search?query=${encodeURIComponent(query)}`,
      {
        headers: this.getHeaders(true),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to search Spotify');
    }

    return response.json();
  }

  async searchSpotifyForPlayer(vendorId: string, query: string, type: string = 'track,album,artist') {
    const response = await fetch(
      `${API_URL}/vendors/${vendorId}/spotify/player-search?query=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`,
      { headers: this.getHeaders(true) }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to search Spotify');
    }
    return response.json();
  }

  async getSpotifyAuthUrl(vendorId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/auth-url`, {
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `Error ${response.status}: No se pudo obtener URL de autorización`);
    }
    return response.json(); // { url }
  }

  async getSpotifyStatus(vendorId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/status`, {
      headers: this.getHeaders(true),
    });
    if (!response.ok) return { connected: false };
    return response.json(); // { connected, userId, playlistId }
  }

  async disconnectSpotify(vendorId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/disconnect`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });
    if (!response.ok) throw new Error('Error al desconectar');
    return response.json();
  }

  async getCurrentlyPlaying(vendorId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/currently-playing`, {
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Error al obtener canción actual');
    }
    return response.json();
  }

  async getCurrentlyPlayingPublic(vendorId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/currently-playing/public`);
    if (!response.ok) return { playing: false };
    return response.json(); // { playing, trackName, artist, albumImage, linkedProduct: { id, title, format, ... } }
  }

  async getSpotifyPlaylists(vendorId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/playlists`, {
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Error al obtener playlists');
    }
    return response.json(); // array
  }

  async getAlbumTopTracks(vendorId: string, albumId: string, limit = 2) {
    const response = await fetch(
      `${API_URL}/vendors/${vendorId}/spotify/album-top-tracks/${albumId}?limit=${limit}`,
      { headers: this.getHeaders(true) }
    );
    if (!response.ok) throw new Error('Error al obtener canciones del álbum');
    return response.json(); // array of tracks
  }

  async addTracksToPlaylist(vendorId: string, playlistId: string, trackUris: string[]) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/playlist/add-tracks`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ playlistId, trackUris }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Error al agregar canciones');
    }
    return response.json();
  }

  // ── Spotify Sync ──────────────────────────────────────────────────────────

  async getSpotifySyncPreview(vendorId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/sync/preview`, {
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Error al obtener productos para sincronizar');
    }
    return response.json(); // array of product sync items
  }

  async syncAllProductsSpotify(vendorId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/sync/run`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ limit: 2 }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Error al sincronizar');
    }
    return response.json(); // { total, synced, notFound, errors, results }
  }

  async syncSingleProductSpotify(vendorId: string, productId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/sync/product/${productId}`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ limit: 2 }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Error al sincronizar producto');
    }
    return response.json(); // { success, tracksFound, addedToPlaylist, tracks, error? }
  }

  async discardProductSpotify(vendorId: string, productId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/sync/discard/${productId}`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Error al descartar');
    }
    return response.json();
  }

  async restoreProductSpotify(vendorId: string, productId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/sync/restore/${productId}`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Error al restaurar');
    }
    return response.json();
  }

  async deleteProductSpotifyPermanently(vendorId: string, productId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/sync/product/${productId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Error al eliminar');
    }
    return response.json();
  }

  async getInactiveSyncedProducts(vendorId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/sync/inactive`, {
      headers: this.getHeaders(true),
    });
    if (!response.ok) throw new Error('Error al cargar productos inactivos');
    return response.json();
  }

  async removeInactiveProductFromPlaylist(vendorId: string, productId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/spotify/sync/deactivate/${productId}`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Error al sacar del playlist');
    }
    return response.json();
  }

  async generateDescriptionWithGemini(vendorId: string, productData: any) {
    const response = await fetch(
      `${API_URL}/vendors/${vendorId}/gemini/generate-description`,
      {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(productData),
      }
    );

    if (!response.ok) {
      let errorMessage = 'Failed to generate description';
      try {
        const error = await response.json();
        console.error('Gemini API Error from backend:', error);
        errorMessage = error.message || error.error || JSON.stringify(error);
      } catch (parseError) {
        console.error('Could not parse error as JSON');
        errorMessage = `Server error: ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async searchDiscogs(vendorId: string, params: {
    query?: string;
    artist?: string;
    album?: string;
    catno?: string;
    barcode?: string;
    per_page?: number;
    page?: number;
  }) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(
      `${API_URL}/vendors/${vendorId}/discogs/search?${searchParams}`,
      {
        headers: this.getHeaders(true),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Discogs search error:', response.status, errorText);
      let errorMessage = 'Failed to search Discogs';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async getDiscogsRelease(vendorId: string, releaseId: string) {
    try {
      const response = await fetch(
        `${API_URL}/vendors/${vendorId}/discogs/release/${releaseId}`,
        {
          headers: this.getHeaders(true),
        }
      );

      if (!response.ok) {
        let errorMessage = 'Failed to fetch Discogs release';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch (e) {
          // Si no se puede parsear el JSON, usar el mensaje por defecto
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error: any) {
      console.error('API Error - getDiscogsRelease:', error);
      throw error;
    }
  }

  async uploadImages(vendorId: string, imageUrls: string[]): Promise<string[]> {
    const response = await fetch(
      `${API_URL}/vendors/${vendorId}/upload-images`,
      {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({ imageUrls }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload images');
    }

    return response.json();
  }

  async uploadImagesOptimized(vendorId: string, imageUrls: string[]): Promise<{ urls: string[]; imagesMeta: any[] }> {
    const response = await fetch(
      `${API_URL}/vendors/${vendorId}/upload-images-optimized`,
      {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({ imageUrls }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload optimized images');
    }

    return response.json();
  }

  async uploadFiles(vendorId: string, files: FileList): Promise<string[]> {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    const token = this.getToken();
    const response = await fetch(
      `${API_URL}/vendors/${vendorId}/upload-files`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload files');
    }

    const data = await response.json();
    return data.urls;
  }

  async optimizeVendorProductImages(
    vendorId: string,
    options?: { limit?: number; offset?: number; force?: boolean },
  ): Promise<{
    vendorId: string;
    totalCandidates: number;
    processed: number;
    skipped: number;
    failed: number;
    limit: number;
    offset: number;
    force: boolean;
    details: Array<{ productId: string; title: string; status: 'processed' | 'skipped' | 'failed'; reason?: string }>;
  }> {
    const response = await fetch(
      `${API_URL}/vendors/${vendorId}/optimize-product-images`,
      {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(options || {}),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to optimize vendor product images');
    }

    return response.json();
  }

  // Categories
  async getVendorCategories(vendorId: string, requireAuth: boolean = true) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/categories`, {
      headers: this.getHeaders(requireAuth),
    });

    if (!response.ok) {
      throw new Error('Failed to get categories');
    }

    return response.json();
  }

  async getAllCategories() {
    const response = await fetch(`${API_URL}/categories`, {
      headers: this.getHeaders(false),
    });

    if (!response.ok) {
      throw new Error('Failed to get all categories');
    }

    return response.json();
  }

  async getAdminCategories() {
    const response = await fetch(`${API_URL}/categories/admin/all`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to get admin categories');
    }

    return response.json();
  }

  async getAvailableVendorCategories(vendorId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/categories/all`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to get available vendor categories');
    }

    return response.json();
  }

  // Alias para consistencia con otros métodos
  async getCategories() {
    return this.getAllCategories();
  }

  // Métodos para gestión de categorías globales (solo admin)
  async createCategory(data: any) {
    const response = await fetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create category');
    }

    return response.json();
  }

  async updateCategory(categoryId: string, data: any) {
    const response = await fetch(`${API_URL}/categories/${categoryId}`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update category');
    }

    return response.json();
  }

  async deleteCategory(categoryId: string) {
    const response = await fetch(`${API_URL}/categories/${categoryId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete category');
    }

    return response.json();
  }

  // Métodos para categorías globales (ahora se editan desde configuración)
  async createVendorCategory(vendorId: string, data: any) {
    const response = await fetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create category');
    }

    const category = await response.json();
    
    // Activar la categoría para este vendor automáticamente
    await fetch(`${API_URL}/vendors/${vendorId}/categories/${category.id}/enable`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ displayOrder: 0 }),
    });

    return category;
  }

  async updateVendorCategory(vendorId: string, categoryId: string, data: any) {
    const response = await fetch(`${API_URL}/categories/${categoryId}`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update category');
    }

    return response.json();
  }

  async updateVendorCategories(vendorId: string, categoryIds: string[]) {
    // Activar múltiples categorías para un vendor
    const promises = categoryIds.map((categoryId, index) => 
      fetch(`${API_URL}/vendors/${vendorId}/categories/${categoryId}/enable`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({ displayOrder: index }),
      })
    );

    const responses = await Promise.all(promises);
    
    // Verificar que todas las respuestas sean exitosas
    for (const response of responses) {
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to enable categories');
      }
    }

    return true;
  }

  async deleteVendorCategory(vendorId: string, categoryId: string) {
    const response = await fetch(`${API_URL}/categories/${categoryId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete category');
    }

    return response.json();
  }

  async enableVendorCategory(vendorId: string, categoryId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/categories/${categoryId}/enable`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to enable category');
    }

    return response.json();
  }


  async disableVendorCategory(vendorId: string, categoryId: string) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/categories/${categoryId}/disable`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to disable category');
    }

    return response.json();
  }

  // Genres
  async getGenres() {
    const response = await fetch(`${API_URL}/genres`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to get genres');
    }

    return response.json();
  }

  async createGenre(data: { name: string }) {
    const response = await fetch(`${API_URL}/genres`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create genre');
    }

    return response.json();
  }

  async updateGenre(genreId: string, data: { name: string }) {
    const response = await fetch(`${API_URL}/genres/${genreId}`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update genre');
    }

    return response.json();
  }

  async deleteGenre(genreId: string) {
    const response = await fetch(`${API_URL}/genres/${genreId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete genre');
    }

    return response.json();
  }

  // Formats
  async getFormats() {
    const response = await fetch(`${API_URL}/formats`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to get formats');
    }

    return response.json();
  }

  async createFormat(data: { name: string }) {
    const response = await fetch(`${API_URL}/formats`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create format');
    }

    return response.json();
  }

  async updateFormat(formatId: string, data: { name: string }) {
    const response = await fetch(`${API_URL}/formats/${formatId}`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update format');
    }

    return response.json();
  }

  async deleteFormat(formatId: string) {
    const response = await fetch(`${API_URL}/formats/${formatId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete format');
    }

    return response.json();
  }

  // Orders
  async createOrder(orderData: any) {
    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // Preserve the full error object for better error handling
      const error: any = new Error(errorData.message || 'Failed to create order');
      error.details = errorData.details;
      error.vendorContact = errorData.vendorContact;
      error.statusCode = errorData.statusCode;
      throw error;
    }

    return response.json();
  }

  async getOrder(orderId: string) {
    const response = await fetch(`${API_URL}/orders/${orderId}`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      let message = 'Failed to get order';
      try {
        const payload = await response.json();
        message = payload?.message || payload?.error || message;
      } catch (err) {
        // keep default message
      }
      throw new Error(message);
    }

    return response.json();
  }

  async getOrdersByNumber(orderNumber: string) {
    const response = await fetch(`${API_URL}/orders/by-number/${orderNumber}`, {
      headers: this.getHeaders(false),
    });

    if (!response.ok) {
      throw new Error('Failed to get orders by number');
    }

    return response.json();
  }

  async getOrders() {
    const response = await fetch(`${API_URL}/orders`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to get orders');
    }

    return response.json();
  }

  async getVendorOrders(vendorId?: string, source?: 'pos') {
    let endpoint = vendorId ? `/orders/vendor/${vendorId}` : '/orders/vendor/mine';
    if (!vendorId && source) endpoint += `?source=${source}`;
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      let message = 'Failed to get vendor orders';
      try {
        const payload = await response.json();
        message = payload?.message || payload?.error || message;
      } catch (err) {
        // keep default message
      }
      throw new Error(message);
    }

    return response.json();
  }

  async getVendorOrder(orderId: string) {
    const response = await fetch(`${API_URL}/orders/vendor/mine/${orderId}`, {
      cache: 'no-store',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to get vendor order');
    }
    return response.json();
  }

  async createAssistedOrder(data: any) {
    const response = await fetch(`${API_URL}/orders/assisted`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'No se pudo crear la venta asistida');
    }
    return response.json();
  }

  async confirmAssistedTransfer(orderId: string, transferReference: string) {
    const response = await fetch(`${API_URL}/orders/assisted/${orderId}/confirm-transfer`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({
        transferReference,
        originHostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'No se pudo iniciar el cobro');
    }
    return response.json();
  }

  async receiveAssistedTransfer(orderId: string, transferReference: string) {
    const response = await fetch(`${API_URL}/orders/assisted/${orderId}/transfer-received`, {
      method: 'POST', headers: this.getHeaders(true), body: JSON.stringify({ transferReference }),
    });
    if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || 'No se pudo confirmar la transferencia'); }
    return response.json();
  }

  async startAssistedProcessing(orderId: string) {
    const response = await fetch(`${API_URL}/orders/assisted/${orderId}/start-processing`, { method: 'POST', headers: this.getHeaders(true) });
    if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || 'No se pudo cambiar a Procesando'); }
    return response.json();
  }

  async getMarketplaceSettings() {
    const response = await fetch(`${API_URL}/marketplace/settings`);

    if (!response.ok) {
      throw new Error('Failed to fetch marketplace settings');
    }

    const rows = await response.json();
    return rows.reduce((acc: Record<string, any>, setting: any) => {
      try {
        acc[setting.settingKey] = JSON.parse(setting.settingValue);
      } catch {
        acc[setting.settingKey] = setting.settingValue;
      }
      return acc;
    }, {});
  }

  async updateMarketplaceSetting(key: string, value: any) {
    const response = await fetch(`${API_URL}/marketplace/settings/${key}`, {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: JSON.stringify({ value: typeof value === 'string' ? value : JSON.stringify(value) }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update marketplace setting' }));
      throw new Error(error.message || 'Failed to update marketplace setting');
    }

    return response.json();
  }
  async getMarketplaceOrders() {
    const response = await fetch(`${API_URL}/orders/marketplace`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      let message = 'Failed to get marketplace orders';
      try {
        const payload = await response.json();
        message = payload?.message || payload?.error || message;
      } catch (err) {
        // keep default message
      }
      throw new Error(message);
    }

    return response.json();
  }

  async getVendorStoresOrders() {
    const response = await fetch(`${API_URL}/orders/stores`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      let message = 'Failed to get vendor stores orders';
      try {
        const payload = await response.json();
        message = payload?.message || payload?.error || message;
      } catch (err) {
        // keep default message
      }
      throw new Error(message);
    }

    return response.json();
  }

  async updateOrderStatus(orderId: string, status: string) {
    const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update order status');
    }

    return response.json();
  }

  async completeVendorManagedShipping(orderId: string) {
    const response = await fetch(`${API_URL}/orders/${orderId}/external-shipping/delivered`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'No se pudo marcar el pedido como completado');
    }

    return response.json();
  }

  async cancelOrder(orderId: string, reason: string, note?: string) {
    const response = await fetch(`${API_URL}/orders/${orderId}/cancel`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify({ reason, note }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to cancel order');
    }

    return response.json();
  }

  async registerCustomerRefund(orderId: string, data: { reference: string; note?: string; refundedAt?: string; proof: File }) {
    const form = new FormData();
    form.append('reference', data.reference);
    if (data.note) form.append('note', data.note);
    if (data.refundedAt) form.append('refundedAt', data.refundedAt);
    form.append('comprobante', data.proof);
    const response = await fetch(`${API_URL}/orders/${orderId}/customer-refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getToken()}` },
      body: form,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'No se pudo registrar la devolución');
    return payload;
  }

  async uploadOrderSalesReceipt(orderId: string, file: File) {
    const form = new FormData();
    form.append('boleta', file);
    const response = await fetch(`${API_URL}/orders/${orderId}/sales-receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getToken()}` },
      body: form,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'No se pudo adjuntar la boleta');
    return payload;
  }

  async linkOrderSalesReceipt(orderId: string, url: string) {
    const response = await fetch(`${API_URL}/orders/${orderId}/sales-receipt`, {
      method: 'PATCH', headers: this.getHeaders(true), body: JSON.stringify({ url }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'No se pudo guardar la boleta');
    return payload;
  }

  async uploadQrSalesReceipt(orderId: string, url: string, image: Blob) {
    const form = new FormData();
    form.append('url', url); form.append('qr', image, 'qr.png');
    const response = await fetch(`${API_URL}/orders/${orderId}/sales-receipt/qr`, { method: 'POST', headers: { Authorization: `Bearer ${this.getToken()}` }, body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'No se pudo guardar la boleta');
    return payload;
  }

  async addOrderNote(orderId: string, note: string) {
    const response = await fetch(`${API_URL}/orders/${orderId}/notes`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ note }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'No se pudo agregar la nota');
    return payload;
  }

  async getMercadoLibreShipping(orderId: string) {
    const response = await fetch(`${API_URL}/mercadolibre/orders/${orderId}/shipping`, { headers: this.getHeaders(true) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'No se pudo consultar el envío de Mercado Libre');
    return payload;
  }

  async openMercadoLibreLabel(orderId: string) {
    const response = await fetch(`${API_URL}/mercadolibre/orders/${orderId}/label`, { headers: this.getHeaders(true) });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || 'La etiqueta de Mercado Libre aún no está disponible');
    }
    const url = URL.createObjectURL(await response.blob());
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async openFalabellaLabel(orderId: string) {
    const response = await fetch(`${API_URL}/falabella/orders/${orderId}/label`, { headers: this.getHeaders(true) });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || 'La etiqueta de Falabella aún no está disponible');
    }
    const url = URL.createObjectURL(await response.blob());
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async cancelMercadoLibreOrder(orderId: string, reason: string) {
    const response = await fetch(`${API_URL}/mercadolibre/orders/${orderId}/cancel`, {
      method: 'POST', headers: this.getHeaders(true), body: JSON.stringify({ reason }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Mercado Libre rechazó la cancelación');
    return payload;
  }

  async reviewOrderCancellation(orderId: string, status: 'justified' | 'vendor_responsible', note: string, verification?: File) {
    const form = new FormData();
    form.append('status', status);
    form.append('note', note);
    if (verification) form.append('verificador', verification);
    const response = await fetch(`${API_URL}/orders/${orderId}/cancellation-review`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${this.getToken()}` },
      body: form,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'No se pudo revisar la cancelación');
    }

    return response.json();
  }

  async sendOrderCancellationWarning(orderId: string) {
    const response = await fetch(`${API_URL}/orders/${orderId}/cancellation-warning`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'No se pudo enviar la advertencia');
    }
    return response.json();
  }

  async updateOrderTracking(orderId: string, trackingNumber: string) {
    const response = await fetch(`${API_URL}/orders/${orderId}/tracking`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify({ trackingNumber }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update tracking number');
    }

    return response.json();
  }

  async useExternalOrderShipping(orderId: string, data: {
    reason: string;
    reasonDetail?: string;
    carrier: string;
    trackingNumber: string;
    trackingUrl?: string;
    evidence?: File | null;
  }) {
    const form = new FormData();
    form.append('reason', data.reason);
    form.append('carrier', data.carrier);
    form.append('trackingNumber', data.trackingNumber);
    if (data.reasonDetail) form.append('reasonDetail', data.reasonDetail);
    if (data.trackingUrl) form.append('trackingUrl', data.trackingUrl);
    if (data.evidence) form.append('captura', data.evidence);
    const response = await fetch(`${API_URL}/orders/${orderId}/external-shipping`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getToken()}` },
      body: form,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'No se pudo registrar el envío externo');
    return payload;
  }

  async getOrderHistory(orderId: string) {
    const response = await fetch(`${API_URL}/orders/${orderId}/history`, {
      method: 'GET',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch order history');
    }

    return response.json();
  }

  async sendPendingOrderReminder(orderId: string) {
    const response = await fetch(`${API_URL}/orders/${orderId}/send-pending-reminder`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send pending order reminder');
    }

    return response.json();
  }

  async addOrderItem(orderId: string, productId: string, quantity: number, price: number) {
    const response = await fetch(`${API_URL}/orders/${orderId}/items`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ productId, quantity, price }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add order item');
    }

    return response.json();
  }

  async removeOrderItem(orderId: string, itemId: string) {
    const response = await fetch(`${API_URL}/orders/${orderId}/items/${itemId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to remove order item');
    }

    return response.json();
  }

  async updateOrderItem(orderId: string, itemId: string, quantity: number) {
    const response = await fetch(`${API_URL}/orders/${orderId}/items/${itemId}`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify({ quantity }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update order item');
    }

    return response.json();
  }

  // Pages
  async getPages(vendorSlug?: string) {
    try {
      // Si se proporciona vendorSlug, usar endpoint público
      const url = vendorSlug 
        ? `${API_URL}/pages/public/${vendorSlug}/all?t=${Date.now()}`
        : `${API_URL}/pages?t=${Date.now()}`;
      
      const response = await fetch(url, {
        headers: vendorSlug ? {} : this.getHeaders(true),
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error('Get pages response:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error body:', errorText);
        throw new Error(`Failed to get pages: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('getPages error:', error);
      throw error;
    }
  }

  async getPage(pageId: string) {
    const response = await fetch(`${API_URL}/pages/${pageId}?t=${Date.now()}`, {
      headers: this.getHeaders(true),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to get page');
    }

    return response.json();
  }

  async getPagePublic(pageId: string) {
    const response = await fetch(`${API_URL}/pages/public/page/${pageId}?t=${Date.now()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to get page');
    }

    return response.json();
  }

  async createPage(data: any, vendorId: string = "00000000-0000-0000-0000-000000000001") {
    const response = await fetch(`${API_URL}/pages`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create page');
    }

    return response.json();
  }

  async updatePage(pageId: string, data: any, vendorId: string = "00000000-0000-0000-0000-000000000001") {
    const response = await fetch(`${API_URL}/pages/${pageId}`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update page');
    }

    return response.json();
  }

  async deletePage(pageId: string, vendorId: string = "00000000-0000-0000-0000-000000000001") {
    const response = await fetch(`${API_URL}/pages/${pageId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete page');
    }
  }

  async getPageBySlug(vendorSlug: string, pageSlug: string) {
    const response = await fetch(`${API_URL}/pages/public/${vendorSlug}/${pageSlug}`);

    if (!response.ok) {
      throw new Error('Failed to get page');
    }

    return response.json();
  }

  async getHomepage(vendorSlug: string) {
    const response = await fetch(`${API_URL}/pages/public/${vendorSlug}/homepage`);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // No homepage found
      }
      throw new Error('Failed to get homepage');
    }

    return response.json();
  }

  // Media Library
  async getMediaFiles(vendorId: string, folderId: string | null = null) {
    const params = new URLSearchParams();
    if (folderId) params.append('folderId', folderId);
    
    const response = await fetch(`${API_URL}/media/${vendorId}/files?${params}`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to get media files');
    }

    return response.json();
  }

  async getMediaFolders(vendorId: string, parentId: string | null = null) {
    const params = new URLSearchParams();
    if (parentId) params.append('parentId', parentId);
    
    const response = await fetch(`${API_URL}/media/${vendorId}/folders?${params}`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to get media folders');
    }

    return response.json();
  }

  async uploadMediaFiles(vendorId: string, formData: FormData) {
    const token = this.getToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/media/${vendorId}/upload`, {
      method: 'POST',
      headers,
      body: formData, // No incluir Content-Type para que el navegador lo establezca automáticamente con el boundary
    });

    if (!response.ok) {
      throw new Error('Failed to upload files');
    }

    return response.json();
  }

  async uploadIcon(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.getToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/media/upload-icon`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to upload icon' }));
      throw new Error(error.message || 'Failed to upload icon');
    }

    return response.json();
  }

  async createMediaFolder(vendorId: string, data: { name: string; parentId: string | null }) {
    const response = await fetch(`${API_URL}/media/${vendorId}/folders`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create folder');
    }

    return response.json();
  }

  async deleteMediaFile(vendorId: string, fileId: string) {
    const response = await fetch(`${API_URL}/media/${vendorId}/files/${fileId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to delete file');
    }

    return response.json();
  }

  async deleteMediaFolder(vendorId: string, folderId: string) {
    const response = await fetch(`${API_URL}/media/${vendorId}/folders/${folderId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to delete folder');
    }

    return response.json();
  }

  // ========== SHIPPING METHODS ==========

  // Get all regions
  async getRegions() {
    const response = await fetch(`${API_URL}/shipping/regions`);
    if (!response.ok) {
      throw new Error('Failed to fetch regions');
    }
    return response.json();
  }

  // Alias for getRegions (for compatibility)
  async getShippingRegions() {
    return this.getRegions();
  }

  // Get communes by region
  async getCommunesByRegion(regionId: number) {
    const response = await fetch(`${API_URL}/shipping/regions/${regionId}/communes`);
    if (!response.ok) {
      throw new Error('Failed to fetch communes');
    }
    return response.json();
  }

  // Get all communes
  async getAllCommunes() {
    const response = await fetch(`${API_URL}/shipping/communes`);
    if (!response.ok) {
      throw new Error('Failed to fetch communes');
    }
    return response.json();
  }

  // Get all shipping methods
  async getShippingMethods() {
    const response = await fetch(`${API_URL}/shipping/methods`);
    if (!response.ok) {
      throw new Error('Failed to fetch shipping methods');
    }
    return response.json();
  }

  // Get vendor shipping methods
  async getVendorShippingMethods(vendorId: string) {
    const response = await fetch(`${API_URL}/shipping/vendor/${vendorId}/methods`, {
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch vendor shipping methods');
    }
    return response.json();
  }

  // Enable shipping method for vendor
  async enableShippingMethod(vendorId: string, methodId: number, config: any) {
    const response = await fetch(`${API_URL}/shipping/vendor/${vendorId}/methods/${methodId}/enable`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ config }),
    });
    if (!response.ok) {
      throw new Error('Failed to enable shipping method');
    }
    return response.json();
  }

  // Disable shipping method for vendor
  async disableShippingMethod(vendorId: string, methodId: number) {
    const response = await fetch(`${API_URL}/shipping/vendor/${vendorId}/methods/${methodId}/disable`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      throw new Error('Failed to disable shipping method');
    }
    return response.json();
  }

  // Update shipping method config
  async updateShippingMethodConfig(vendorId: string, methodId: number, config: any) {
    const response = await fetch(`${API_URL}/shipping/vendor/${vendorId}/methods/${methodId}/config`, {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: JSON.stringify({ config }),
    });
    if (!response.ok) {
      throw new Error('Failed to update shipping method config');
    }
    return response.json();
  }

  // Get commune config for vendor method
  async getCommuneConfig(vendorMethodId: number) {
    const response = await fetch(`${API_URL}/shipping/vendor-method/${vendorMethodId}/communes`, {
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch commune config');
    }
    return response.json();
  }

  // Set commune config
  async setCommuneConfig(
    vendorMethodId: number,
    communeId: number,
    config: {
      isAvailable: boolean;
      baseCost: number;
      estimatedDays: number;
      additionalConfig?: any;
    }
  ) {
    const response = await fetch(`${API_URL}/shipping/vendor-method/${vendorMethodId}/communes/${communeId}`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      throw new Error('Failed to set commune config');
    }
    return response.json();
  }

  // Bulk set commune config
  async bulkSetCommuneConfig(
    vendorMethodId: number,
    communes: Array<{
      communeId: number;
      isAvailable: boolean;
      baseCost: number;
      estimatedDays: number;
      additionalConfig?: any;
    }>
  ) {
    const response = await fetch(`${API_URL}/shipping/vendor-method/${vendorMethodId}/communes/bulk`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ communes }),
    });
    if (!response.ok) {
      throw new Error('Failed to bulk set commune config');
    }
    return response.json();
  }

  // Calculate shipping with products (uses category dimensions)
  async calculateShippingWithProducts(data: {
    vendorId: string;
    communeId: number;
    products: Array<{ productId: string; quantity: number }>;
    declaredValue: number;
  }) {
    const response = await fetch(`${API_URL}/shipping/calculate-with-products`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to calculate shipping');
    }
    return response.json();
  }

  // Calculate shipping (legacy - uses hardcoded dimensions)
  async calculateShipping(data: {
    vendorId: string;
    communeId: number;
    weight: number;
    dimensions: { length: number; width: number; height: number };
    declaredValue: number;
  }) {
    const response = await fetch(`${API_URL}/shipping/calculate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to calculate shipping');
    }
    return response.json();
  }

  // Marketplace Payment Methods
  async getMarketplacePaymentMethods() {
    const response = await fetch(`${API_URL}/marketplace/payment-methods`, {
      headers: this.getHeaders(false),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch payment methods');
    }
    return response.json();
  }

  async getActiveMarketplacePaymentMethods() {
    const response = await fetch(`${API_URL}/marketplace/payment-methods/active`, {
      headers: this.getHeaders(false),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch active payment methods');
    }
    return response.json();
  }

  async getMarketplacePaymentMethodByCode(code: string) {
    const response = await fetch(`${API_URL}/marketplace/payment-methods/code/${code}`, {
      headers: this.getHeaders(false),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch payment method');
    }
    return response.json();
  }

  async updateMarketplacePaymentMethod(id: string, data: any) {
    const response = await fetch(`${API_URL}/marketplace/payment-methods/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(false),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to update payment method');
    }
    return response.json();
  }

  // Product Import
  async uploadImportFile(vendorId: string, formData: FormData) {
    const token = this.getToken();
    const response = await fetch(`${API_URL}/vendors/${vendorId}/products/import/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload file');
    }

    return response.json();
  }

  async importProducts(vendorId: string, products: any[]) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/products/import`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ products }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to import products');
    }

    return response.json();
  }

  // NUEVOS MÉTODOS PARA IMPORTACIÓN MASIVA

  async validateBulkImport(vendorId: string, file: File, config: any) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('config', JSON.stringify(config));

    const token = this.getToken();
    const response = await fetch(`${API_URL}/vendors/${vendorId}/products/import/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to validate import');
    }

    return response.json();
  }

  async executeBulkImport(vendorId: string, products: any[], config: any) {
    const response = await fetch(`${API_URL}/vendors/${vendorId}/products/import/execute`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ products, config }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to execute import');
    }

    return response.json();
  }

  async exportProducts(vendorId: string, fields: string[], status?: string): Promise<Blob> {
    const response = await fetch(`${API_URL}/products/export`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ fields, status: status || 'all' }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to export products';
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch (e) {
        // Si no se puede parsear el JSON, usar el statusText
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.blob();
  }

  async downloadImportTemplate(vendorId: string, includeWholesale: boolean) {
    const token = this.getToken();
    const response = await fetch(
      `${API_URL}/vendors/${vendorId}/products/import/template?includeWholesale=${includeWholesale}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download template');
    }

    const data = await response.json();
    
    // Convertir base64 a blob y descargar
    const byteCharacters = atob(data.buffer);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: data.contentType });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = data.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // Generic HTTP methods
  async get(endpoint: string, requireAuth = true) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(requireAuth),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  async post(endpoint: string, data?: any, requireAuth = true) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(requireAuth),
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  async patch(endpoint: string, data?: any, requireAuth = true) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(requireAuth),
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // ==================== BlueExpress Methods ====================

  async delete(endpoint: string, requireAuth = true) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(requireAuth),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // ============================================
  // Envia.com API Methods
  // ============================================

  // Configuración global del marketplace
  async getEnviaMarketplaceConfig() {
    const response = await fetch(`${API_URL}/shipping/envia/config`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to get Envia.com config');
    }

    return response.json();
  }

  async updateEnviaMarketplaceConfig(config: {
    apiToken?: string;
    sandboxToken?: string;
    environment?: 'sandbox' | 'production';
    enabled?: boolean;
    webhookUrl?: string;
    webhookSecret?: string;
    carrierLogos?: Record<string, string>;
  }) {
    const response = await fetch(`${API_URL}/shipping/envia/config`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Failed to update Envia.com config');
    }

    return response.json();
  }

  async testEnviaConnection() {
    const response = await fetch(`${API_URL}/shipping/envia/test-connection`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to test Envia.com connection');
    }

    return response.json();
  }

  async getEnviaCarriers() {
    const response = await fetch(`${API_URL}/shipping/envia/carriers`, {
      headers: this.getHeaders(false),
    });

    if (!response.ok) {
      throw new Error('Failed to get Envia.com carriers');
    }

    return response.json();
  }

  // Configuración de vendor
  async getEnviaVendorConfig(vendorId: string) {
    const response = await fetch(`${API_URL}/shipping/envia/vendor/${vendorId}`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to get Envia.com vendor config');
    }

    return response.json();
  }

  async updateEnviaVendorConfig(vendorId: string, config: {
    enabled?: boolean;
    origin?: {
      name: string;
      phone: string;
      street: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
    };
    enabledCarriers?: string[];
    carrierSettings?: Record<string, { enabled: boolean; priority: number; markup: number; customLabel?: string }>;
    defaultPackageType?: 'box' | 'envelope';
    defaultWeightUnit?: 'KG' | 'LB';
    defaultLengthUnit?: 'CM' | 'IN';
  }) {
    const response = await fetch(`${API_URL}/shipping/envia/vendor/${vendorId}`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Failed to update Envia.com vendor config');
    }

    return response.json();
  }

  async validateEnviaVendorAddress(vendorId: string) {
    const response = await fetch(`${API_URL}/shipping/envia/vendor/${vendorId}/validate-address`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to validate Envia.com address');
    }

    return response.json();
  }

  async testEnviaVendorQuote(vendorId: string, destination?: {
    name: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  }) {
    const response = await fetch(`${API_URL}/shipping/envia/vendor/${vendorId}/test-quote`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ destination }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Failed to test Envia.com quote');
    }

    return response.json();
  }

  // Cotización (para checkout)
  async getEnviaQuoteFromCart(vendorId: string, destination: {
    name: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  }, items: Array<{
    name: string;
    quantity: number;
    price: number;
    weight?: number;
    length?: number;
    width?: number;
    height?: number;
  }>) {
    const response = await fetch(`${API_URL}/shipping/envia/quote-from-cart`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ vendorId, destination, items }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Failed to get Envia.com quote');
    }

    return response.json();
  }

  async getEnviaOrderQuotes(orderId: string) {
    const response = await fetch(`${API_URL}/shipping/envia/orders/${orderId}/quotes`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'No se pudieron obtener opciones de envío');
    }

    return response.json();
  }

  async selectEnviaOrderShippingOption(orderId: string, carrier: string, service: string) {
    const response = await fetch(`${API_URL}/shipping/envia/orders/${orderId}/shipping-option`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify({ carrier, service }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'No se pudo cambiar la empresa de transporte');
    }

    return response.json();
  }

  // TEST: Simular generación de etiqueta (para diagnóstico)
  async testGenerateEnviaLabel(orderId: string) {
    const response = await fetch(`${API_URL}/shipping/envia/test-generate/${orderId}`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Failed to test generate');
    }

    return response.json();
  }

  // Reintentar generación (elimina registros fallidos)
  async retryEnviaLabel(orderId: string) {
    const response = await fetch(`${API_URL}/shipping/envia/retry/${orderId}`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Failed to retry');
    }

    return response.json();
  }

  // Generación de etiqueta
  async generateEnviaLabel(orderId: string, carrier?: string, service?: string) {
    const response = await fetch(`${API_URL}/shipping/envia/generate-from-order/${orderId}`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ carrier, service }),
    });


    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Failed to generate Envia.com label');
    }

    const result = await response.json();
    if (result?.success === false) {
      throw new Error(
        result.error || result.message || 'Envia.com no pudo generar la etiqueta',
      );
    }

    if (!result?.labelUrl && !result?.trackingNumber) {
      throw new Error(
        'Envia.com respondió sin una etiqueta ni número de seguimiento. Intenta nuevamente.',
      );
    }

    return result;
  }

  // Tracking
  async getEnviaTracking(trackingNumber: string) {
    const response = await fetch(`${API_URL}/shipping/envia/track/${trackingNumber}`, {
      headers: this.getHeaders(false),
    });

    if (!response.ok) {
      throw new Error('Failed to get Envia.com tracking');
    }

    return response.json();
  }

  // ========== GEOCODIFICACIÓN ENVIA.COM ==========

  /**
   * Validar código postal y obtener información de ubicación
   * Útil para auto-completar dirección en checkout
   */
  async validateEnviaPostalCode(countryCode: string, postalCode: string) {
    const response = await fetch(`${API_URL}/shipping/envia/validate-postal/${countryCode}/${postalCode}`, {
      headers: this.getHeaders(false),
    });

    if (!response.ok) {
      return null; // No lanzar error, simplemente retornar null si no es válido
    }

    return response.json();
  }

  /**
   * Buscar ciudad por nombre
   * Retorna información de la ciudad incluyendo código postal y estado
   */
  async locateEnviaCity(countryCode: string, cityName: string) {
    const encodedCity = encodeURIComponent(cityName);
    const response = await fetch(`${API_URL}/shipping/envia/locate-city/${countryCode}/${encodedCity}`, {
      headers: this.getHeaders(false),
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  /**
   * Obtener carriers disponibles desde la API de Envia.com
   */
  async getEnviaCarriersFromApi() {
    const response = await fetch(`${API_URL}/shipping/envia/carriers-api`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to get Envia.com carriers');
    }

    return response.json();
  }

  async getVendorSiteStats(filters?: { days?: number; startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (filters?.days) params.set('days', String(filters.days));
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_URL}/products/vendor/site-stats${query}`, {
      headers: this.getHeaders(true),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch site stats');
    }
    return response.json();
  }
}

export const api = new ApiService();
