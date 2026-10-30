'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  key: string;
  subject: string;
  description: string;
  isActive: boolean;
  updatedAt: string;
}

const categoryLabels: Record<string, string> = {
  system: 'Sistema',
  orders_marketplace: 'Pedidos Marketplace',
  orders_vendor: 'Pedidos Tienda',
  products: 'Productos',
  base: 'Base',
};

const categoryColors: Record<string, string> = {
  system: 'bg-purple-100 text-purple-800',
  orders_marketplace: 'bg-green-100 text-green-800',
  orders_vendor: 'bg-blue-100 text-blue-800',
  products: 'bg-orange-100 text-orange-800',
  base: 'bg-gray-100 text-gray-800',
};

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('');

  useEffect(() => {
    loadTemplates();
  }, [filterCategory]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const url = filterCategory 
        ? `/email-templates?category=${filterCategory}`
        : '/email-templates';
      
      const response = await api.get(url);
      setTemplates(response || []);
    } catch (err: any) {
      console.error('Error loading templates:', err);
      setError(err.message || 'Error al cargar las plantillas');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      await api.patch(`/email-templates/${id}`, { isActive: !currentActive });
      await loadTemplates();
    } catch (err: any) {
      console.error('Error toggling template:', err);
      alert('Error al cambiar el estado de la plantilla');
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/panel/settings/email-templates/${id}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Plantillas de Email</h1>
        <p className="text-gray-600 mt-2">
          Administra las plantillas de correo electrónico del marketplace
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filtrar por categoría
        </label>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">Todas las categorías</option>
          <option value="system">Sistema</option>
          <option value="orders_marketplace">Pedidos Marketplace</option>
          <option value="orders_vendor">Pedidos Tienda</option>
          <option value="products">Productos</option>
          <option value="base">Base</option>
        </select>
      </div>

      {/* Templates Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Categoría
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Última modificación
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No se encontraron plantillas
                </td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {template.name}
                    </div>
                    <div className="text-xs text-gray-500">{template.key}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        categoryColors[template.category] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {categoryLabels[template.category] || template.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => toggleActive(template.id, template.isActive)}
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        template.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {template.isActive ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(template.updatedAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right sticky right-0 bg-white">
                    <button
                      onClick={() => handleEdit(template.id)}
                      className="text-purple-600 hover:text-purple-900 font-medium text-sm"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
