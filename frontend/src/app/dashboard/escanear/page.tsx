"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { inventoryRequest } from "@/lib/inventory";
import { Pencil, Plus } from "lucide-react";

// ─── Goldmine scale ─────────────────────────────────────────────────────────
const GOLDMINE_GRADES = ["M", "NM", "VG+", "VG"];

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = "scan" | "select" | "form";

interface DiscogsResult {
  id: number;
  title: string;
  year?: string;
  format?: string[];
  label?: string[];
  country?: string;
  genre?: string[];
  style?: string[];
  thumb?: string;
  cover_image?: string;
  catno?: string;
}

interface DuplicateProduct {
  id: string;
  title: string;
  artist: string;
  stock: number;
  price: number;
  condition?: string;
  mediaGrade?: string;
  sleeveGrade?: string;
  year?: number | string;
  country?: string;
}

interface UploadedPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

interface SquareCropGeometry {
  renderedWidth: number;
  renderedHeight: number;
  left: number;
  top: number;
  sourceX: number;
  sourceY: number;
  sourceSize: number;
}

const normalizeShortDescriptionLabels = (value: string): string =>
  value.replace(/(^|\n)(\s*)Se(?:ñ|n)o(\s*:)/gi, "$1$2Sello$3");
const CROP_PREVIEW_SIZE = 288;

function getSquareCropGeometry(
  sourceWidth: number,
  sourceHeight: number,
  zoom: number,
  panX: number,
  panY: number,
  viewportSize: number = CROP_PREVIEW_SIZE,
): SquareCropGeometry {
  const safeZoom = Math.max(1, zoom);
  const baseScale = Math.max(viewportSize / sourceWidth, viewportSize / sourceHeight);
  const totalScale = baseScale * safeZoom;
  const renderedWidth = sourceWidth * totalScale;
  const renderedHeight = sourceHeight * totalScale;
  const maxOffsetX = Math.max(0, (renderedWidth - viewportSize) / 2);
  const maxOffsetY = Math.max(0, (renderedHeight - viewportSize) / 2);
  const horizontalFactor = (panX - 50) / 50;
  const verticalFactor = (panY - 50) / 50;
  const left = (viewportSize - renderedWidth) / 2 - (horizontalFactor * maxOffsetX);
  const top = (viewportSize - renderedHeight) / 2 - (verticalFactor * maxOffsetY);
  const sourceX = Math.max(0, Math.min(sourceWidth, -left / totalScale));
  const sourceY = Math.max(0, Math.min(sourceHeight, -top / totalScale));
  const sourceSize = Math.min(sourceWidth - sourceX, sourceHeight - sourceY, viewportSize / totalScale);

  return {
    renderedWidth,
    renderedHeight,
    left,
    top,
    sourceX,
    sourceY,
    sourceSize,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function EscanearPage() {
  const router = useRouter();
  const [inventoryContext, setInventoryContext] = useState<{ session: string; found: string } | null>(null);
  const [publishInventoryProduct, setPublishInventoryProduct] = useState(false);
  const [inventoryPhoto, setInventoryPhoto] = useState<string | null>(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const session = query.get('inventorySession'), found = query.get('inventoryFound');
    if (session && found && /^[0-9a-f-]{36}$/i.test(session) && /^[0-9a-f-]{36}$/i.test(found)) {
      setInventoryContext({ session, found }); setManualBarcode(query.get('barcode') || '');
      if (query.get('entry') === 'manual') {
        setSkippedDiscogs(true); setDuplicateAction('create'); setStep('form');
        setScannedBarcode(query.get('barcode') || '');
      }
      inventoryRequest(`sessions/${session}/found/${found}`).then(record => {
        setManualTitle(record.title === 'Producto sin identificar' ? '' : record.title || ''); setInventoryPhoto(record.photoUrl || null);
      }).catch(error => setSaveError(error.message));
    }
  }, []);
  const returnToInventory = (productId: string, gradeWarning = false) => {
    if (inventoryContext) router.push(`/dashboard/inventario/${inventoryContext.session}?found=${inventoryContext.found}&createdProduct=${productId}${gradeWarning ? '&gradeWarning=1' : ''}`);
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionRef = useRef<number | null>(null);
  const lastBarcodeRef = useRef<string>("");
  const inventoryScanStarted = useRef(false);
  const formatFilterScrollRef = useRef<HTMLDivElement>(null);
  const countryFilterScrollRef = useRef<HTMLDivElement>(null);
  const formatTouchStateRef = useRef({ startX: 0, startY: 0, startScrollLeft: 0, active: false });
  const countryTouchStateRef = useRef({ startX: 0, startY: 0, startScrollLeft: 0, active: false });
  const formatChipTrackRef = useRef<HTMLDivElement>(null);
  const countryChipTrackRef = useRef<HTMLDivElement>(null);
  const formatChipAnimReadyRef = useRef(false);
  const countryChipAnimReadyRef = useRef(false);

  const [step, setStep] = useState<Step>("scan");
  const [vendorId, setVendorId] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState(false);
  const hasBarcodeDetectorRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Scan step
  const [manualBarcode, setManualBarcode] = useState("");
  const [scannedBarcode, setScannedBarcode] = useState("");

  // Select step
  const [discogsResults, setDiscogsResults] = useState<DiscogsResult[]>([]);
  const [searchingDiscogs, setSearchingDiscogs] = useState(false);
  const [discogsError, setDiscogsError] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateProduct[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<DiscogsResult | null>(null);
  const [countryFilter, setCountryFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [formatFilterOffset, setFormatFilterOffset] = useState(0);
  const [countryFilterOffset, setCountryFilterOffset] = useState(0);
  const [formatSlideDirection, setFormatSlideDirection] = useState<1 | -1>(1);
  const [countrySlideDirection, setCountrySlideDirection] = useState<1 | -1>(1);
  // Detail view
  const [previewRelease, setPreviewRelease] = useState<DiscogsResult | null>(null);
  const [releaseImages, setReleaseImages] = useState<string[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [fullReleaseDetail, setFullReleaseDetail] = useState<any>(null);
  const [shortDescriptionTemplate, setShortDescriptionTemplate] = useState("");
  const [technicalSpecsTemplate, setTechnicalSpecsTemplate] = useState("");

  // Manual entry (when skipping Discogs)
  const [skippedDiscogs, setSkippedDiscogs] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [manualYear, setManualYear] = useState("");
  const [manualFormat, setManualFormat] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropSourcePhoto, setCropSourcePhoto] = useState<UploadedPhoto | null>(null);
  const [cropSourceSize, setCropSourceSize] = useState({ width: 1, height: 1 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const uploadedPhotosRef = useRef<UploadedPhoto[]>([]);

  // Form step
  const [form, setForm] = useState({
    price: "",
    condition: "",
    mediaGrade: "",
    sleeveGrade: "",
    categoryId: "",
    country: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [duplicateAction, setDuplicateAction] = useState<"ask" | "create" | "stock" | "edit">("ask");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  useEffect(() => {
    uploadedPhotosRef.current = uploadedPhotos;
  }, [uploadedPhotos]);

  // ─── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const supported = typeof window !== "undefined" && "BarcodeDetector" in window;
    setHasBarcodeDetector(supported);
    hasBarcodeDetectorRef.current = supported;
    loadProfile();
    return () => {
      if (detectionRef.current) cancelAnimationFrame(detectionRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      uploadedPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  const loadProfile = async () => {
    try {
      const vendor = await api.getMyVendor();
      const [vendorCats, settings] = await Promise.all([
        api.getVendorCategories(vendor.id),
        api.getVendorSettings(vendor.id).catch(() => ({})),
      ]);
      setVendorId(vendor.id);
      setCategories(vendorCats.filter((c: any) => c.isActive));
      setShortDescriptionTemplate(settings.shortDescriptionTemplate || "");
      setTechnicalSpecsTemplate(settings.technicalSpecsTemplate || "");
    } catch {
      // ignore
    }
  };

  // ─── Camera ─────────────────────────────────────────────────────────────────
  const stopCamera = () => {
    if (detectionRef.current) cancelAnimationFrame(detectionRef.current);
    detectionRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setScanning(false);
  };

  const startDetectionLoop = () => {
    if (!hasBarcodeDetectorRef.current) return;
    let detector: any;
    try {
      detector = new (window as any).BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
      });
    } catch {
      return;
    }

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        detectionRef.current = requestAnimationFrame(detect);
        return;
      }
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          if (code !== lastBarcodeRef.current) {
            lastBarcodeRef.current = code;
            stopCamera();
            handleBarcodeFound(code);
            return;
          }
        }
      } catch {
        // ignore
      }
      detectionRef.current = requestAnimationFrame(detect);
    };
    detectionRef.current = requestAnimationFrame(detect);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCameraActive(true); // video elem renders after this
      setScanning(true);
    } catch (err: any) {
      const msg = err?.name === "NotAllowedError"
        ? "Permiso de cámara denegado. Habilitalo en la configuración del navegador."
        : err?.name === "NotFoundError"
        ? "No se encontró cámara en este dispositivo."
        : "No se pudo acceder a la cámara. Usá el ingreso manual.";
      alert(msg);
    }
  };

  useEffect(() => {
    if (!inventoryContext || !vendorId || !hasBarcodeDetector || inventoryScanStarted.current) return;
    if (new URLSearchParams(window.location.search).get('entry') !== 'scan') return;
    inventoryScanStarted.current = true;
    void startCamera();
  }, [inventoryContext, vendorId, hasBarcodeDetector]);

  // Adjuntar stream al <video> después de que React lo monte en el DOM
  useEffect(() => {
    if (!cameraActive || !streamRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = streamRef.current;
    video.play().then(() => startDetectionLoop()).catch(() => {});
  }, [cameraActive]);

  // ─── Barcode or name search ────────────────────────────────────────────────
  const isBarcode = (input: string): boolean => /^\d+$/.test(input.trim());

  const handleSearchProduct = async (searchInput: string) => {
    if (!searchInput.trim()) return;
    stopCamera();
    setScannedBarcode(searchInput);
    setManualBarcode(searchInput);
    setStep("select");
    setDiscogsResults([]);
    setDuplicates([]);
    setDiscogsError("");
    setCountryFilter("");
    setFormatFilter("");
    setCountryFilterOffset(0);
    setFormatFilterOffset(0);
    setSearchingDiscogs(true);

    try {
      if (isBarcode(searchInput)) {
        const existing = await api.getProducts({ barcode: searchInput, vendorId, includeOutOfStock: true });
        const dupes = Array.isArray(existing)
          ? existing
          : (existing.products || existing.data || []);
        setDuplicates(dupes.slice(0, 3));
      }

      let releases: DiscogsResult[] = [];
      if (isBarcode(searchInput)) {
        const results = await api.searchDiscogs(vendorId, { barcode: searchInput });
        releases = results?.results || [];
        if (releases.length === 0) {
          const fallback = await api.searchDiscogs(vendorId, { query: searchInput });
          releases = fallback?.results || [];
        }
      } else {
        const results = await api.searchDiscogs(vendorId, { query: searchInput });
        releases = results?.results || [];
      }

      const perFormatCount: Record<string, number> = {};
      const limited: DiscogsResult[] = [];
      for (const release of releases) {
        if (limited.length >= 100) break;
        const formatKey = release.format?.[0] || "Otros";
        const count = perFormatCount[formatKey] || 0;
        if (count < 50) {
          limited.push(release);
          perFormatCount[formatKey] = count + 1;
        }
      }

      setDiscogsResults(limited);
      if (limited.length === 0) {
        setDiscogsError(`No se encontraron resultados en Discogs para "${searchInput}".`);
      }
    } catch (err: any) {
      setDiscogsError(err.message || "Error al buscar en Discogs.");
    } finally {
      setSearchingDiscogs(false);
    }
  };

  // ─── Barcode found ──────────────────────────────────────────────────────────
  const handleBarcodeFound = (barcode: string) => {
    handleSearchProduct(barcode);
  };

  // ─── Release preview / detail ────────────────────────────────────────────
  const handlePreviewRelease = async (release: DiscogsResult) => {
    setPreviewRelease(release);
    setFullReleaseDetail(null);
    setReleaseImages(release.cover_image ? [release.cover_image] : release.thumb ? [release.thumb] : []);
    setLoadingDetail(true);
    try {
      const detail = await api.getDiscogsRelease(vendorId, String(release.id));
      setFullReleaseDetail(detail);
      if (detail?.images?.length) {
        setReleaseImages(detail.images.slice(0, 5).map((img: any) => img.uri || img.resource_url || "").filter(Boolean));
      }
    } catch {
      // keep thumb
    } finally {
      setLoadingDetail(false);
    }
  };

  // ─── Release selected ───────────────────────────────────────────────────────
  const handleSelectRelease = (release: DiscogsResult) => {
    setSelectedRelease(release);
    setSkippedDiscogs(false);
    setDuplicateAction("create");
    const detectedCategoryId = detectCategoryFromReleaseFormat(release);
    setForm((f) => ({
      ...f,
      country: release.country || "",
      categoryId: detectedCategoryId || f.categoryId,
    }));
    setStep("form");
  };

  const handleSkipDiscogs = () => {
    setSelectedRelease(null);
    setSkippedDiscogs(true);
    setDuplicateAction("create");
    setStep("form");
  };

  const parseDiscogsTitle = (title: string) => {
    const parts = title.split(" - ");
    if (parts.length >= 2) return { artist: parts[0].trim(), album: parts.slice(1).join(" - ").trim() };
    return { artist: "", album: title };
  };

  const detectCategoryFromReleaseFormat = (release: DiscogsResult): string | undefined => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s"]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const formatText = normalize((release.format || []).join(" "));
    if (!formatText) return undefined;

    const formatKeywordGroups: Record<string, string[]> = {
      vinilo: ["vinyl", "vinilo", "lp", "12\"", "10\"", "7\"", "45rpm", "33rpm"],
      cd: ["cd", "compact disc", "compactdisc", "sacd", "cdr"],
      cassette: ["cassette", "casete", "tape"],
      dvd: ["dvd"],
      vhs: ["vhs"],
      bluray: ["blu ray", "bluray", "blu-ray", "bd"],
    };

    let detectedType: string | undefined;
    for (const [type, keywords] of Object.entries(formatKeywordGroups)) {
      if (keywords.some((k) => formatText.includes(k))) {
        detectedType = type;
        break;
      }
    }

    if (!detectedType) return undefined;

    const categoryNameGroups: Record<string, string[]> = {
      vinilo: ["vinilo", "vinyl", "lp"],
      cd: ["cd", "compact"],
      cassette: ["cassette", "casete", "tape"],
      dvd: ["dvd"],
      vhs: ["vhs"],
      bluray: ["blu ray", "bluray", "blu-ray"],
    };

    const expectedNames = categoryNameGroups[detectedType] || [];
    const match = categories.find((cat) => {
      if ((cat.category?.usesMusicMetadata ?? cat.usesMusicMetadata) === false) return false;
      const name = normalize(cat.category?.name || cat.name || "");
      return expectedNames.some((n) => name.includes(n));
    });

    return match ? (match.category?.id || match.id) : undefined;
  };

  // ─── Build rich text fields from full Discogs detail ────────────────────────
  const buildDescription = (detail: any, fallbackTitle: string): string => {
    if (!detail) return "";
    const fullTitle = detail.artists?.map((a: any) => a.name).join(", ") + (detail.title ? " - " + detail.title : "") || fallbackTitle;
    let desc = `${fullTitle}${detail.year ? ` (${detail.year})` : ""}`;
    if (detail.labels?.length) desc += `\nSello: ${detail.labels.map((l: any) => l.name).join(", ")}`;
    if (detail.genres?.length) desc += `\nGénero: ${detail.genres.join(", ")}`;
    if (detail.styles?.length) desc += `\nEstilo: ${detail.styles.join(", ")}`;
    if (detail.notes) desc += `\n\n${detail.notes}`;
    return desc.trim();
  };

  const buildTracklist = (detail: any): string => {
    if (!detail?.tracklist?.length) return "";
    return detail.tracklist.map((t: any) => {
      let s = t.position ? `${t.position}. ` : "";
      s += t.title;
      if (t.duration) s += ` (${t.duration})`;
      return s;
    }).join("\n");
  };

  const buildShortDescription = (detail: any): string => {
    if (!shortDescriptionTemplate || !detail) return "";
    const reps: Record<string, string> = {
      '[title]': detail.title || '',
      '[artist]': detail.artists?.map((a: any) => a.name).join(', ') || '',
      '[year]': detail.year?.toString() || '',
      '[format]': detail.formats?.map((f: any) => f.name).join(', ') || '',
      '[label]': detail.labels?.[0]?.name || '',
      '[country]': detail.country || '',
      '[genre]': detail.genres?.join(', ') || '',
      '[style]': detail.styles?.join(', ') || '',
      '[catalog]': detail.labels?.[0]?.catno || '',
      '[barcode]': detail.identifiers?.find((id: any) => id.type === 'Barcode')?.value || '',
      '[notes]': detail.notes || '',
      '[released]': detail.released || '',
      '[credits]': detail.extraartists?.map((a: any) => `${a.name} (${a.role})`).join(', ') || '',
    };
    let result = shortDescriptionTemplate;
    Object.entries(reps).forEach(([k, v]) => {
      result = result.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), v);
    });
    return normalizeShortDescriptionLabels(result);
  };

  const buildTechnicalSpecs = (detail: any): string => {
    if (!detail) return "";
    if (!technicalSpecsTemplate) {
      const specs: string[] = [];
      if (detail.country) specs.push(`País: ${detail.country}`);
      if (detail.released) specs.push(`Fecha de lanzamiento: ${detail.released}`);
      detail.formats?.forEach((f: any) => { if (f.text) specs.push(f.text); });
      detail.identifiers?.forEach((id: any) => specs.push(`${id.type}: ${id.value}`));
      return specs.join("\n");
    }
    const reps: Record<string, string> = {
      '[title]': detail.title || '',
      '[artist]': detail.artists?.map((a: any) => a.name).join(', ') || '',
      '[year]': detail.year?.toString() || '',
      '[format]': detail.formats?.map((f: any) => { let s = f.name; if (f.descriptions?.length) s += ` (${f.descriptions.join(", ")})`; return s; }).join(', ') || '',
      '[label]': detail.labels?.[0]?.name || '',
      '[country]': detail.country || '',
      '[genre]': detail.genres?.join(', ') || '',
      '[style]': detail.styles?.join(', ') || '',
      '[catalog]': detail.labels?.[0]?.catno || '',
      '[barcode]': detail.identifiers?.find((id: any) => id.type === 'Barcode')?.value || '',
      '[notes]': detail.notes || '',
      '[released]': detail.released || '',
      '[credits]': detail.extraartists?.map((a: any) => `${a.name} (${a.role})`).join(', ') || '',
    };
    let result = technicalSpecsTemplate;
    Object.entries(reps).forEach(([k, v]) => {
      result = result.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), v);
    });
    return normalizeShortDescriptionLabels(result);
  };

  const normalizeCreatedItemLabel = (formatValue?: string): string => {
    if (!formatValue?.trim()) return "Producto";
    const normalized = formatValue
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    if (normalized.includes("vinyl") || normalized.includes("vinilo") || normalized.includes("lp")) return "Vinilo";
    if (normalized.includes("cd") || normalized.includes("compact disc")) return "CD";
    if (normalized.includes("cassette") || normalized.includes("casete") || normalized.includes("tape")) return "Cassette";
    if (normalized.includes("dvd")) return "DVD";
    if (normalized.includes("vhs")) return "VHS";
    if (normalized.includes("blu ray") || normalized.includes("bluray") || normalized.includes("blu-ray")) return "Blu-ray";

    const first = formatValue.split(",")[0]?.trim();
    if (!first) return "Producto";
    return first.charAt(0).toUpperCase() + first.slice(1);
  };

  const normalizeGoldmineGrade = (grade?: string): string | undefined => {
    if (!grade) return undefined;
    const normalized = grade.trim().toUpperCase();
    if (normalized === "NM/M-") return "NM";
    return normalized;
  };

  const formatDuplicatePrice = (price?: number): string => {
    if (typeof price !== "number" || Number.isNaN(price)) return "Sin dato";
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getDuplicateConditionReference = (dup: DuplicateProduct): string => {
    if (dup.condition === "used") {
      const media = normalizeGoldmineGrade(dup.mediaGrade) || "-";
      const sleeve = normalizeGoldmineGrade(dup.sleeveGrade) || "-";
      return `Usado · Disco ${media} · Funda ${sleeve}`;
    }
    if (dup.condition === "new") return "Nuevo";
    return "Sin dato";
  };

  const handleEditDuplicate = async (duplicate: DuplicateProduct) => {
    if (inventoryContext) { returnToInventory(duplicate.id); return; }
    if (loadingProductId || saving) return;
    setLoadingProductId(duplicate.id);
    setSaveError("");
    try {
      const product = await api.getProduct(duplicate.id);
      setEditingProduct(product);
      setForm({
        price: String(product.price ?? ""),
        condition: product.condition || "",
        mediaGrade: product.mediaGrade || "",
        sleeveGrade: product.sleeveGrade || "",
        categoryId: product.categories?.[0]?.id || "",
        country: product.country || "",
      });
      setSelectedRelease({
        id: 0,
        title: product.title || duplicate.title,
        year: product.year ? String(product.year) : undefined,
        country: product.country || undefined,
        thumb: product.images?.[0] || undefined,
      });
      setSkippedDiscogs(false);
      setDuplicateAction("edit");
      setStep("form");
    } catch (err: any) {
      setSaveError(err.message || "No se pudo cargar el producto.");
    } finally {
      setLoadingProductId(null);
    }
  };

  const handleAddDuplicateStock = async (duplicate?: DuplicateProduct) => {
    const target = duplicate || duplicates[0];
    if (inventoryContext && target) { returnToInventory(target.id); return; }
    if (!target || saving || loadingProductId) return;
    setSaving(true);
    setSaveError("");
    try {
      const current = await api.getProduct(target.id);
      const dup = { ...target, stock: Math.max(0, Number(current.stock) || 0) };
      await api.updateProduct(dup.id, { stock: (dup.stock || 0) + 1 });
      setSuccessNotice({
        open: true,
        message: `Stock de "${dup.title || dup.artist || "Producto"}" actualizado a ${(dup.stock || 0) + 1}`,
      });
      resetAll();
    } catch (err: any) {
      setSaveError(err.message || "Error al actualizar stock.");
    } finally {
      setSaving(false);
    }
  };

  const createUploadedPhoto = (file: File): UploadedPhoto => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: URL.createObjectURL(file),
  });

  const addUploadedPhotos = (files: FileList | File[]) => {
    const next = Array.from(files).map(createUploadedPhoto);
    setUploadedPhotos((prev) => [...prev, ...next]);
  };

  const removeUploadedPhoto = (id: string) => {
    setUploadedPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const moveUploadedPhoto = (fromIndex: number, toIndex: number) => {
    setUploadedPhotos((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const setPrimaryUploadedPhoto = (index: number) => {
    moveUploadedPhoto(index, 0);
  };

  const closeCropModal = () => {
    setCropModalOpen(false);
    setCropSourcePhoto(null);
    setCropSourceSize({ width: 1, height: 1 });
    setCropZoom(1);
    setCropX(50);
    setCropY(50);
  };

  const openCropModalWithCameraFile = (file: File) => {
    const photo = createUploadedPhoto(file);
    setCropSourcePhoto(photo);
    const img = new Image();
    img.onload = () => setCropSourceSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = photo.previewUrl;
    setCropZoom(1);
    setCropX(50);
    setCropY(50);
    setCropModalOpen(true);
  };

  const useOriginalCameraPhoto = () => {
    if (!cropSourcePhoto) return;
    setUploadedPhotos((prev) => [...prev, cropSourcePhoto]);
    closeCropModal();
  };

  const discardCameraPhoto = () => {
    if (cropSourcePhoto) URL.revokeObjectURL(cropSourcePhoto.previewUrl);
    closeCropModal();
  };

  const applyCropToCameraPhoto = async () => {
    if (!cropSourcePhoto) return;
    try {
      const img = new Image();
      img.src = cropSourcePhoto.previewUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
  const geometry = getSquareCropGeometry(srcW, srcH, cropZoom, cropX, cropY);
  const outputSize = Math.min(1400, Math.round(geometry.sourceSize));
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        useOriginalCameraPhoto();
        return;
      }

      ctx.drawImage(
        img,
        geometry.sourceX,
        geometry.sourceY,
        geometry.sourceSize,
        geometry.sourceSize,
        0,
        0,
        outputSize,
        outputSize,
      );

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.92);
      });

      if (!blob) {
        useOriginalCameraPhoto();
        return;
      }

      const croppedFile = new File([
        blob,
      ], cropSourcePhoto.file.name.replace(/\.[^.]+$/, "") + "-crop.jpg", {
        type: "image/jpeg",
      });

      URL.revokeObjectURL(cropSourcePhoto.previewUrl);
      const croppedPhoto = createUploadedPhoto(croppedFile);
      setUploadedPhotos((prev) => [...prev, croppedPhoto]);
      closeCropModal();
    } catch {
      useOriginalCameraPhoto();
    }
  };

  // ─── Save product ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (duplicateAction === "stock") {
      await handleAddDuplicateStock();
      return;
    }
    if (!form.price || !form.condition || !form.categoryId) {
      setSaveError("Completá precio, condición y categoría.");
      return;
    }
    if (form.condition === "used" && (!form.mediaGrade || !form.sleeveGrade)) {
      setSaveError("Seleccioná el estado del disco y la funda.");
      return;
    }

    if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
      setSaveError("Ingresa un precio válido.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      if (duplicateAction === "edit" && editingProduct) {
        const current = await api.getProduct(editingProduct.id);
        const stock = Math.max(0, Number(current.stock) || 0) + 1;
        const categoryIds = (editingProduct.categories || []).map((category: any) => category.id);
        await api.updateProduct(editingProduct.id, {
          price: Number(form.price),
          condition: form.condition,
          mediaGrade: form.condition === "used" ? form.mediaGrade : null,
          sleeveGrade: form.condition === "used" ? form.sleeveGrade : null,
          country: form.country,
          categoryIds: [...new Set([form.categoryId, ...categoryIds.slice(1)])],
          stock,
        });
        setSuccessNotice({ open: true, message: `Producto actualizado. Stock: ${stock} (+1).` });
        resetAll();
        return;
      }
      const detail = fullReleaseDetail;
      // Artist name: prefer full detail artists array, else parse from title
      const artistFromDetail = detail?.artists?.map((a: any) => a.name.replace(/ \(\d+\)$/, '')).join(', ');
      const { artist: parsedArtist, album: parsedAlbum } = selectedRelease
        ? parseDiscogsTitle(selectedRelease.title)
        : { artist: "", album: "" };
      const artist = skippedDiscogs ? manualArtist : (artistFromDetail || parsedArtist);
      const album = skippedDiscogs ? manualTitle : (detail?.title || parsedAlbum);

      const description = buildDescription(detail, selectedRelease?.title || scannedBarcode);
      const tracklist = buildTracklist(detail);
      const shortDescription = buildShortDescription(detail);
      const technicalSpecs = buildTechnicalSpecs(detail);

      // Images: upload user photos if any, else download from Discogs and upload to Spaces
      let images: string[] = skippedDiscogs && inventoryPhoto ? [inventoryPhoto] : [];
      if (skippedDiscogs && uploadedPhotos.length > 0 && vendorId) {
        // Usuario subió fotos manualmente (modo sin Discogs)
        try {
          setPhotoUploading(true);
          const dt = new DataTransfer();
          uploadedPhotos.forEach((p) => dt.items.add(p.file));
          images = await api.uploadFiles(vendorId, dt.files);
        } finally {
          setPhotoUploading(false);
        }
      } else if (!skippedDiscogs && (releaseImages.length > 0 || selectedRelease?.cover_image)) {
        // Descargar imágenes desde Discogs y subirlas a Spaces
        try {
          setPhotoUploading(true);
          
          // Generar slug temporal basado en título
          const tempTitle = selectedRelease?.title || scannedBarcode;
          const tempSlug = tempTitle
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
          
          // Preparar array de imágenes de Discogs
          const discogsImages = releaseImages.length > 0
            ? releaseImages.map(url => ({ uri: url }))
            : selectedRelease?.cover_image 
              ? [{ uri: selectedRelease.cover_image }]
              : [];
          
          console.log('📸 Downloading Discogs images:', discogsImages);
          
          // Descargar y subir a Spaces
          images = await api.downloadDiscogsImages(discogsImages, tempSlug);
          
          console.log('✅ Images uploaded to Spaces:', images);
        } catch (err: any) {
          console.error('❌ Error downloading images:', err);
          // Fallback: usar URLs directas de Discogs si falla la descarga
          images = releaseImages.length > 0
            ? releaseImages
            : selectedRelease?.cover_image ? [selectedRelease.cover_image] : [];
        } finally {
          setPhotoUploading(false);
        }
      }

      const productData: any = {
        title: skippedDiscogs ? (manualTitle || scannedBarcode) : (selectedRelease?.title || scannedBarcode),
        artist: artist || undefined,
        album: album || undefined,
        label: detail?.labels?.[0]?.name || selectedRelease?.label?.[0] || "",
        year: skippedDiscogs
          ? (manualYear ? parseInt(manualYear) : undefined)
          : (detail?.year ? parseInt(detail.year) : (selectedRelease?.year ? parseInt(selectedRelease.year) : undefined)),
        country: form.country || detail?.country || selectedRelease?.country || "",
        format: skippedDiscogs
          ? manualFormat
          : (detail?.formats?.map((f: any) => f.name).join(", ") || selectedRelease?.format?.join(", ") || ""),
        genre: detail?.genres?.join(", ") || selectedRelease?.genre?.[0] || "",
        images,
        discogsId: selectedRelease ? String(selectedRelease.id) : undefined,
        barcode: scannedBarcode,
        description,
        shortDescription: shortDescription || undefined,
        tracklist: tracklist || undefined,
        technicalSpecs: technicalSpecs || undefined,
        price: parseFloat(form.price),
        condition: form.condition,
        mediaGrade: form.condition === "used" ? normalizeGoldmineGrade(form.mediaGrade) : undefined,
        sleeveGrade: form.condition === "used" ? normalizeGoldmineGrade(form.sleeveGrade) : undefined,
        stock: 1,
        categoryIds: [form.categoryId],
        vendorId,
        status: inventoryContext && !publishInventoryProduct ? "inactive" : "active",
      };

      // Auto-search Spotify
      if (artist && album && vendorId) {
        try {
          const sp = await api.searchSpotify(vendorId, `${artist} ${album}`);
          if (sp?.albums?.[0]?.id) {
            productData.spotifyAlbumId = sp.albums[0].id;
            productData.spotifyEnabled = true;
          }
        } catch { /* no spotify configured, ignore */ }
      }

      const createdLabel = normalizeCreatedItemLabel(productData.format);
      if (inventoryContext) await inventoryRequest(`sessions/${inventoryContext.session}/found/${inventoryContext.found}`);
      const createdProduct = await api.createProduct(productData);

      if (
        productData.condition === "used" &&
        createdProduct?.id &&
        (createdProduct.mediaGrade !== productData.mediaGrade || createdProduct.sleeveGrade !== productData.sleeveGrade)
      ) {
        try {
          await api.updateProduct(createdProduct.id, {
            condition: "used",
            mediaGrade: productData.mediaGrade,
            sleeveGrade: productData.sleeveGrade,
          });
        } catch (error) {
          if (!inventoryContext) throw error;
          returnToInventory(createdProduct.id, true); return;
        }
      }

      if (inventoryContext && createdProduct?.id) { returnToInventory(createdProduct.id); return; }

      setSuccessNotice({
        open: true,
        message: `${createdLabel} creado exitosamente`,
      });
    } catch (err: any) {
      setSaveError(err.message || "Error al crear el producto.");
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setStep("scan");
    setScannedBarcode("");
    setManualBarcode("");
    setDiscogsResults([]);
    setDuplicates([]);
    setSelectedRelease(null);
    setPreviewRelease(null);
    setReleaseImages([]);
    setFullReleaseDetail(null);
    setCountryFilter("");
    setFormatFilterOffset(0);
    setCountryFilterOffset(0);
    setLightboxImg(null);
    setForm({ price: "", condition: "", mediaGrade: "", sleeveGrade: "", categoryId: "", country: "" });
    setEditingProduct(null);
    setDuplicateAction("ask");
    setSkippedDiscogs(false);
    setManualTitle("");
    setManualArtist("");
    setManualYear("");
    setManualFormat("");
    uploadedPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setUploadedPhotos([]);
    if (cropSourcePhoto) URL.revokeObjectURL(cropSourcePhoto.previewUrl);
    closeCropModal();
    setSaveError("");
    lastBarcodeRef.current = "";
  };

  const handleRetry = () => {
    resetAll();
    startCamera();
  };

  const scrollChipRow = (ref: React.RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    ref.current?.scrollBy({
      left: direction === "left" ? -160 : 160,
      behavior: "smooth",
    });
  };

  const onTouchStartChipRow = (
    e: React.TouchEvent<HTMLDivElement>,
    ref: React.RefObject<HTMLDivElement | null>,
    stateRef: React.MutableRefObject<{ startX: number; startY: number; startScrollLeft: number; active: boolean }>,
  ) => {
    if (!ref.current) return;
    stateRef.current.active = true;
    stateRef.current.startX = e.touches[0].clientX;
    stateRef.current.startY = e.touches[0].clientY;
    stateRef.current.startScrollLeft = ref.current.scrollLeft;
  };

  // Native non-passive touchmove — React's onTouchMove is registered passive so e.preventDefault() is silently ignored there.
  useEffect(() => {
    function attach(
      el: HTMLDivElement | null,
      stateRef: React.MutableRefObject<{ startX: number; startY: number; startScrollLeft: number; active: boolean }>
    ) {
      if (!el) return () => {};
      const handler = (e: TouchEvent) => {
        if (!stateRef.current.active) return;
        const deltaX = e.touches[0].clientX - stateRef.current.startX;
        const deltaY = e.touches[0].clientY - stateRef.current.startY;
        if (Math.abs(deltaX) > Math.abs(deltaY) + 4) {
          e.preventDefault();
        }
      };
      el.addEventListener('touchmove', handler, { passive: false });
      return () => el.removeEventListener('touchmove', handler);
    }
    const c1 = attach(formatFilterScrollRef.current, formatTouchStateRef);
    const c2 = attach(countryFilterScrollRef.current, countryTouchStateRef);
    return () => { c1(); c2(); };
  }, [discogsResults]);

  useEffect(() => {
    const el = formatChipTrackRef.current;
    if (!el || typeof el.animate !== "function") return;
    if (!formatChipAnimReadyRef.current) {
      formatChipAnimReadyRef.current = true;
      return;
    }
    const startX = formatSlideDirection === 1 ? 18 : -18;
    el.animate(
      [
        { transform: `translateX(${startX}px)`, opacity: 0.92 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      { duration: 190, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [formatFilterOffset, formatSlideDirection]);

  useEffect(() => {
    const el = countryChipTrackRef.current;
    if (!el || typeof el.animate !== "function") return;
    if (!countryChipAnimReadyRef.current) {
      countryChipAnimReadyRef.current = true;
      return;
    }
    const startX = countrySlideDirection === 1 ? 18 : -18;
    el.animate(
      [
        { transform: `translateX(${startX}px)`, opacity: 0.92 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      { duration: 190, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [countryFilterOffset, countrySlideDirection]);

  const onTouchEndChipRow = (
    stateRef: React.MutableRefObject<{ startX: number; startY: number; startScrollLeft: number; active: boolean }>,
  ) => {
    stateRef.current.active = false;
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] bg-gray-100 text-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button
          onClick={() => {
            if (previewRelease) { setPreviewRelease(null); return; }
            if (step !== "scan") { resetAll(); return; }
            router.push(inventoryContext ? `/dashboard/inventario/${inventoryContext.session}` : "/dashboard/products");
          }}
          className="text-gray-500 hover:text-gray-800 text-xl w-8"
        >
          ←
        </button>
        <h1 className="text-sm font-semibold flex-1 text-center tracking-wide uppercase text-gray-700">
          {step === "scan" ? "Escanear producto" : step === "select" ? "Seleccionar versión" : "Datos del producto"}
        </h1>
        {step !== "scan" && (
          <button onClick={resetAll} className="text-gray-400 text-xs w-14 text-right">
            Reiniciar
          </button>
        )}
      </div>

      {inventoryContext && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-200 bg-cyan-50 px-4 py-2 text-xs text-cyan-900"><button onClick={() => router.push(`/dashboard/inventario/${inventoryContext.session}`)}>Volver al inventario</button><label className="flex items-center gap-2"><input type="checkbox" checked={publishInventoryProduct} onChange={e => setPublishInventoryProduct(e.target.checked)} />Publicar producto al crearlo</label></div>}
      {/* ─── STEP 1: SCAN ─────────────────────────────────────────────────── */}
      {step === "scan" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8">
          {/* Video siempre montado para que el ref esté disponible */}
          <div className={`relative w-full max-w-sm aspect-[4/3] rounded-xl overflow-hidden border border-zinc-600 ${cameraActive ? "block" : "hidden"}`}>
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3/4 h-1/3 border-2 border-gray-400/60 rounded-md">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/50" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/50" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/50" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/50" />
              </div>
            </div>
            <div className="absolute inset-x-1/8 animate-scan-line h-px bg-white/30 blur-sm" />
            <button onClick={stopCamera} className="absolute top-2 right-2 bg-black/60 text-white rounded-full px-3 py-1 text-xs">
              Cerrar
            </button>
          </div>

          {!cameraActive && (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 rounded-xl bg-gray-200 border border-gray-300 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <p className="text-gray-500 text-sm">Apuntá la cámara al código de barras del disco</p>
                {!hasBarcodeDetector && (
                  <p className="text-xs text-gray-400">Tu navegador detectará el código automáticamente o podés ingresarlo manualmente.</p>
                )}
              </div>

              <button
                onClick={startCamera}
                className="w-full max-w-xs py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-md text-sm transition-colors shadow-sm"
              >
                Escanear Producto
              </button>
            </>
          )}

          {/* Si no hay BarcodeDetector, mostrar input manual sobre la cámara */}
          {cameraActive && !hasBarcodeDetector && (
            <div className="w-full max-w-xs space-y-2">
              <input
                type="text"
                inputMode="search"
                placeholder="Código o nombre del disco"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-300 text-center text-base focus:outline-none focus:border-slate-700"
              />
              <button
                onClick={() => { stopCamera(); handleSearchProduct(manualBarcode); }}
                disabled={!manualBarcode.trim()}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-medium rounded-lg transition-colors"
              >
                Buscar
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 w-full max-w-xs">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-gray-400 text-xs uppercase tracking-wide">o ingresá código o nombre</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="w-full max-w-xs space-y-2">
            <input
              type="text"
              inputMode="search"
              placeholder="Código EAN/UPC o nombre del disco"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchProduct(manualBarcode)}
              className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-300 text-center text-base focus:outline-none focus:border-slate-700"
            />
            <button
              onClick={() => handleSearchProduct(manualBarcode)}
              disabled={!manualBarcode.trim()}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-medium rounded-lg transition-colors text-sm"
            >
              Buscar
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: SELECT ───────────────────────────────────────────────── */}
      {step === "select" && (
        <div className="flex-1 flex flex-col overflow-x-hidden">
          <div className="px-4 py-2 bg-white border-b border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Código:</span>
              <span className="font-mono text-gray-700 text-sm">{scannedBarcode}</span>
            </div>
          </div>

          {duplicates.length > 0 && (
            <div className="mx-4 mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-yellow-700 text-xs font-medium uppercase tracking-wide">Ya existe en la tienda</p>
              {duplicates.map((d) => (
                <div key={d.id} className="mt-2 rounded-md bg-white/70 border border-yellow-100 px-2 py-1.5">
                  <p className="text-gray-700 text-xs break-words [overflow-wrap:anywhere] whitespace-normal">— {d.title || d.artist} · Stock: {d.stock}</p>
                  <p className="text-[11px] text-gray-600 mt-1 break-words [overflow-wrap:anywhere] whitespace-normal">
                    Estado: {getDuplicateConditionReference(d)} · Edición: {d.year || "Sin dato"} · País: {d.country || "Sin dato"} · Valor: {formatDuplicatePrice(d.price)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleAddDuplicateStock(d)}
                    disabled={saving || loadingProductId !== null}
                    className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    {inventoryContext ? "Contar y volver al inventario" : saving ? "Agregando..." : "Agregar stock (+1)"}
                  </button>
                  {!inventoryContext && <button
                    type="button"
                    onClick={() => handleEditDuplicate(d)}
                    disabled={saving || loadingProductId !== null}
                    className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4 shrink-0" />
                    {inventoryContext ? "Usar producto existente" : loadingProductId === d.id ? "Cargando..." : "Agregar y modificar"}
                  </button>}
                </div>
              ))}
            </div>
          )}

          {saveError && <p role="alert" className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}

          {/* ─── Detail view (release clicked) ─── */}
          {previewRelease ? (
            <div className="flex-1 w-full max-w-full overflow-y-auto overflow-x-hidden pb-32 [padding-bottom:calc(8rem+env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 min-w-0">
                <button onClick={() => setPreviewRelease(null)} className="text-gray-400 hover:text-gray-700 text-lg px-1">←</button>
                <span className="flex-1 min-w-0 text-sm text-gray-500 break-words [overflow-wrap:anywhere] whitespace-normal leading-snug">{previewRelease.title}</span>
              </div>

              {/* Image gallery */}
              <div className="px-4 pt-4 pb-2">
                {loadingDetail ? (
                  <div className="flex justify-center py-6">
                    <div className="w-7 h-7 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : releaseImages.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {releaseImages.map((img, i) => (
                      <button key={i} onClick={() => setLightboxImg(img)} className="flex-shrink-0">
                        <img src={img} alt="" className="h-28 w-28 rounded-lg object-cover border border-gray-200 hover:border-gray-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-28 bg-gray-200 rounded-xl text-gray-400 text-3xl">&#9679;</div>
                )}
              </div>

              <div className="px-4 pb-6 flex gap-2 min-w-0">
                <button onClick={() => setPreviewRelease(null)} className="flex-1 min-w-0 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm">
                  ← Volver
                </button>
                <button
                  onClick={() => { setPreviewRelease(null); handleSelectRelease(previewRelease); }}
                  className="flex-1 min-w-0 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg text-sm"
                >
                  Elegir esta versión
                </button>
              </div>
            </div>
          ) : searchingDiscogs ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border border-gray-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">Buscando en Discogs...</p>
            </div>
          ) : discogsError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
              <div className="text-4xl">🔍</div>
              <p className="text-gray-500 text-center text-sm">{discogsError}</p>
              <button onClick={handleSkipDiscogs} className="py-2.5 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium">
                Continuar sin datos de Discogs
              </button>
              <button onClick={handleRetry} className="py-2 px-6 text-gray-400 hover:text-gray-600 text-sm">
                Intentar nuevamente
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Format filter chips */}
              {(() => {
                const allFormats = Array.from(new Set(discogsResults.map(r => r.format?.[0] || "Otros"))) as string[];
                if (allFormats.length < 2) return null;
                const maxOffset = Math.max(0, allFormats.length - 3);
                const safeOffset = Math.min(formatFilterOffset, maxOffset);
                const visibleFormats = allFormats.slice(safeOffset, safeOffset + 3);
                return (
                  <div
                    ref={formatFilterScrollRef}
                    className="flex items-center gap-1 flex-shrink-0 min-w-0 pl-2 pr-1 pt-3 pb-2"
                    onTouchStart={e => { formatTouchStateRef.current.active = true; formatTouchStateRef.current.startX = e.touches[0].clientX; formatTouchStateRef.current.startY = e.touches[0].clientY; }}
                    onTouchEnd={e => {
                      formatTouchStateRef.current.active = false;
                      const dx = e.changedTouches[0].clientX - formatTouchStateRef.current.startX;
                      const dy = e.changedTouches[0].clientY - formatTouchStateRef.current.startY;
                      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                        const direction: 1 | -1 = dx < 0 ? 1 : -1;
                        setFormatSlideDirection(direction);
                        setFormatFilterOffset(prev => direction === 1 ? Math.min(prev + 1, maxOffset) : Math.max(prev - 1, 0));
                      }
                    }}
                  >
                    {safeOffset > 0 && (
                      <button type="button" onClick={() => { setFormatSlideDirection(-1); setFormatFilterOffset(prev => Math.max(prev - 1, 0)); }} className="flex-shrink-0 w-7 h-7 rounded-full border border-gray-200 bg-white text-gray-500 text-sm shadow-sm active:bg-gray-100 flex items-center justify-center" aria-label="Atrás formatos">‹</button>
                    )}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div ref={formatChipTrackRef} className="flex gap-2 will-change-transform">
                      <button
                        onClick={() => setFormatFilter("")}
                        className={`flex-shrink-0 px-3 py-1 rounded-full text-xs border transition-all ${
                          formatFilter === "" ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-gray-200 text-gray-500"
                        }`}
                      >
                        Todos
                      </button>
                      {visibleFormats.map((f) => (
                        <button
                          key={f}
                          onClick={() => setFormatFilter(f === formatFilter ? "" : f)}
                          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs border transition-all ${
                            formatFilter === f ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-gray-200 text-gray-500"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                      </div>
                    </div>
                    {allFormats.length > 3 && (
                      <button
                        type="button"
                        onClick={() => { setFormatSlideDirection(1); setFormatFilterOffset((prev) => (prev >= maxOffset ? 0 : prev + 1)); }}
                        className="flex-shrink-0 w-7 h-7 rounded-full border border-gray-200 bg-white text-gray-500 text-sm shadow-sm active:bg-gray-100 flex items-center justify-center"
                        aria-label="Desplazar formatos a la derecha"
                      >
                        ›
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Country filter chips */}
              {(() => {
                const allCountries = Array.from(new Set(discogsResults.map(r => r.country).filter(Boolean))) as string[];
                if (allCountries.length < 2) return null;
                const maxOffset = Math.max(0, allCountries.length - 3);
                const safeOffset = Math.min(countryFilterOffset, maxOffset);
                const visibleCountries = allCountries.slice(safeOffset, safeOffset + 3);
                return (
                  <div
                    ref={countryFilterScrollRef}
                    className="flex items-center gap-1 flex-shrink-0 min-w-0 pl-2 pr-1 pt-1 pb-2"
                    onTouchStart={e => { countryTouchStateRef.current.active = true; countryTouchStateRef.current.startX = e.touches[0].clientX; countryTouchStateRef.current.startY = e.touches[0].clientY; }}
                    onTouchEnd={e => {
                      countryTouchStateRef.current.active = false;
                      const dx = e.changedTouches[0].clientX - countryTouchStateRef.current.startX;
                      const dy = e.changedTouches[0].clientY - countryTouchStateRef.current.startY;
                      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                        const direction: 1 | -1 = dx < 0 ? 1 : -1;
                        setCountrySlideDirection(direction);
                        setCountryFilterOffset(prev => direction === 1 ? Math.min(prev + 1, maxOffset) : Math.max(prev - 1, 0));
                      }
                    }}
                  >
                    {safeOffset > 0 && (
                      <button type="button" onClick={() => { setCountrySlideDirection(-1); setCountryFilterOffset(prev => Math.max(prev - 1, 0)); }} className="flex-shrink-0 w-7 h-7 rounded-full border border-gray-200 bg-white text-gray-500 text-sm shadow-sm active:bg-gray-100 flex items-center justify-center" aria-label="Atrás países">‹</button>
                    )}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div ref={countryChipTrackRef} className="flex gap-2 will-change-transform">
                        <button
                          onClick={() => setCountryFilter("")}
                          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs border transition-all ${
                            countryFilter === "" ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-gray-200 text-gray-500"
                          }`}
                        >
                          Todos
                        </button>
                        {visibleCountries.map(c => (
                          <button
                            key={c}
                            onClick={() => setCountryFilter(c === countryFilter ? "" : c)}
                            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs border transition-all ${
                              countryFilter === c ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-gray-200 text-gray-500"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    {allCountries.length > 3 && (
                      <button
                        type="button"
                        onClick={() => { setCountrySlideDirection(1); setCountryFilterOffset((prev) => (prev >= maxOffset ? 0 : prev + 1)); }}
                        className="flex-shrink-0 w-7 h-7 rounded-full border border-gray-200 bg-white text-gray-500 text-sm shadow-sm active:bg-gray-100 flex items-center justify-center"
                        aria-label="Desplazar países a la derecha"
                      >
                        ›
                      </button>
                    )}
                  </div>
                );
              })()}

              <p className="px-4 pt-2 pb-1 text-xs text-gray-500 flex-shrink-0">
                {discogsResults.filter(r => (!countryFilter || r.country === countryFilter) && (!formatFilter || (r.format?.[0] || "Otros") === formatFilter)).length} versión(es) — tocá para ver detalles
              </p>
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-200 bg-white pb-40 [padding-bottom:calc(10rem+env(safe-area-inset-bottom))]">
                {discogsResults
                  .filter(r => (!countryFilter || r.country === countryFilter) && (!formatFilter || (r.format?.[0] || "Otros") === formatFilter))
                  .map((r) => {
                    const { artist, album } = parseDiscogsTitle(r.title);
                    return (
                      <button
                        key={r.id}
                        onClick={() => handlePreviewRelease(r)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left active:bg-gray-100 transition-colors"
                      >
                        {r.thumb ? (
                          <img src={r.thumb} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-400 text-xl">&#9679;</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 break-words [overflow-wrap:anywhere] whitespace-normal leading-snug">{artist || r.title}</p>
                          {album && artist && <p className="text-xs text-gray-500 break-words [overflow-wrap:anywhere] whitespace-normal leading-snug">{album}</p>}
                          <div className="flex flex-wrap gap-x-3 mt-0.5">
                            {r.year && <span className="text-xs text-gray-500">{r.year}</span>}
                            {r.country && <span className="text-xs text-gray-500">{r.country}</span>}
                            {r.format?.[0] && <span className="text-xs text-gray-400">{r.format[0]}</span>}
                            {r.label?.[0] && <span className="text-xs text-gray-400 break-words [overflow-wrap:anywhere] whitespace-normal">{r.label[0]}</span>}
                          </div>
                        </div>
                        <span className="text-gray-300 text-lg flex-shrink-0">›</span>
                      </button>
                    );
                })}
              </div>
              <div className="px-4 pt-2 pb-4 flex-shrink-0">
                <button onClick={handleSkipDiscogs} className="w-full py-2.5 bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-lg text-xs border border-gray-200">
                  No encuentro mi versión — continuar sin datos
                </button>
                <button onClick={handleRetry} className="w-full py-2 text-gray-400 hover:text-gray-600 text-xs">
                  Intentar nuevamente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <img src={lightboxImg} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 text-white text-3xl">✕</button>
        </div>
      )}

      {successNotice.open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 shadow-2xl p-5 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-2xl font-bold">
              ✓
            </div>
            <p className="mt-3 text-gray-900 font-semibold text-base">{successNotice.message}</p>
            <button
              onClick={() => {
                setSuccessNotice({ open: false, message: "" });
                resetAll();
              }}
              className="mt-5 w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {cropModalOpen && cropSourcePhoto && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Recortar foto de cámara</p>
            <div className="text-xs text-gray-500">Opcional: ajusta encuadre antes de agregarla.</div>

            <div className="mx-auto w-72 h-72 bg-gray-100 rounded-lg overflow-hidden relative">
              {(() => {
                const previewGeometry = getSquareCropGeometry(
                  cropSourceSize.width,
                  cropSourceSize.height,
                  cropZoom,
                  cropX,
                  cropY,
                );
                return (
                  <img
                    src={cropSourcePhoto.previewUrl}
                    alt="Previsualización"
                    className="absolute max-w-none"
                    onLoad={(e) => setCropSourceSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
                    style={{
                      width: `${previewGeometry.renderedWidth}px`,
                      height: `${previewGeometry.renderedHeight}px`,
                      left: `${previewGeometry.left}px`,
                      top: `${previewGeometry.top}px`,
                    }}
                  />
                );
              })()}
              <div className="absolute inset-0 border-2 border-white/80 pointer-events-none" />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-600 block">Zoom</label>
              <input type="range" min={1} max={3} step={0.05} value={cropZoom} onChange={(e) => setCropZoom(Number(e.target.value))} className="w-full" />
              <label className="text-xs text-gray-600 block">Horizontal</label>
              <input type="range" min={0} max={100} step={1} value={cropX} onChange={(e) => setCropX(Number(e.target.value))} className="w-full" />
              <label className="text-xs text-gray-600 block">Vertical</label>
              <input type="range" min={0} max={100} step={1} value={cropY} onChange={(e) => setCropY(Number(e.target.value))} className="w-full" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={discardCameraPhoto} className="py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">Descartar</button>
              <button type="button" onClick={useOriginalCameraPhoto} className="py-2 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50">Usar original</button>
              <button type="button" onClick={applyCropToCameraPhoto} className="py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700">Aplicar recorte</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STEP 3: FORM ─────────────────────────────────────────────────── */}
      {step === "form" && (
        <div className="flex-1 overflow-y-auto">
          {selectedRelease && (
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
              {selectedRelease.thumb && (
                <img src={selectedRelease.thumb} alt="" className="w-12 h-12 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 break-words [overflow-wrap:anywhere] whitespace-normal leading-snug">
                  {parseDiscogsTitle(selectedRelease.title).artist || selectedRelease.title}
                </p>
                <p className="text-xs text-gray-500 break-words [overflow-wrap:anywhere] whitespace-normal leading-snug">
                  {parseDiscogsTitle(selectedRelease.title).album}{selectedRelease.year ? ` · ${selectedRelease.year}` : ""}{selectedRelease.country ? ` · ${selectedRelease.country}` : ""}
                </p>
              </div>
            </div>
          )}

          {duplicateAction === "edit" && editingProduct && (
            <div className="mx-4 mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
              <p className="text-sm font-semibold text-sky-900">Modificar producto y agregar stock</p>
              <p className="mt-1 break-words text-sm text-sky-800">{editingProduct.title}</p>
              <p className="mt-2 text-sm text-sky-900">Stock al guardar: <strong>{Math.max(0, Number(editingProduct.stock) || 0) + 1}</strong> (+1 unidad)</p>
            </div>
          )}
          {duplicates.length > 0 && duplicateAction === "ask" && (
            <div className="mx-4 mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
              <p className="text-yellow-700 text-xs font-medium uppercase tracking-wide">Este disco ya existe</p>
              <p className="text-gray-700 text-sm break-words [overflow-wrap:anywhere] whitespace-normal">"{duplicates[0].title || duplicates[0].artist}" · Stock actual: {duplicates[0].stock}</p>
              <p className="text-xs text-gray-600 break-words [overflow-wrap:anywhere] whitespace-normal">
                Estado: {getDuplicateConditionReference(duplicates[0])} · Edición: {duplicates[0].year || "Sin dato"} · País: {duplicates[0].country || "Sin dato"} · Valor referencia: {formatDuplicatePrice(duplicates[0].price)}
              </p>
              <div>
                <button onClick={() => handleAddDuplicateStock(duplicates[0])} disabled={saving || loadingProductId !== null} className="mb-2 w-full rounded-lg bg-slate-800 py-3 text-sm font-medium text-white disabled:opacity-50">
                  {inventoryContext ? "Contar y volver al inventario" : saving ? "Agregando..." : "Agregar stock (+1)"}
                </button>
                {!inventoryContext && <button onClick={() => handleEditDuplicate(duplicates[0])} disabled={saving || loadingProductId !== null} className="w-full rounded-lg border border-slate-300 bg-white py-3 text-sm font-medium text-slate-800 disabled:opacity-50">
                  {inventoryContext ? "Usar producto existente" : loadingProductId ? "Cargando..." : "Agregar y modificar"}
                </button>}
              </div>
            </div>
          )}

          {/* Manual entry fields — only when skipped Discogs */}
          {skippedDiscogs && (
            <div className="px-4 pt-4 pb-0 space-y-4 border-b border-gray-100 pb-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Datos del disco</p>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Título *</label>
                <input
                  type="text"
                  placeholder="Nombre del disco"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Artista</label>
                <input
                  type="text"
                  placeholder="Nombre del artista"
                  value={manualArtist}
                  onChange={(e) => setManualArtist(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-slate-700"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Año</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="2024"
                    value={manualYear}
                    onChange={(e) => setManualYear(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-slate-700"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Formato</label>
                  <select
                    value={manualFormat}
                    onChange={(e) => setManualFormat(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-slate-700"
                  >
                    <option value="">Elegir…</option>
                    <option value="CD">CD</option>
                    <option value="Cassette">Cassette</option>
                    <option value="Vinilo">Vinilo</option>
                    <option value='12"'>12"</option>
                    <option value="VHS">VHS</option>
                  </select>
                </div>
              </div>

              {/* Photo upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Fotos</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 py-3 bg-white border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Cámara
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex-1 py-3 bg-white border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Galería
                  </button>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      openCropModalWithCameraFile(files[0]);
                    }
                    e.target.value = "";
                  }} />
                <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addUploadedPhotos(e.target.files);
                    e.target.value = "";
                  }} />
                {uploadedPhotos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {uploadedPhotos.map((photo, i) => (
                      <div key={photo.id} className="relative flex-shrink-0">
                        <img src={photo.previewUrl} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
                        {i === 0 && (
                          <span className="absolute left-1 top-1 text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded">Principal</span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeUploadedPhoto(photo.id)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full text-xs flex items-center justify-center"
                        >×</button>
                        <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => moveUploadedPhoto(i, i - 1)}
                            disabled={i === 0}
                            className="w-5 h-5 bg-white/90 disabled:opacity-40 text-gray-700 rounded text-xs flex items-center justify-center"
                            aria-label="Mover a la izquierda"
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrimaryUploadedPhoto(i)}
                            disabled={i === 0}
                            className="w-5 h-5 bg-white/90 disabled:opacity-40 text-gray-700 rounded text-[10px] flex items-center justify-center"
                            aria-label="Marcar principal"
                          >
                            ★
                          </button>
                          <button
                            type="button"
                            onClick={() => moveUploadedPhoto(i, i + 1)}
                            disabled={i === uploadedPhotos.length - 1}
                            className="w-5 h-5 bg-white/90 disabled:opacity-40 text-gray-700 rounded text-xs flex items-center justify-center"
                            aria-label="Mover a la derecha"
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {duplicateAction !== "stock" && (
            <div className="px-4 py-4 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Precio *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-4 py-3 text-gray-900 text-lg focus:outline-none focus:border-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">País</label>
                <input
                  type="text"
                  placeholder="Ej: Argentina, UK, US"
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Condición *</label>
                <div className="flex gap-2">
                  {[
                    { value: "new", label: "Nuevo", color: "bg-slate-800 border-slate-700" },
                    { value: "used", label: "Usado", color: "bg-slate-800 border-slate-700" },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setForm((f) => ({ ...f, condition: opt.value, mediaGrade: "", sleeveGrade: "" }))}
                      className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-all ${
                        form.condition === opt.value ? opt.color + " text-white" : "bg-white border-gray-200 text-gray-500"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.condition === "used" && (
                <div className="space-y-4 bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Escala Goldmine</p>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-700">Disco (Media) *</label>
                    <div className="flex flex-wrap gap-2">
                      {GOLDMINE_GRADES.map((g) => (
                        <button
                          type="button"
                          key={g}
                          onClick={() => setForm((f) => ({ ...f, mediaGrade: g }))}
                          className={`px-3 py-1.5 rounded-lg text-sm font-mono font-bold border transition-all ${
                            form.mediaGrade === g ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-gray-200 text-gray-500"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-700">Funda (Sleeve) *</label>
                    <div className="flex flex-wrap gap-2">
                      {GOLDMINE_GRADES.map((g) => (
                        <button
                          type="button"
                          key={g}
                          onClick={() => setForm((f) => ({ ...f, sleeveGrade: g }))}
                          className={`px-3 py-1.5 rounded-lg text-sm font-mono font-bold border transition-all ${
                            form.sleeveGrade === g ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-gray-200 text-gray-500"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Categoría *</label>
                {categories.length === 0 ? (
                  <p className="text-xs text-gray-500">No hay categorías activas en tu tienda.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setForm((f) => ({ ...f, categoryId: cat.category?.id || cat.id }))}
                        className={`px-3 py-2 rounded-lg text-sm border transition-all ${
                          form.categoryId === (cat.category?.id || cat.id)
                            ? "bg-slate-800 border-slate-700 text-white font-medium"
                            : "bg-white border-gray-200 text-gray-500"
                        }`}
                      >
                        {cat.category?.name || cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {saveError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {saveError}
                </p>
              )}
            </div>
          )}

          {duplicateAction === "stock" && (
            <div className="px-4 py-6 text-center space-y-3">
              <p className="text-gray-700 text-sm">Se sumará <strong>+1</strong> al stock de:</p>
              <p className="text-gray-900 font-semibold break-words [overflow-wrap:anywhere] whitespace-normal">{duplicates[0]?.title || duplicates[0]?.artist}</p>
              <p className="text-gray-500 text-sm">Stock actual: {duplicates[0]?.stock} → {(duplicates[0]?.stock || 0) + 1}</p>
            </div>
          )}

          <div className="px-4 pb-8 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ touchAction: 'manipulation' }}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-semibold rounded-lg text-base transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : duplicateAction === "edit" ? (
                "Guardar cambios y agregar stock (+1)"
              ) : duplicateAction === "stock" ? (
                "Actualizar stock"
              ) : (
                inventoryContext ? "Guardar y volver al inventario" : "Crear producto"
              )}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scanLine {
          0% { top: 33%; }
          50% { top: 66%; }
          100% { top: 33%; }
        }
        .animate-scan-line {
          animation: scanLine 2s ease-in-out infinite;
          position: absolute;
          left: 12.5%;
          right: 12.5%;
        }
      `}</style>
    </div>
  );
}
