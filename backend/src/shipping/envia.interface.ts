// ==============================================
// ENVIA.COM - INTERFACES TYPESCRIPT
// ==============================================

// Dirección para cotización y envío
export interface EnviaAddress {
  name: string;
  phone: string;
  street: string;
  number: string; // Número de casa/edificio
  city: string;
  state: string; // Código de región de Envia: RM, VS, BI, etc.
  country: string; // CL
  postalCode: string;
  // ⚠️ IMPORTANTE: regionId y communeId son solo para uso interno en nuestra BD
  // NO deben incluirse al enviar a la API de Envia/carriers (Chilexpress rechaza estos campos)
  regionId?: number; // ID de la región en nuestra BD (NO ENVIAR A API)
  communeId?: number; // ID de la comuna en nuestra BD (NO ENVIAR A API)
  company?: string;
  email?: string;
  phone_code?: string; // Código de país: CL, CO, etc.
  district?: string; // Barrio/comuna
  reference?: string; // Referencia para entrega (notas del cliente)
  type?: string; // Tipo de dirección
  address_id?: number; // ID de dirección guardada previamente
  identificationNumber?: string; // RUT/Tax ID
  category?: number; // Categoría de dirección
}

// Paquete individual
export interface EnviaPackage {
  type: 'box' | 'envelope' | 'custom';
  content: string;
  amount: number;
  declaredValue: number;
  weight: number;
  weightUnit: 'KG' | 'LB';
  lengthUnit: 'CM' | 'IN';
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  name?: string; // Nombre del paquete
  additionalServices?: Array<{
    name: string;
    value?: number;
  }>;
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    weight?: number;
    sku?: string;
    countryOfOrigin?: string;
  }>;
}

// Request para cotización
export interface EnviaQuoteRequest {
  origin: EnviaAddress;
  destination: EnviaAddress;
  packages: EnviaPackage[];
  shipment: {
    type: number; // 1 = normal
    carrier?: string; // Si se quiere cotizar un carrier específico
  };
}

// Opción de envío en respuesta de cotización
export interface EnviaQuoteOption {
  carrier: string;
  service: string;
  serviceDescription: string;
  deliveryEstimate: string;
  deliveryDate?: {
    date: string;
    timeUnit: string;
    dateDifference: number;
  };
  totalPrice: string;
  currency: string;
}

// Response de cotización
export interface EnviaQuoteResponse {
  meta: string;
  data: EnviaQuoteOption[];
}

// Request para generar etiqueta
export interface EnviaGenerateLabelRequest {
  origin: EnviaAddress;
  destination: EnviaAddress;
  packages: EnviaPackage[];
  shipment: {
    type: number; // 1 = Parcel, 2 = LTL, 3 = FTL
    carrier: string;
    service: string;
    declaredValue?: number; // Valor declarado del envío
    reverse_pickup?: 0 | 1; // 1 = envío de devolución
    import?: 0 | 1; // 1 = importación
    additionalServices?: Array<{
      name: string;
      value?: number;
    }>;
  };
  settings?: {
    currency?: string;
    printFormat?: string; // PDF, ZPL, EPL, PNG
    printSize?: string; // STOCK_4X6, LETTER, A4
    comments?: string;
  };
  pickup?: {
    date?: string;
    timeFrom?: string;
    timeTo?: string;
  };
  orderReference?: string; // Número de orden para mostrar en la etiqueta
  customsSettings?: {
    dutiesPaymentEntity?: 'envia_guaranteed' | 'sender' | 'recipient';
    exportReason?: string;
  };
}

// Etiqueta generada
export interface EnviaGeneratedLabel {
  carrier: string;
  service: string;
  shipmentId: number;
  trackingNumber: string;
  trackUrl: string;
  label: string; // URL del PDF
  totalPrice: number;
  currency: string;
}

// Response de generación de etiqueta
export interface EnviaGenerateLabelResponse {
  meta: string;
  data: EnviaGeneratedLabel[];
}

// Evento de tracking
export interface EnviaTrackingEvent {
  timestamp: string;
  location: string;
  description: string;
}

// Response de tracking
export interface EnviaTrackingResponse {
  meta: string;
  data: Array<{
    trackingNumber: string;
    status: string | number | { id?: number; name?: string; status?: string };
    carrier: string;
    events: EnviaTrackingEvent[];
  }>;
}

// Configuración de Envia.com del marketplace
export interface EnviaMarketplaceConfig {
  apiToken: string | null;
  sandboxToken: string | null;
  environment: 'sandbox' | 'production';
  enabled: boolean;
  webhookUrl: string | null;
  webhookSecret: string | null;
  apiUrl: string;
  apiTestUrl: string;
  carrierLogos?: Record<string, string>;
}

// Configuración de Envia.com del vendor
export interface EnviaVendorConfig {
  enabled: boolean;
  origin: EnviaAddress | null;
  enabledCarriers: string[];
  carrierSettings: Record<string, {
    enabled: boolean;
    priority: number;
    markup: number; // Porcentaje adicional
    customLabel?: string;
  }>;
  defaultPackageType: 'box' | 'envelope';
  defaultWeightUnit: 'KG' | 'LB';
  defaultLengthUnit: 'CM' | 'IN';
}

// Carriers disponibles en Chile (nombres exactos según API Envia.com)
export const CHILE_CARRIERS = [
  { code: 'chilexpress', name: 'Chilexpress', logo: 'http://localhost:3001/icons/6939609c-6385-4ef4-92b8-11d23740ef54.jpg' },
  { code: 'correoschile', name: 'Correos de Chile', logo: 'http://localhost:3001/icons/5e6274de-ad3e-463c-b907-2fb951d58bd6.jpg' },
  { code: 'blueexpress', name: 'Blue Express', logo: 'http://localhost:3001/icons/55ae193d-de5e-4065-b2f6-a9037f60e657.jpg' },
  { code: 'starken', name: 'Starken', logo: 'http://localhost:3001/icons/dd0d8c46-de0f-4607-8fc4-a5c031b64455.jpg' },
  { code: 'fedex', name: 'FedEx', logo: '/carriers/fedex.png' },
  { code: 'dhl', name: 'DHL', logo: '/carriers/dhl.png' },
];

// Códigos de región de Chile
export const CHILE_REGIONS = [
  { code: 'AP', name: 'Arica y Parinacota' },
  { code: 'TA', name: 'Tarapacá' },
  { code: 'AN', name: 'Antofagasta' },
  { code: 'AT', name: 'Atacama' },
  { code: 'CO', name: 'Coquimbo' },
  { code: 'VS', name: 'Valparaíso' },
  { code: 'RM', name: 'Región Metropolitana' },
  { code: 'LI', name: "O'Higgins" },
  { code: 'ML', name: 'Maule' },
  { code: 'NB', name: 'Ñuble' },
  { code: 'BI', name: 'Biobío' },
  { code: 'AR', name: 'La Araucanía' },
  { code: 'LR', name: 'Los Ríos' },
  { code: 'LL', name: 'Los Lagos' },
  { code: 'AI', name: 'Aysén' },
  { code: 'MA', name: 'Magallanes' },
];

/**
 * Convierte nombre de región a código corto
 * Ejemplos:
 *   "Región del Bio Bío" -> "BI"
 *   "Región Metropolitana" -> "RM"
 *   "Valparaíso" -> "VS"
 */
export function getRegionCode(regionName: string): string {
  if (!regionName) return 'RM'; // Default
  
  const normalized = regionName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/\s+/g, ' ') // Normalizar espacios
    .trim();
  
  // Buscar por nombre exacto o parcial
  const region = CHILE_REGIONS.find(r => {
    const rName = r.name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    // Coincidencia exacta
    if (normalized === rName || normalized.includes(rName) || rName.includes(normalized)) {
      return true;
    }
    
    // Casos especiales para regiones con múltiples nombres
    // "Región del Bio Bío" / "Biobío" / "Bio Bio"
    if (r.code === 'BI' && (normalized.includes('biobio') || normalized.includes('bio bio'))) {
      return true;
    }
    // "Región Metropolitana" / "Metropolitana" / "Santiago"
    if (r.code === 'RM' && (normalized.includes('metropolitana') || normalized.includes('santiago'))) {
      return true;
    }
    // "O'Higgins" / "Ohiggins" / "Libertador"
    if (r.code === 'LI' && (normalized.includes('ohiggins') || normalized.includes('libertador'))) {
      return true;
    }
    
    return false;
  });
  
  return region ? region.code : 'RM'; // Default RM si no encuentra
}

