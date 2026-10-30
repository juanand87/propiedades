"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ImageIcon, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";

const MAX_BATCH = 10;

const scenarios = [
  { id: "music_store", name: "Tienda de música vintage", detail: "Estanterías, madera y luz cálida." },
  { id: "audiophile_living", name: "Living audiófilo", detail: "Tornamesa, parlantes y ambiente premium." },
  { id: "jazz_bar", name: "Bar nocturno / jazz club", detail: "Luces suaves, mesa y copa o vaso de fondo." },
  { id: "urban_city", name: "Ciudad urbana", detail: "Vitrina, mural o calle musical." },
  { id: "nature", name: "Naturaleza / atardecer", detail: "Playa, bosque o exterior relajado." },
  { id: "collector_setup", name: "Setup de colección", detail: "Audífonos, tornamesa y otros formatos físicos." },
];

const styles = [
  { id: "realistic", name: "Realista premium" },
  { id: "vintage", name: "Vintage / nostálgico" },
  { id: "editorial", name: "Moderno editorial" },
  { id: "dramatic", name: "Oscuro dramático" },
  { id: "bright", name: "Luminoso comercial" },
];

const decorations = [
  { id: "none", name: "Sin decoración" },
  { id: "beer", name: "Cerveza" },
  { id: "wine", name: "Copa de vino" },
  { id: "turntable", name: "Tornamesa" },
  { id: "headphones", name: "Audífonos" },
  { id: "plants", name: "Plantas" },
  { id: "posters", name: "Posters musicales" },
];

const imageModels = [
  { id: "gpt-image-1-mini", name: "gpt-image-1-mini", detail: "Menor costo, ideal para pruebas masivas." },
  { id: "gpt-image-1", name: "gpt-image-1", detail: "Mayor calidad, mejor para piezas finales." },
];

const imageQualities = [
  { id: "medium", name: "Media" },
  { id: "low", name: "Baja" },
  { id: "high", name: "Alta" },
  { id: "auto", name: "Automatica" },
];

interface Product {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  images?: string[];
  format?: string;
  type?: string;
  condition?: string;
  stock?: number;
}

interface AccessStatus {
  enabled: boolean;
  apiConfigured: boolean;
  maxBatchSize: number;
  canGenerate: boolean;
  message: string;
}

interface HistoryItem {
  id: string;
  status: "pending" | "completed" | "failed";
  generatedImageUrl?: string | null;
  sourceImageUrl?: string | null;
  scenario: string;
  style: string;
  decoration?: string | null;
  prompt: string;
  errorMessage?: string | null;
  createdAt: string;
  productSnapshot?: any;
  product?: Product;
}

export default function AIImagesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scenario, setScenario] = useState("music_store");
  const [style, setStyle] = useState("realistic");
  const [decoration, setDecoration] = useState("none");
  const [model, setModel] = useState("gpt-image-1-mini");
  const [quality, setQuality] = useState("medium");
  const size = "1024x1024";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [profile, accessStatus, generationHistory] = await Promise.all([
        api.getProfile(),
        api.getAiImagesAccess(),
        api.getAiImagesHistory(40),
      ]);

      setAccess(accessStatus);
      setHistory(generationHistory || []);

      if (profile?.vendor?.id) {
        const response = await api.getProducts({ vendorId: profile.vendor.id, limit: 1000, includeOutOfStock: true });
        setProducts(response.products || response.data || response || []);
      }
    } catch (err: any) {
      setError(err.message || "No se pudo cargar la herramienta de imágenes IA.");
    } finally {
      setLoading(false);
    }
  };

  const availableFormats = useMemo(() => {
    const formats = new Set<string>();
    products.forEach((product) => {
      const value = product.format || product.type;
      if (value) formats.add(value);
    });
    return Array.from(formats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const productFormat = product.format || product.type || "";
      const matchesFormat = formatFilter === "all" || productFormat === formatFilter;
      const matchesSearch = !term || [product.title, product.artist, product.album]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      return matchesFormat && matchesSearch;
    });
  }, [products, search, formatFilter]);

  const selectedProducts = useMemo(
    () => products.filter((product) => selected.has(product.id)),
    [products, selected],
  );

  const toggleProduct = (productId: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) {
      if (next.size >= MAX_BATCH) return;
      next.add(productId);
    } else {
      next.delete(productId);
    }
    setSelected(next);
  };

  const generateImages = async () => {
    if (!selected.size) return;

    try {
      setGenerating(true);
      setError(null);
      const response = await api.generateAiImages({
        productIds: Array.from(selected),
        scenario,
        style,
        decoration,
        size,
        model,
        quality,
      });
      setHistory([...(response.results || []), ...history]);
      setSelected(new Set());
    } catch (err: any) {
      setError(err.message || "No se pudieron generar las imágenes.");
    } finally {
      setGenerating(false);
    }
  };

  const getProductImage = (product: Product) => {
    const first = Array.isArray(product.images) ? product.images[0] : null;
    return first ? getImageUrl(first) : null;
  };

  const getScenarioName = (id: string) => scenarios.find((item) => item.id === id)?.name || id;

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando generador de imágenes...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Imágenes con IA</h1>
          <p className="mt-1 text-gray-500">Genera imágenes promocionales para tus productos sin modificar el catálogo.</p>
        </div>
        <div className="rounded-md border bg-white px-4 py-3 text-sm text-gray-600">
          Máximo <strong>{access?.maxBatchSize || MAX_BATCH}</strong> productos por lote
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {!access?.canGenerate && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-amber-900">Generación IA no disponible</h2>
                <p className="text-sm text-amber-800">{access?.message || "Solicita al administrador activar esta función para tu tienda."}</p>
              </div>
              <Button variant="outline" disabled>Solicitar activación</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selected.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_180px_160px_160px_auto] lg:items-end">
              <div>
                <Label>Escenario</Label>
                <Select value={scenario} onValueChange={setScenario}>
                  <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{scenarios.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estilo visual</Label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{styles.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Decoración</Label>
                <Select value={decoration} onValueChange={setDecoration}>
                  <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{decorations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tamaño</Label>
                <div className="flex h-10 items-center rounded border bg-white px-3 text-sm text-gray-700">1024x1024 fijo</div>
              </div>
              <div>
                <Label>Modelo</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{imageModels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Calidad</Label>
                <Select value={quality} onValueChange={setQuality}>
                  <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{imageQualities.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button disabled={!access?.canGenerate || generating} onClick={generateImages} className="h-10">
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {generating ? "Generando..." : `Generar ${selected.size}`}
              </Button>
            </div>
            <p className="mt-3 text-sm text-blue-900">
              {selected.size} producto(s) seleccionados. La imagen se guardará solo en el historial interno y no modificará el catálogo.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Seleccionar productos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por artista, álbum o título..." />
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Formato" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los formatos</SelectItem>
                  {availableFormats.map((format) => <SelectItem key={format} value={format}>{format}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-gray-500">Seleccionados: {selected.size}/{MAX_BATCH}</div>

            <div className="max-h-[560px] overflow-y-auto rounded-md border">
              {filteredProducts.map((product) => {
                const image = getProductImage(product);
                const checked = selected.has(product.id);
                const disabled = !checked && selected.size >= MAX_BATCH;
                return (
                  <label key={product.id} className={`flex cursor-pointer items-center gap-3 border-b p-3 last:border-b-0 ${disabled ? "opacity-50" : ""}`}>
                    <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => toggleProduct(product.id, Boolean(value))} />
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-gray-100">
                      {image ? <img src={image} alt={product.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-gray-400"><ImageIcon className="h-5 w-5" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{product.title}</p>
                      <p className="truncate text-sm text-gray-500">{product.artist || "Sin artista"}</p>
                      <p className="text-xs text-gray-400">{product.format || product.type || "Formato no definido"}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" /> Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Escenario</Label>
              <Select value={scenario} onValueChange={setScenario}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{scenarios.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-gray-500">{scenarios.find((item) => item.id === scenario)?.detail}</p>
            </div>

            <div className="space-y-2">
              <Label>Estilo visual</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{styles.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Decoración</Label>
              <Select value={decoration} onValueChange={setDecoration}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{decorations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tamaño</Label>
              <div className="flex h-10 items-center rounded border px-3 text-sm text-gray-700">Cuadrada 1024x1024</div>
              <p className="text-xs text-gray-500">El tamaño queda fijo para mantener el flujo liviano y comparable.</p>
            </div>

            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{imageModels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-gray-500">{imageModels.find((item) => item.id === model)?.detail}</p>
            </div>

            <div className="space-y-2">
              <Label>Calidad</Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{imageQualities.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Usa media para controlar costos y alta cuando quieras comparar una pieza final.</p>
            </div>

            <div className="rounded-md bg-gray-50 p-4">
              <h3 className="font-medium">Resumen</h3>
              <p className="mt-1 text-sm text-gray-600">Se generarán imágenes para {selected.size} producto(s) con {model} en calidad {imageQualities.find((item) => item.id === quality)?.name.toLowerCase()}. No se modificarán las imágenes del producto.</p>
            </div>

            <Button className="w-full" disabled={!access?.canGenerate || generating || selected.size === 0} onClick={generateImages}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {generating ? "Generando..." : "Generar imágenes"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial interno</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center text-gray-500">Aún no hay imágenes generadas.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {history.map((item) => {
                const snapshot = item.productSnapshot || item.product || {};
                return (
                  <div key={item.id} className="overflow-hidden rounded-md border bg-white">
                    <div className="aspect-square bg-gray-100">
                      {item.generatedImageUrl ? <img src={item.generatedImageUrl} alt={snapshot.title || "Imagen IA"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-gray-500">{item.status === "failed" ? item.errorMessage || "Falló la generación" : "Pendiente"}</div>}
                    </div>
                    <div className="space-y-3 p-3">
                      <div>
                        <p className="line-clamp-2 font-medium">{snapshot.title || "Producto"}</p>
                        <p className="text-sm text-gray-500">{snapshot.artist || getScenarioName(item.scenario)}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{getScenarioName(item.scenario)}</span>
                        <span>{new Date(item.createdAt).toLocaleDateString("es-CL")}</span>
                      </div>
                      {item.generatedImageUrl && (
                        <Button asChild variant="outline" className="w-full">
                          <a href={item.generatedImageUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" /> Descargar</a>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
