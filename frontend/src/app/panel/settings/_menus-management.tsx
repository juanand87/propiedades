'use client';

// Menus Management Component - v1.0.1
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface MenuItem {
  id: string | number;
  label: string;
  linkType: 'custom' | 'category' | 'genre' | 'page' | 'condition' | 'offers';
  customUrl?: string;
  categoryId?: string;
  genreId?: string;
  genreSlug?: string;
  pageId?: string;
  condition?: string;
  openInNewTab?: boolean;
}

interface MenuConfig {
  id: string;
  name: string;
  isFixed: boolean;
  description: string;
  icon: string;
  items: MenuItem[];
}

interface MenusManagementProps {
  vendorId: string;
}

function SortableMenuItem({ item, onEdit, onDelete, getDescription }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="w-5 h-5" />
        </button>
        
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{item.label}</div>
          <div className="text-sm text-gray-500">{getDescription(item)}</div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MenusManagement({ vendorId }: MenusManagementProps) {
  const [loading, setLoading] = useState(false);
  const [activeMenu, setActiveMenu] = useState('principal');
  const [stickyHeader, setStickyHeader] = useState(true);
  const [currentHeaderConfig, setCurrentHeaderConfig] = useState<any>({});
  const [lateralMenuConfig, setLateralMenuConfig] = useState<any>({});
  const [menus, setMenus] = useState<MenuConfig[]>([
    { id: 'principal', name: 'Menú Principal', isFixed: true, description: 'Aparece en el header', icon: '🏠', items: [] },
    { id: 'secundario', name: 'Menú Secundario', isFixed: true, description: 'Barra superior', icon: '⭐', items: [] },
    { id: 'lateral', name: 'Menú Lateral', isFixed: true, description: 'Panel lateral', icon: '📋', items: [] },
    { id: 'footer', name: 'Menú Footer', isFixed: true, description: 'Pie de página', icon: '⬇️', items: [] },
  ]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [newMenuName, setNewMenuName] = useState('');
  const [showNewMenuModal, setShowNewMenuModal] = useState(false);
  const [showBulkGenreModal, setShowBulkGenreModal] = useState(false);
  const [selectedBulkGenres, setSelectedBulkGenres] = useState<Set<string>>(new Set());
  const [bulkGenreSearch, setBulkGenreSearch] = useState('');

  const normalizeLateralConfig = (raw: any = {}) => ({
    enabled: raw?.enabled ?? true,
    position: raw?.position ?? 'left',
    visibility: {
      mode: raw?.visibility?.mode ?? 'specific',
      showInHome: raw?.visibility?.showInHome ?? true,
      showInProductDetail: raw?.visibility?.showInProductDetail ?? true,
      customPages: {
        mode: raw?.visibility?.customPages?.mode ?? 'all',
        selected: raw?.visibility?.customPages?.selected ?? [],
      },
      categories: {
        mode: raw?.visibility?.categories?.mode ?? 'all',
        selected: raw?.visibility?.categories?.selected ?? [],
      },
      genres: {
        mode: raw?.visibility?.genres?.mode ?? 'all',
        selected: raw?.visibility?.genres?.selected ?? [],
      },
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!vendorId) return;
    loadMenus();
    loadCategories();
    loadGenres();
    loadPages();
  }, [vendorId]);

  // Mantener ref actualizada con los géneros cargados para usarla en loadMenus
  const genresRef = useRef<any[]>([]);
  const menusLoadedRef = useRef(false);
  useEffect(() => {
    genresRef.current = genres;
    // Solo parchear slugs si los menús ya fueron cargados y hay géneros disponibles
    if (!menusLoadedRef.current || genres.length === 0) return;
    setMenus(prev => {
      const needsPatch = prev.some(menu =>
        menu.items.some((item: any) => item.linkType === 'genre' && item.genreId && !item.genreSlug)
      );
      if (!needsPatch) return prev;
      return prev.map(menu => ({
        ...menu,
        items: menu.items.map((item: any) => {
          if (item.linkType === 'genre' && item.genreId && !item.genreSlug) {
            const genre = genres.find((g: any) => String(g.id) === String(item.genreId));
            if (genre?.slug) return { ...item, genreSlug: genre.slug };
          }
          return item;
        }),
      }));
    });
  }, [genres]);

  const loadMenus = async () => {
    try {
      console.log('📥 Cargando menús para vendorId:', vendorId);
      const data = await api.getVendorSettings(vendorId);
      console.log('📊 Datos recibidos del servidor:', data);

      // Función para parchear genreSlug usando géneros ya cargados
      const patchGenreSlug = (items: any[]) => items.map((item: any) => {
        if (item.linkType === 'genre' && item.genreId && !item.genreSlug) {
          const genre = genresRef.current.find((g: any) => String(g.id) === String(item.genreId));
          if (genre?.slug) return { ...item, genreSlug: genre.slug };
        }
        return item;
      });

      if (data.customMenus) {
        console.log('✅ Estructura customMenus encontrada');

        setStickyHeader(data.headerConfig?.stickyHeader !== false);
        setCurrentHeaderConfig(data.headerConfig || {});

        // Guardar configuración completa del lateral (enabled, position, visibility)
        if (data.menus?.lateral && typeof data.menus.lateral === 'object') {
          setLateralMenuConfig(normalizeLateralConfig(data.menus.lateral));
        } else {
          setLateralMenuConfig(normalizeLateralConfig());
        }

        // Fallback al formato antiguo si customMenus existe pero un menú tiene items vacíos
        const getItems = (newItems: any[] | undefined, oldItems: any[] | undefined) => {
          if (newItems && newItems.length > 0) return patchGenreSlug(newItems);
          if (oldItems && oldItems.length > 0) return patchGenreSlug(Array.isArray(oldItems) ? oldItems : (oldItems as any)?.items || []);
          return [];
        };

        const fixedMenus: MenuConfig[] = [
          { id: 'principal', name: 'Menú Principal', isFixed: true, description: 'Aparece en el header', icon: '🏠', items: getItems(data.customMenus.principal?.items, data.menus?.principal) },
          { id: 'secundario', name: 'Menú Secundario', isFixed: true, description: 'Barra superior', icon: '⭐', items: getItems(data.customMenus.secundario?.items, data.menus?.secundario) },
          { id: 'lateral', name: 'Menú Lateral', isFixed: true, description: 'Panel lateral', icon: '📋', items: getItems(data.customMenus.lateral?.items, data.menus?.lateral?.items || data.menus?.lateral) },
          { id: 'footer', name: 'Menú Footer', isFixed: true, description: 'Pie de página', icon: '⬇️', items: getItems(data.customMenus.footer?.items, data.menus?.footer) },
        ];

        // Deduplicar menús personalizados por ID, excluyendo los 4 fijos si accidentalmente estuvieran aquí
        const fixedIds = new Set(['principal', 'secundario', 'lateral', 'footer']);
        const seenIds = new Set<string>();
        const customMenusList = (data.customMenus.custom || [])
          .filter((menu: MenuConfig) => !fixedIds.has(menu.id))
          .filter((menu: MenuConfig) => {
            if (seenIds.has(menu.id)) return false;
            seenIds.add(menu.id);
            return true;
          })
          .map((menu: MenuConfig) => ({
            ...menu,
            items: patchGenreSlug(menu.items || []),
          }));

        setMenus([...fixedMenus, ...customMenusList]);
        menusLoadedRef.current = true;
        console.log('✅ Menús cargados:', fixedMenus.map(m => `${m.id}: ${m.items.length} items`), 'Custom:', customMenusList.length);
      } else if (data.menus) {
        console.log('⚠️ Usando estructura antigua de menús');
        setStickyHeader(data.headerConfig?.stickyHeader !== false);
        setCurrentHeaderConfig(data.headerConfig || {});
        if (data.menus?.lateral && typeof data.menus.lateral === 'object') {
          setLateralMenuConfig(normalizeLateralConfig(data.menus.lateral));
        } else {
          setLateralMenuConfig(normalizeLateralConfig());
        }
        setMenus(prev => {
          const updated = prev.map(m => ({ ...m }));
          updated[0].items = patchGenreSlug(data.menus.principal || []);
          updated[1].items = patchGenreSlug(data.menus.secundario || []);
          updated[2].items = patchGenreSlug(data.menus.lateral?.items || []);
          updated[3].items = patchGenreSlug(data.menus.footer || []);
          return updated;
        });
        menusLoadedRef.current = true;
      } else {
        console.log('⚠️ No se encontró configuración de menús');
      }
    } catch (error) {
      console.error('❌ Error loading menus:', error);
    }
  };
        
  const loadCategories = async () => {
    try {
      const data = await api.getAllCategories();
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadGenres = async () => {
    try {
      const data = await api.getGenres();
      setGenres(data || []);
    } catch (error) {
      console.error('Error loading genres:', error);
    }
  };

  const loadPages = async () => {
    try {
      const data = await api.getPages();
      setPages(data || []);
    } catch (error) {
      console.error('Error loading pages:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const lateralItems = menus[2].items;

      const customMenus = {
        principal: { items: menus[0].items },
        secundario: { items: menus[1].items },
        lateral: { items: lateralItems },
        footer: { items: menus[3].items },
        custom: menus.slice(4).map(menu => ({
          id: menu.id,
          name: menu.name,
          isFixed: false,
          description: menu.description,
          icon: menu.icon,
          items: menu.items,
        })),
      };

      // También sincronizar menus.lateral.items para que el storefront lo lea
      const normalizedLateral = normalizeLateralConfig(lateralMenuConfig);

      const menusPayload = {
        principal: menus[0].items,
        secundario: menus[1].items,
        footer: menus[3].items,
        lateral: {
          ...normalizedLateral,
          items: lateralItems,
        },
      };

      console.log('🔄 Guardando menús para vendorId:', vendorId);
      console.log('📋 Datos a guardar:', JSON.stringify(customMenus, null, 2));
      
      const result = await api.updateVendorSettings(vendorId, {
        customMenus,
        menus: menusPayload,
        headerConfig: { ...currentHeaderConfig, stickyHeader },
      });
      console.log('✅ Respuesta del servidor:', result);
      
      alert('Menús guardados correctamente');
      
      // Recargar menús para confirmar guardado
      await loadMenus();
    } catch (error: any) {
      console.error('❌ Error saving menus:', error);
      alert(error.message || 'Error al guardar los menús');
    } finally {
      setLoading(false);
    }
  };

  const getMenuItemDescription = (item: MenuItem) => {
    switch (item.linkType) {
      case 'category':
        const category = categories.find(c => c.id === item.categoryId);
        return category ? `Categoría: ${category.name}` : 'Categoría no encontrada';
      case 'genre':
        const genre = genres.find(g => g.id === item.genreId || g.slug === item.genreSlug);
        return genre ? `Género: ${genre.name}` : 'Género no encontrado';
      case 'page':
        const page = pages.find(p => p.id === item.pageId);
        return page ? `Página: ${page.title}` : 'Página no encontrada';
      case 'condition':
        return `Condición: ${item.condition === 'used' ? 'Usado' : 'Nuevo'}`;
      case 'offers':
        return 'Ofertas / Descuentos';
      case 'custom':
        return item.customUrl || '#';
      default:
        return '#';
    }
  };

  const addMenuItem = () => {
    setEditingItem({
      id: Date.now(),
      label: '',
      linkType: 'custom',
      customUrl: '',
      openInNewTab: false,
      isNew: true,
    });
    setShowModal(true);
  };

  const saveMenuItem = () => {
    if (!editingItem.label) {
      alert('El nombre del enlace es obligatorio');
      return;
    }

    if (editingItem.linkType === 'category' && !editingItem.categoryId) {
      alert('Debes seleccionar una categoría');
      return;
    }
    if (editingItem.linkType === 'genre' && !editingItem.genreId) {
      alert('Debes seleccionar un género');
      return;
    }
    if (editingItem.linkType === 'page' && !editingItem.pageId) {
      alert('Debes seleccionar una página');
      return;
    }
    if (editingItem.linkType === 'custom' && !editingItem.customUrl) {
      alert('Debes ingresar una URL');
      return;
    }

    setMenus(prevMenus => {
      return prevMenus.map(menu => {
        if (menu.id === activeMenu) {
          const updatedItems = editingItem.isNew
            ? [...menu.items, editingItem]
            : menu.items.map(item => item.id === editingItem.id ? editingItem : item);
          return { ...menu, items: updatedItems };
        }
        return menu;
      });
    });

    setShowModal(false);
    setEditingItem(null);
  };

  const deleteMenuItem = (itemId: string | number) => {
    if (!confirm('¿Eliminar este enlace?')) return;

    setMenus(prevMenus => {
      return prevMenus.map(menu => {
        if (menu.id === activeMenu) {
          return { ...menu, items: menu.items.filter(item => item.id !== itemId) };
        }
        return menu;
      });
    });
  };

  const handleMenuDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setMenus(prevMenus => {
      return prevMenus.map(menu => {
        if (menu.id === activeMenu) {
          const oldIndex = menu.items.findIndex(item => item.id.toString() === active.id);
          const newIndex = menu.items.findIndex(item => item.id.toString() === over.id);
          
          if (oldIndex !== -1 && newIndex !== -1) {
            const reorderedItems = arrayMove(menu.items, oldIndex, newIndex);
            return { ...menu, items: reorderedItems };
          }
        }
        return menu;
      });
    });
  };

  const createNewMenu = () => {
    if (!newMenuName.trim()) {
      alert('Ingresa un nombre para el menú');
      return;
    }

    const newMenu: MenuConfig = {
      id: `custom-${Date.now()}`,
      name: newMenuName,
      isFixed: false,
      description: 'Menú personalizado',
      icon: '📌',
      items: [],
    };

    setMenus(prev => [...prev, newMenu]);
    setNewMenuName('');
    setShowNewMenuModal(false);
    setActiveMenu(newMenu.id);
  };

  const deleteMenu = (menuId: string) => {
    if (!confirm('¿Eliminar este menú y todos sus enlaces?')) return;
    setMenus(prev => prev.filter(menu => menu.id !== menuId));
    setActiveMenu('principal');
  };

  const openBulkGenreModal = () => {
    const lateralMenu = menus.find(m => m.id === activeMenu);
    const existingGenreIds = new Set(
      (lateralMenu?.items || []).filter((i: any) => i.linkType === 'genre').map((i: any) => String(i.genreId))
    );
    setSelectedBulkGenres(existingGenreIds);
    setBulkGenreSearch('');
    setShowBulkGenreModal(true);
  };

  const saveBulkGenres = () => {
    setMenus(prevMenus =>
      prevMenus.map(menu => {
        if (menu.id !== activeMenu) return menu;
        const nonGenreItems = menu.items.filter((i: any) => i.linkType !== 'genre');
        const newGenreItems: MenuItem[] = Array.from(selectedBulkGenres).flatMap(genreId => {
          const genre = genres.find((g: any) => String(g.id) === genreId);
          if (!genre) return [];
          return [{
            id: `genre-${genreId}-${Date.now()}-${Math.random()}` as string | number,
            label: genre.name as string,
            linkType: 'genre' as const,
            genreId: String(genre.id),
            genreSlug: (genre.slug || '') as string,
            openInNewTab: false,
          }];
        });
        return { ...menu, items: [...nonGenreItems, ...newGenreItems] };
      })
    );
    setShowBulkGenreModal(false);
  };

  const activeMenuConfig = menus.find(m => m.id === activeMenu);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestión de Menús</CardTitle>
            <CardDescription>Configura los menús de navegación de tu tienda</CardDescription>
          </div>
          <Button onClick={() => setShowNewMenuModal(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            Crear Menú
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Tabs de menús */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {menus.map((menu) => (
            <div key={menu.id} className="flex-shrink-0 relative group">
              <button
                onClick={() => setActiveMenu(menu.id)}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  activeMenu === menu.id
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{menu.icon}</span>
                  <div className="text-left">
                    <div className="font-semibold text-sm">{menu.name}</div>
                    <div className="text-xs text-gray-500">{menu.description}</div>
                  </div>
                </div>
              </button>
              
              {!menu.isFixed && (
                <button
                  onClick={() => deleteMenu(menu.id)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Eliminar menú"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Items del menú activo */}
        <div className="space-y-3 mb-6">

          {/* Configuración de visibilidad para Menú Lateral */}
          {activeMenu === 'lateral' && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-gray-900">Activar menú lateral</div>
                  <div className="text-xs text-gray-500">Si está desactivado, no se mostrará en ninguna página.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={normalizeLateralConfig(lateralMenuConfig).enabled}
                    onChange={(e) =>
                      setLateralMenuConfig((prev: any) => ({
                        ...normalizeLateralConfig(prev),
                        enabled: e.target.checked,
                      }))
                    }
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {normalizeLateralConfig(lateralMenuConfig).enabled && (
                <>
                {/* Posición del menú */}
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-sm font-medium text-gray-700 mb-2">Posición del menú</div>
                  <div className="flex gap-3">
                    <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium ${
                      normalizeLateralConfig(lateralMenuConfig).position === 'left'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-purple-300 text-gray-600'
                    }`}>
                      <input
                        type="radio"
                        className="sr-only"
                        name="lateralPosition-panel"
                        value="left"
                        checked={normalizeLateralConfig(lateralMenuConfig).position === 'left'}
                        onChange={() =>
                          setLateralMenuConfig((prev: any) => ({
                            ...normalizeLateralConfig(prev),
                            position: 'left',
                          }))
                        }
                      />
                      ◀ Izquierda
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium ${
                      normalizeLateralConfig(lateralMenuConfig).position === 'right'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-purple-300 text-gray-600'
                    }`}>
                      <input
                        type="radio"
                        className="sr-only"
                        name="lateralPosition-panel"
                        value="right"
                        checked={normalizeLateralConfig(lateralMenuConfig).position === 'right'}
                        onChange={() =>
                          setLateralMenuConfig((prev: any) => ({
                            ...normalizeLateralConfig(prev),
                            position: 'right',
                          }))
                        }
                      />
                      Derecha ▶
                    </label>
                  </div>
                </div>

                {/* Visibilidad por página */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-purple-600"
                      checked={normalizeLateralConfig(lateralMenuConfig).visibility.showInProductDetail}
                      onChange={(e) =>
                        setLateralMenuConfig((prev: any) => ({
                          ...normalizeLateralConfig(prev),
                          visibility: {
                            ...normalizeLateralConfig(prev).visibility,
                            mode: 'specific',
                            showInProductDetail: e.target.checked,
                          },
                        }))
                      }
                    />
                    1 - Página de producto
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-purple-600"
                      checked={normalizeLateralConfig(lateralMenuConfig).visibility.categories.mode === 'all'}
                      onChange={(e) =>
                        setLateralMenuConfig((prev: any) => ({
                          ...normalizeLateralConfig(prev),
                          visibility: {
                            ...normalizeLateralConfig(prev).visibility,
                            mode: 'specific',
                            categories: {
                              ...normalizeLateralConfig(prev).visibility.categories,
                              mode: e.target.checked ? 'all' : 'specific',
                              selected: e.target.checked ? normalizeLateralConfig(prev).visibility.categories.selected : [],
                            },
                          },
                        }))
                      }
                    />
                    2 - Categoría
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-purple-600"
                      checked={normalizeLateralConfig(lateralMenuConfig).visibility.genres.mode === 'all'}
                      onChange={(e) =>
                        setLateralMenuConfig((prev: any) => ({
                          ...normalizeLateralConfig(prev),
                          visibility: {
                            ...normalizeLateralConfig(prev).visibility,
                            mode: 'specific',
                            genres: {
                              ...normalizeLateralConfig(prev).visibility.genres,
                              mode: e.target.checked ? 'all' : 'specific',
                              selected: e.target.checked ? normalizeLateralConfig(prev).visibility.genres.selected : [],
                            },
                          },
                        }))
                      }
                    />
                    3 - Género
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-purple-600"
                      checked={normalizeLateralConfig(lateralMenuConfig).visibility.showInHome}
                      onChange={(e) =>
                        setLateralMenuConfig((prev: any) => ({
                          ...normalizeLateralConfig(prev),
                          visibility: {
                            ...normalizeLateralConfig(prev).visibility,
                            mode: 'specific',
                            showInHome: e.target.checked,
                          },
                        }))
                      }
                    />
                    4 - Página principal
                  </label>
                </div>
                </>
              )}
            </div>
          )}

          {/* Sticky toggle — visible only on Menú Principal */}
          {activeMenu === 'principal' && (
            <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
              <div>
                <div className="font-semibold text-sm text-gray-900">Menú fijo al hacer scroll</div>
                <div className="text-xs text-gray-500">El logo, buscador y menú se quedan visibles mientras se desplaza la página. La barra superior (reproductor/frases) no se fija.</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={stickyHeader}
                  onChange={(e) => setStickyHeader(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          )}
          {!activeMenuConfig?.items.length ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500 mb-4">No hay enlaces en este menú</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={addMenuItem} className="bg-purple-600 hover:bg-purple-700">
                  + Agregar primer enlace
                </Button>
                {activeMenu === 'lateral' && (
                  <Button onClick={openBulkGenreModal} variant="outline" className="border-purple-400 text-purple-700 hover:bg-purple-50">
                    🎵 Agregar géneros en bloque
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleMenuDragEnd}
            >
              <SortableContext
                items={activeMenuConfig.items.map(item => item.id.toString())}
                strategy={verticalListSortingStrategy}
              >
                {activeMenuConfig.items.map((item) => (
                  <SortableMenuItem
                    key={item.id}
                    item={item}
                    onEdit={() => {
                      setEditingItem({ ...item, isNew: false });
                      setShowModal(true);
                    }}
                    onDelete={() => deleteMenuItem(item.id)}
                    getDescription={getMenuItemDescription}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-3 pt-4 border-t">
          {activeMenuConfig && activeMenuConfig.items.length > 0 && (
            <Button onClick={addMenuItem} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Agregar enlace
            </Button>
          )}
          {activeMenu === 'lateral' && (
            <Button onClick={openBulkGenreModal} variant="outline" className="border-purple-400 text-purple-700 hover:bg-purple-50">
              🎵 Géneros en bloque
            </Button>
          )}
          
          <Button onClick={handleSave} disabled={loading} className="ml-auto bg-purple-600 hover:bg-purple-700">
            {loading ? 'Guardando...' : 'Guardar Menús'}
          </Button>
        </div>

        {/* Modal de importación masiva de géneros */}
        {showBulkGenreModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full flex flex-col max-h-[80vh]">
              <div className="p-5 border-b">
                <h3 className="text-lg font-semibold">🎵 Agregar géneros en bloque</h3>
                <p className="text-sm text-gray-500 mt-1">Selecciona los géneros que quieres agregar al menú lateral. Los géneros ya existentes en el menú aparecen marcados.</p>
              </div>

              <div className="px-5 pt-4 pb-2">
                <input
                  type="text"
                  placeholder="Buscar género..."
                  value={bulkGenreSearch}
                  onChange={(e) => setBulkGenreSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  autoFocus
                />
              </div>

              <div className="px-5 pb-2 flex gap-2">
                <button
                  onClick={() => setSelectedBulkGenres(new Set(genres.map((g: any) => String(g.id))))}
                  className="text-xs text-purple-600 hover:underline"
                >
                  Seleccionar todos
                </button>
                <span className="text-xs text-gray-400">•</span>
                <button
                  onClick={() => setSelectedBulkGenres(new Set())}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Deseleccionar todos
                </button>
                <span className="text-xs text-gray-400 ml-auto">{selectedBulkGenres.size} seleccionados</span>
              </div>

              <div className="px-5 overflow-y-auto flex-1 pb-2">
                <div className="grid grid-cols-2 gap-2">
                  {genres
                    .filter((g: any) => g.name?.toLowerCase().includes(bulkGenreSearch.toLowerCase()))
                    .sort((a: any, b: any) => a.name.localeCompare(b.name))
                    .map((genre: any) => {
                      const id = String(genre.id);
                      const checked = selectedBulkGenres.has(id);
                      return (
                        <label
                          key={id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                            checked
                              ? 'bg-purple-50 border-purple-400 text-purple-800'
                              : 'bg-white border-gray-200 hover:border-purple-300 text-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-purple-600"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedBulkGenres(prev => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(id); else next.delete(id);
                                return next;
                              });
                            }}
                          />
                          {genre.name}
                        </label>
                      );
                    })}
                </div>
                {genres.filter((g: any) => g.name?.toLowerCase().includes(bulkGenreSearch.toLowerCase())).length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-6">No se encontraron géneros</p>
                )}
              </div>

              <div className="p-5 border-t flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowBulkGenreModal(false)}>Cancelar</Button>
                <Button onClick={saveBulkGenres} className="bg-purple-600 hover:bg-purple-700">
                  Agregar {selectedBulkGenres.size > 0 ? `(${selectedBulkGenres.size})` : ''} al menú
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para crear nuevo menú */}
        {showNewMenuModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Crear Nuevo Menú</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Nombre del menú</label>
                <Input
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  placeholder="Ej: Ayuda, Legal, Categorías"
                  onKeyPress={(e) => e.key === 'Enter' && createNewMenu()}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => {
                    setShowNewMenuModal(false);
                    setNewMenuName('');
                  }}
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button onClick={createNewMenu} className="bg-purple-600 hover:bg-purple-700">
                  Crear
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para editar item */}
        {showModal && editingItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-2xl w-full my-8">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold">
                  {editingItem.isNew ? 'Agregar Enlace' : 'Editar Enlace'}
                </h3>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Nombre del enlace */}
                <div>
                  <label className="block text-sm font-medium mb-2">Nombre del enlace *</label>
                  <Input
                    value={editingItem.label}
                    onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
                    placeholder="Ej: Inicio, Productos, Contacto"
                  />
                </div>

                {/* Tipo de enlace */}
                <div>
                  <label className="block text-sm font-medium mb-2">Tipo de enlace</label>
                  <select
                    value={editingItem.linkType}
                    onChange={(e) => setEditingItem({ ...editingItem, linkType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="custom">🔗 URL personalizada</option>
                    <option value="category">📁 Categoría</option>
                    <option value="genre">🎵 Género</option>
                    <option value="page">📄 Página</option>
                    <option value="condition">🏷️ Condición</option>
                    <option value="offers">💸 Ofertas</option>
                  </select>
                </div>

                {/* Campos específicos según el tipo */}
                {editingItem.linkType === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">URL *</label>
                    <Input
                      value={editingItem.customUrl || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, customUrl: e.target.value })}
                      placeholder="https://ejemplo.com o /ruta/interna"
                    />
                  </div>
                )}

                {editingItem.linkType === 'category' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Categoría *</label>
                    <select
                      value={editingItem.categoryId || ''}
                      onChange={(e) => {
                        const selected = categories.find(cat => cat.id === e.target.value);
                        setEditingItem({ 
                          ...editingItem, 
                          categoryId: e.target.value,
                          categorySlug: selected?.slug || ''
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Selecciona una categoría</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {editingItem.linkType === 'genre' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Género *</label>
                    <select
                      value={editingItem.genreId || ''}
                      onChange={(e) => {
                        const selected = genres.find(g => String(g.id) === e.target.value);
                        setEditingItem({ 
                          ...editingItem, 
                          genreId: e.target.value,
                          genreSlug: selected?.slug || ''
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Selecciona un género</option>
                      {genres.map(genre => (
                        <option key={genre.id} value={genre.id}>{genre.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {editingItem.linkType === 'page' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Página *</label>
                    <select
                      value={editingItem.pageId || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, pageId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Selecciona una página</option>
                      {pages.map(page => (
                        <option key={page.id} value={page.id}>{page.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                {editingItem.linkType === 'condition' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Condición *</label>
                    <div className="flex gap-3">
                      {[{ value: 'new', label: '✨ Nuevo' }, { value: 'used', label: '♻️ Usado' }].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setEditingItem({ ...editingItem, condition: opt.value })}
                          className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                            (editingItem.condition || 'new') === opt.value
                              ? 'border-purple-600 bg-purple-50 text-purple-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {editingItem.linkType === 'offers' && (
                  <div className="rounded-lg border border-purple-100 bg-purple-50 p-3 text-sm text-purple-700">
                    💸 Se generará un enlace a todos los productos con descuento activo (<code>?isOnSale=true</code>).
                  </div>
                )}

                {/* Abrir en nueva pestaña */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="openInNewTab"
                    checked={editingItem.openInNewTab || false}
                    onChange={(e) => setEditingItem({ ...editingItem, openInNewTab: e.target.checked })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <label htmlFor="openInNewTab" className="text-sm">
                    Abrir en nueva pestaña
                  </label>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <Button
                  onClick={() => {
                    setShowModal(false);
                    setEditingItem(null);
                  }}
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button onClick={saveMenuItem} className="bg-purple-600 hover:bg-purple-700">
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
