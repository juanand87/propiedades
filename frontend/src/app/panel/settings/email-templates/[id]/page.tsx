'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  key: string;
  subject: string;
  body: string;
  description: string;
  variables: string[];
  isActive: boolean;
}

export default function EmailTemplateEditorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [viewMode, setViewMode] = useState<'code' | 'preview' | 'split'>('code');
  
  // Form fields
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadTemplate();
  }, [id]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Force no cache
      const timestamp = new Date().getTime();
      const data = await api.get(`/email-templates/${id}?_t=${timestamp}`);
      
      console.log('[EmailTemplateEditor] Template loaded:', data);
      
      setTemplate(data);
      setSubject(data.subject);
      setBody(data.body);
      setDescription(data.description || '');
      setIsActive(data.isActive);
    } catch (err: any) {
      console.error('Error loading template:', err);
      setError(err.message || 'Error al cargar la plantilla');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      console.log('[EmailTemplateEditor] Saving template:', id);
      console.log('[EmailTemplateEditor] Subject:', subject);
      console.log('[EmailTemplateEditor] Description:', description);
      
      const result = await api.patch(`/email-templates/${id}`, {
        subject,
        body,
        description,
        isActive,
      });
      
      console.log('[EmailTemplateEditor] Save result:', result);
      
      alert('Plantilla guardada exitosamente ✅');
      
      // Recargar la plantilla para ver los cambios guardados
      await loadTemplate();
    } catch (err: any) {
      console.error('Error saving template:', err);
      setError(err.message || 'Error al guardar la plantilla');
      alert('Error al guardar: ' + (err.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    try {
      // Create sample data based on template variables
      const sampleData: Record<string, any> = {};
      
      if (template?.variables) {
        template.variables.forEach((variable: string) => {
          // Generate sample data for each variable
          switch (variable) {
            case 'customerName':
              sampleData[variable] = 'Juan Pérez';
              break;
            case 'customerEmail':
              sampleData[variable] = 'juan@ejemplo.com';
              break;
            case 'tempPassword':
              sampleData[variable] = 'ABC123XYZ7';
              break;
            case 'orderNumber':
              sampleData[variable] = 'ORD-20251226-1234';
              break;
            case 'orderTotal':
              sampleData[variable] = '$15.990';
              break;
            case 'orderDate':
              sampleData[variable] = '26 de diciembre, 2025';
              break;
            case 'trackingNumber':
              sampleData[variable] = '987654321';
              break;
            case 'trackingUrl':
              sampleData[variable] = 'https://tracking.example.com/987654321';
              break;
            case 'estimatedDelivery':
              sampleData[variable] = '30 de diciembre, 2025';
              break;
            case 'vendorName':
              sampleData[variable] = 'CdMania';
              break;
            case 'productName':
              sampleData[variable] = 'The Dark Side of the Moon - Pink Floyd';
              break;
            case 'productPrice':
              sampleData[variable] = '$12.990';
              break;
            case 'productUrl':
              sampleData[variable] = 'http://localhost:3000/tiendas/cdmania/producto/123';
              break;
            case 'resetLink':
              sampleData[variable] = 'http://localhost:3000/reset-password?token=abc123';
              break;
            case 'dashboardUrl':
              sampleData[variable] = 'http://localhost:3000/dashboard/orders';
              break;
            case 'loginUrl':
              sampleData[variable] = 'http://localhost:3000/login';
              break;
            case 'currentYear':
              sampleData[variable] = new Date().getFullYear().toString();
              break;
            case 'marketplaceName':
              sampleData[variable] = 'MundoBeat';
              break;
            default:
              sampleData[variable] = `[${variable}]`;
          }
        });
      }

      const response = await api.post(`/email-templates/${id}/preview`, {
        sampleData,
      });
      
      setPreviewHtml(response.html);
      setShowPreview(true);
    } catch (err: any) {
      console.error('Error generating preview:', err);
      alert('Error al generar vista previa');
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('body-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = body;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    
    setBody(before + `{{${variable}}}` + after);
    
    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4;
    }, 0);
  };

  const insertHtmlTag = (tag: string, isBlock: boolean = false) => {
    const textarea = document.getElementById('body-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = body;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    
    let insertion = '';
    if (selectedText) {
      insertion = `<${tag}>${selectedText}</${tag}>`;
    } else {
      insertion = isBlock ? `<${tag}>\n  \n</${tag}>` : `<${tag}></${tag}>`;
    }
    
    setBody(before + insertion + after);
    
    // Set cursor position
    setTimeout(() => {
      textarea.focus();
      const newPos = start + tag.length + 2 + (selectedText ? selectedText.length : (isBlock ? 3 : 0));
      textarea.selectionStart = textarea.selectionEnd = newPos;
    }, 0);
  };

  const getPreviewHtml = () => {
    // Generate sample data for live preview
    const sampleData: Record<string, any> = {
      customerName: 'Juan Pérez',
      customerEmail: 'juan@ejemplo.com',
      tempPassword: 'ABC123XYZ',
      orderNumber: 'ORD-2026-1234',
      orderTotal: '$45.990',
      orderDate: '19 de enero de 2026',
      vendorName: 'MundoBeat',
      storeName: 'MundoBeat',
      marketplaceName: 'MundoBeat',
      year: '2026',
      currentYear: '2026',
      productName: 'Vinyl Edition Album',
      trackingNumber: 'TRACK123456',
      shippingAddress: 'Av. Principal 123\nSantiago, Región Metropolitana',
    };

    let html = body;
    Object.keys(sampleData).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, sampleData[key]);
    });
    
    return html;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Plantilla no encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Editar Plantilla</h1>
          <p className="text-gray-600 mt-2">{template.name}</p>
          <p className="text-sm text-gray-500 mt-1">Clave: {template.key}</p>
        </div>
        <button
          onClick={() => router.push('/panel/settings/email-templates')}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Volver
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subject */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asunto
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Asunto del correo"
            />
          </div>

          {/* Description */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Descripción interna de la plantilla"
            />
          </div>

          {/* Body */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Cuerpo del Email (HTML)
              </label>
              
              {/* View Mode Tabs */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('code')}
                  className={`px-3 py-1 text-sm rounded ${
                    viewMode === 'code'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Código
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-3 py-1 text-sm rounded ${
                    viewMode === 'preview'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Vista Previa
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1 text-sm rounded ${
                    viewMode === 'split'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Dividido
                </button>
              </div>
            </div>

            {/* HTML Formatting Toolbar */}
            {(viewMode === 'code' || viewMode === 'split') && (
              <div className="mb-3 flex flex-wrap gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <button
                  onClick={() => insertHtmlTag('strong')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Negrita"
                >
                  <strong>B</strong>
                </button>
                <button
                  onClick={() => insertHtmlTag('em')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Cursiva"
                >
                  <em>I</em>
                </button>
                <button
                  onClick={() => insertHtmlTag('u')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Subrayado"
                >
                  <u>U</u>
                </button>
                <div className="w-px bg-gray-300"></div>
                <button
                  onClick={() => insertHtmlTag('h1', true)}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Título 1"
                >
                  H1
                </button>
                <button
                  onClick={() => insertHtmlTag('h2', true)}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Título 2"
                >
                  H2
                </button>
                <button
                  onClick={() => insertHtmlTag('h3', true)}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Título 3"
                >
                  H3
                </button>
                <div className="w-px bg-gray-300"></div>
                <button
                  onClick={() => insertHtmlTag('p', true)}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Párrafo"
                >
                  P
                </button>
                <button
                  onClick={() => insertHtmlTag('div', true)}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Div"
                >
                  DIV
                </button>
                <button
                  onClick={() => insertHtmlTag('span')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Span"
                >
                  SPAN
                </button>
                <div className="w-px bg-gray-300"></div>
                <button
                  onClick={() => insertHtmlTag('a')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Enlace"
                >
                  🔗 A
                </button>
                <button
                  onClick={() => setBody(body + '\n<br>\n')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Salto de línea"
                >
                  BR
                </button>
              </div>
            )}

            {/* Editor Views */}
            <div className={`${viewMode === 'split' ? 'grid grid-cols-2 gap-4' : ''}`}>
              {/* Code Editor */}
              {(viewMode === 'code' || viewMode === 'split') && (
                <div>
                  <textarea
                    id="body-textarea"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={viewMode === 'split' ? 25 : 20}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                    placeholder="<html>...</html>"
                  />
                </div>
              )}

              {/* Live Preview */}
              {(viewMode === 'preview' || viewMode === 'split') && (
                <div 
                  className={`border border-gray-300 rounded-lg p-4 bg-white overflow-auto ${
                    viewMode === 'split' ? 'h-[640px]' : 'min-h-[500px]'
                  }`}
                  style={{ maxHeight: viewMode === 'split' ? '640px' : 'none' }}
                >
                  <div dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Usa variables con doble llave: {"{{variableName}}"} · Los botones HTML son seguros para correos
            </p>
          </div>

          {/* Active Toggle */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Plantilla activa
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-2">
              Las plantillas inactivas no se enviarán automáticamente
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            <button
              onClick={() => {
                loadTemplate();
                alert('Plantilla recargada desde la base de datos');
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              🔄 Recargar
            </button>
            <button
              onClick={handlePreview}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Vista Previa
            </button>
          </div>
        </div>

        {/* Sidebar - Variables */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Variables Disponibles
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Haz clic en una variable para insertarla en el cuerpo
            </p>
            <div className="space-y-2">
              {template.variables && template.variables.length > 0 ? (
                template.variables.map((variable: string) => (
                  <button
                    key={variable}
                    onClick={() => insertVariable(variable)}
                    className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-purple-50 hover:text-purple-700 rounded border border-gray-200 hover:border-purple-300 transition-colors"
                  >
                    {'{{'}{variable}{'}}'}
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500">No hay variables definidas</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Vista Previa</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
