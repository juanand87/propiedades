"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Upload, 
  Folder, 
  FolderPlus, 
  Image as ImageIcon, 
  FileText, 
  FileSpreadsheet,
  X, 
  ChevronRight,
  Home,
  Trash2,
  Check,
  Copy,
  ExternalLink,
  Calendar,
  HardDrive,
} from "lucide-react";
import { api } from "@/lib/api";

interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  folderId: string | null;
  createdAt: string;
}

interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  vendorId: string;
  createdAt: string;
}

interface MediaLibraryProps {
  vendorId: string;
  onSelect?: (file: MediaFile) => void;
  mode?: "select" | "manage"; // select para insertar, manage para administrar
  accept?: string; // tipos de archivo aceptados
  selectedUrls?: string[]; // URLs ya seleccionadas (para modo multi-select)
}

export default function MediaLibrary({ 
  vendorId, 
  onSelect, 
  mode = "select",
  accept = "image/*",
  selectedUrls = [],
}: MediaLibraryProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    loadMedia();
  }, [currentFolderId, vendorId]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const [filesData, foldersData] = await Promise.all([
        api.getMediaFiles(vendorId, currentFolderId),
        api.getMediaFolders(vendorId, currentFolderId)
      ]);
      setFiles(filesData);
      setFolders(foldersData);
    } catch (error) {
      console.error("Error loading media:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    try {
      setUploading(true);
      const formData = new FormData();
      
      Array.from(fileList).forEach((file) => {
        formData.append("files", file);
      });
      
      if (currentFolderId) {
        formData.append("folderId", currentFolderId);
      }

      await api.uploadMediaFiles(vendorId, formData);
      await loadMedia();
      e.target.value = ""; // Reset input
    } catch (error) {
      console.error("Error uploading files:", error);
      alert("Error al subir archivos");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await api.createMediaFolder(vendorId, {
        name: newFolderName,
        parentId: currentFolderId
      });
      setNewFolderName("");
      setCreatingFolder(false);
      await loadMedia();
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Error al crear carpeta");
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;

    try {
      await api.deleteMediaFile(vendorId, fileId);
      await loadMedia();
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Error al eliminar archivo");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("¿Eliminar esta carpeta y todo su contenido?")) return;

    try {
      await api.deleteMediaFolder(vendorId, folderId);
      await loadMedia();
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Error al eliminar carpeta");
    }
  };

  const handleSelectFile = (file: MediaFile) => {
    if (mode === "select" && onSelect) {
      onSelect({ ...file, url: getFileUrl(file.url) });
    } else {
      setSelectedFile((prev) => prev?.id === file.id ? null : file);
      setCopiedUrl(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  };

  const getBreadcrumbs = () => {
    // TODO: Implementar breadcrumbs completos
    return currentFolderId ? [{ id: currentFolderId, name: "Carpeta" }] : [];
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const isImage = (mimeType: string) => mimeType.startsWith("image/");
  const isVideo = (mimeType: string) => mimeType.startsWith("video/");
  const isPdf = (mimeType: string) => mimeType === "application/pdf";
  const isExcel = (mimeType: string) =>
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "text/csv";

  const getFileIcon = (mimeType: string) => {
    if (isPdf(mimeType)) return <div className="w-full h-24 bg-red-50 rounded mb-2 flex flex-col items-center justify-center gap-1"><FileText className="w-10 h-10 text-red-500" /><span className="text-xs font-bold text-red-600">PDF</span></div>;
    if (isExcel(mimeType)) return <div className="w-full h-24 bg-green-50 rounded mb-2 flex flex-col items-center justify-center gap-1"><FileSpreadsheet className="w-10 h-10 text-green-600" /><span className="text-xs font-bold text-green-700">EXCEL</span></div>;
    if (isVideo(mimeType)) return <div className="w-full h-24 bg-blue-50 rounded mb-2 flex items-center justify-center"><span className="text-4xl">🎬</span></div>;
    return <div className="w-full h-24 bg-gray-100 rounded mb-2 flex items-center justify-center"><FileText className="w-8 h-8 text-gray-400" /></div>;
  };

  const getFileUrl = (url: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const baseUrl = API_URL.replace('/api', '');
    return url.startsWith('http') ? url : `${baseUrl}${url}`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Biblioteca Multimedia</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreatingFolder(true)}
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              Nueva Carpeta
            </Button>
            <label>
              <Button size="sm" disabled={uploading} asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? "Subiendo..." : "Subir Archivos"}
                </span>
              </Button>
              <input
                type="file"
                multiple
                accept={accept}
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
          <button
            onClick={() => setCurrentFolderId(null)}
            className="flex items-center hover:text-purple-600 transition-colors"
          >
            <Home className="w-4 h-4 mr-1" />
            Inicio
          </button>
          {getBreadcrumbs().map((crumb) => (
            <div key={crumb.id} className="flex items-center">
              <ChevronRight className="w-4 h-4 mx-1" />
              <span>{crumb.name}</span>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Modal para crear carpeta */}
        {creatingFolder && (
          <div className="mb-4 p-4 border border-purple-300 rounded-lg bg-purple-50">
            <div className="flex gap-2">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nombre de la carpeta"
                onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
                autoFocus
              />
              <Button onClick={handleCreateFolder} size="sm">
                <Check className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => {
                  setCreatingFolder(false);
                  setNewFolderName("");
                }}
                size="sm"
                variant="outline"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Carpetas */}
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="relative group border rounded-lg p-4 hover:border-purple-400 cursor-pointer transition-colors"
              >
                <div
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="flex flex-col items-center"
                >
                  <Folder className="w-12 h-12 text-yellow-500 mb-2" />
                  <p className="text-sm text-center font-medium truncate w-full">
                    {folder.name}
                  </p>
                </div>
                {mode === "manage" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder.id);
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Archivos */}
            {files.map((file) => {
              const fileFullUrl = getFileUrl(file.url);
              const isPending = selectedUrls.includes(fileFullUrl);
              return (
              <div
                key={file.id}
                onClick={() => handleSelectFile(file)}
                className={`relative group border-2 rounded-lg p-2 hover:border-purple-400 cursor-pointer transition-all ${
                  isPending ? "border-green-500 ring-2 ring-green-200" :
                  selectedFile?.id === file.id ? "border-purple-600 ring-2 ring-purple-200" : "border-transparent"
                }`}
              >
                {/* Checkmark overlay cuando está seleccionada */}
                {isPending && (
                  <div className="absolute top-1 left-1 z-10 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {isImage(file.mimeType) ? (
                  <img
                    src={fileFullUrl}
                    alt={file.originalName}
                    className="w-full h-24 object-cover rounded mb-2"
                  />
                ) : getFileIcon(file.mimeType)}
                <p className="text-xs text-center font-medium truncate">
                  {file.originalName}
                </p>
                <p className="text-xs text-center text-gray-500">
                  {formatFileSize(file.size)}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file.id);
                  }}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Eliminar archivo"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              );
            })}

            {folders.length === 0 && files.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay archivos en esta carpeta</p>
                <p className="text-sm">Sube archivos o crea una carpeta</p>
              </div>
            )}
          </div>
        )}

        {/* Panel de detalle del archivo seleccionado */}
        {selectedFile && (() => {
          const fileUrl = getFileUrl(selectedFile.url);
          return (
            <div className="mt-6 p-4 border border-purple-200 rounded-xl bg-purple-50">
              <div className="flex items-start gap-4">
                {/* Prévia */}
                <div className="flex-shrink-0">
                  {isImage(selectedFile.mimeType) ? (
                    <img src={fileUrl} alt={selectedFile.originalName} className="w-20 h-20 object-cover rounded-lg shadow" />
                  ) : isPdf(selectedFile.mimeType) ? (
                    <div className="w-20 h-20 bg-red-100 rounded-lg flex flex-col items-center justify-center shadow"><FileText className="w-10 h-10 text-red-500" /><span className="text-xs font-bold text-red-600 mt-1">PDF</span></div>
                  ) : isExcel(selectedFile.mimeType) ? (
                    <div className="w-20 h-20 bg-green-100 rounded-lg flex flex-col items-center justify-center shadow"><FileSpreadsheet className="w-10 h-10 text-green-600" /><span className="text-xs font-bold text-green-700 mt-1">EXCEL</span></div>
                  ) : isVideo(selectedFile.mimeType) ? (
                    <div className="w-20 h-20 bg-blue-100 rounded-lg flex items-center justify-center shadow"><span className="text-4xl">🎬</span></div>
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center shadow"><FileText className="w-10 h-10 text-gray-400" /></div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 truncate pr-2">{selectedFile.originalName}</h3>
                    <button onClick={() => { setSelectedFile(null); setCopiedUrl(false); }} className="flex-shrink-0 p-1 hover:bg-purple-200 rounded"><X className="w-4 h-4 text-gray-500" /></button>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
                    <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" />{formatFileSize(selectedFile.size)}</span>
                    <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{selectedFile.mimeType}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(selectedFile.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  </div>

                  {/* URL copiable */}
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={fileUrl}
                      className="flex-1 text-xs bg-white border border-gray-300 rounded px-2 py-1.5 font-mono truncate focus:outline-none focus:border-purple-400"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => handleCopyUrl(fileUrl)}
                      className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        copiedUrl ? 'bg-green-500 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      <Copy className="w-3 h-3" />
                      {copiedUrl ? '¡Copiado!' : 'Copiar'}
                    </button>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Abrir
                    </a>
                  </div>
                </div>
              </div>

              {/* Botón Insertar solo en modo select */}
              {mode === "select" && onSelect && (
                <div className="mt-3 pt-3 border-t border-purple-200 flex justify-end">
                  <Button onClick={() => onSelect({ ...selectedFile, url: fileUrl })}>Insertar</Button>
                </div>
              )}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
