"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CartItem {
  productId: string;
  title: string;
  artist?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  stock: number;
  vendorId: string;
  vendorSlug: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, openCartPanel?: boolean) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const toSafeNumber = (value: unknown, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const normalizeCartItem = (item: any): CartItem | null => {
  if (!item || !item.productId) return null;

  const quantity = Math.max(1, Math.trunc(toSafeNumber(item.quantity, 1)));
  const stock = Math.max(quantity, Math.trunc(toSafeNumber(item.stock, quantity)));

  return {
    ...item,
    title: item.title || 'Producto',
    artist: item.artist || '',
    price: Math.max(0, toSafeNumber(item.price, 0)),
    quantity,
    stock,
    vendorId: item.vendorId || 'marketplace',
    vendorSlug: item.vendorSlug || 'mundobeat',
  };
};

const normalizeCartItems = (items: any[]): CartItem[] => {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeCartItem).filter(Boolean) as CartItem[];
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; show: boolean }>({ 
    message: '', 
    show: false 
  });

  // Cargar carrito desde localStorage al iniciar
  useEffect(() => {
    const savedCart = localStorage.getItem('shopping-cart');
    if (savedCart) {
      try {
        setItems(normalizeCartItems(JSON.parse(savedCart)));
      } catch (error) {
        console.error('Error loading cart:', error);
      }
    }
  }, []);

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('shopping-cart', JSON.stringify(items));
  }, [items]);

  const showNotification = (message: string) => {
    setNotification({ message, show: true });
    setTimeout(() => {
      setNotification({ message: '', show: false });
    }, 4000);
  };

  const addItem = (item: Omit<CartItem, 'quantity'>, openCartPanel: boolean = true) => {
    console.log('🛒 addItem called with:', item);
    
    const normalizedItem = normalizeCartItem(item);
    if (!normalizedItem) return;

    const existingItem = items.find(i => i.productId === normalizedItem.productId);
    console.log('🛒 existingItem:', existingItem);
    
    // Check if already at stock limit
    if (existingItem && existingItem.quantity >= existingItem.stock) {
      const message = existingItem.quantity === 1 
        ? 'No se pueden agregar más unidades. Ya tienes la única unidad disponible en tu carrito.'
        : `No se pueden agregar más unidades. Ya tienes las ${existingItem.quantity} unidades disponibles en tu carrito.`;
      showNotification(message);
      return; // Don't add to cart
    }
    
    setItems(currentItems => {
      const existing = currentItems.find(i => i.productId === normalizedItem.productId);
      
      if (existing) {
        // Si ya existe, aumentar cantidad
        return currentItems.map(i =>
          i.productId === normalizedItem.productId
            ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
            : i
        );
      }
      
      // Si no existe, agregarlo
      return [...currentItems, { ...normalizedItem, quantity: 1 }];
    });
    
    // Abrir el carrito solo si openCartPanel es true (por defecto true)
    if (openCartPanel) {
      console.log('🛒 Opening cart...');
      setIsOpen(true);
    }
  };

  const removeItem = (productId: string) => {
    setItems(currentItems => currentItems.filter(i => i.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    
    setItems(currentItems =>
      currentItems.map(i =>
        i.productId === productId
          ? { ...i, quantity: Math.min(Math.max(1, Math.trunc(toSafeNumber(quantity, 1))), Math.max(1, Math.trunc(toSafeNumber(i.stock, 1)))) }
          : i
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + Math.max(0, Math.trunc(toSafeNumber(item.quantity, 0))), 0);
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + (toSafeNumber(item.price, 0) * Math.max(0, Math.trunc(toSafeNumber(item.quantity, 0)))), 0);
  };

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getTotalItems,
        getTotalPrice,
        isOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
      
      {/* Notificación Toast */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-2 duration-300">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg shadow-lg max-w-md">
            <p className="text-sm font-medium">{notification.message}</p>
          </div>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
