// Definición de temas de colores para la tienda
export interface ColorTheme {
  id: string;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  accent: string;
  bgSite: string; // Fondo general del sitio (body)
  bgPage: string; // Fondo del contenido de página
  preview: string;
}

export const colorThemes: Record<string, ColorTheme> = {
  default: {
    id: "default",
    name: "Purple Dream",
    description: "Morado y azul vibrante (por defecto)",
    primary: "#9333ea", // purple-600
    secondary: "#2563eb", // blue-600
    accent: "#ec4899", // pink-600
    bgSite: "#f8f7ff", // light purple tint
    bgPage: "#ffffff", // white
    preview: "linear-gradient(135deg, #9333ea 0%, #2563eb 100%)",
  },
  forest: {
    id: "forest",
    name: "Forest Green",
    description: "Verde bosque profesional",
    primary: "#059669", // emerald-600
    secondary: "#0d9488", // teal-600
    accent: "#10b981", // green-500
    bgSite: "#f0fdf4", // light green tint
    bgPage: "#ffffff", // white
    preview: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
  },
  sunset: {
    id: "sunset",
    name: "Sunset Orange",
    description: "Naranja cálido y energético",
    primary: "#ea580c", // orange-600
    secondary: "#dc2626", // red-600
    accent: "#f59e0b", // amber-500
    bgSite: "#fff7ed", // light orange tint
    bgPage: "#ffffff", // white
    preview: "linear-gradient(135deg, #ea580c 0%, #dc2626 100%)",
  },
  ocean: {
    id: "ocean",
    name: "Deep Ocean",
    description: "Azul océano profundo",
    primary: "#0284c7", // sky-600
    secondary: "#0369a1", // sky-700
    accent: "#06b6d4", // cyan-500
    bgSite: "#f0f9ff", // light blue tint
    bgPage: "#ffffff", // white
    preview: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
  },
  royal: {
    id: "royal",
    name: "Royal Blue",
    description: "Azul real elegante",
    primary: "#1e40af", // blue-800
    secondary: "#1e3a8a", // blue-900
    accent: "#3b82f6", // blue-500
    bgSite: "#eff6ff", // light blue tint
    bgPage: "#ffffff", // white
    preview: "linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)",
  },
  rose: {
    id: "rose",
    name: "Rose Garden",
    description: "Rosa romántico",
    primary: "#e11d48", // rose-600
    secondary: "#be123c", // rose-700
    accent: "#fb7185", // rose-400
    bgSite: "#fff1f2", // light rose tint
    bgPage: "#ffffff", // white
    preview: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
  },
  midnight: {
    id: "midnight",
    name: "Midnight Black",
    description: "Negro elegante y moderno",
    primary: "#18181b", // zinc-900
    secondary: "#09090b", // zinc-950
    accent: "#71717a", // zinc-500
    bgSite: "#27272a", // dark zinc
    bgPage: "#18181b", // zinc-900
    preview: "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
  },
  mint: {
    id: "mint",
    name: "Fresh Mint",
    description: "Verde menta fresco",
    primary: "#14b8a6", // teal-500
    secondary: "#0d9488", // teal-600
    accent: "#5eead4", // teal-300
    bgSite: "#f0fdfa", // light teal tint
    bgPage: "#ffffff", // white
    preview: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
  },
  vinylWarm: {
    id: "vinylWarm",
    name: "Vinyl Warm",
    description: "Fucsia vintage con fondo crema",
    primary: "#84005f",
    secondary: "#5c0043",
    accent: "#b0007f",
    bgSite: "#f8f1e1",
    bgPage: "#f7f3e4",
    preview: "linear-gradient(135deg, #84005f 0%, #f8f1e1 100%)",
  },
};

export function getTheme(themeId: string): ColorTheme {
  return colorThemes[themeId] || colorThemes.default;
}

export function applyThemeToDocument(themeId: string, customColors?: Partial<ColorTheme> | null) {
  const baseTheme = getTheme(themeId);
  
  // Mezclar tema base con colores personalizados si existen
  const theme: ColorTheme = customColors
    ? { ...baseTheme, ...customColors }
    : baseTheme;
  
  console.log('🎨 Aplicando tema:', themeId, theme, '| customColors:', customColors);
  
  if (typeof document !== 'undefined') {
    // Aplicar CSS variables al :root
    document.documentElement.style.setProperty('--color-primary', theme.primary);
    document.documentElement.style.setProperty('--color-secondary', theme.secondary);
    document.documentElement.style.setProperty('--color-accent', theme.accent);
    document.documentElement.style.setProperty('--color-bg-site', theme.bgSite);
    document.documentElement.style.setProperty('--color-bg-page', theme.bgPage);

    // Guardar en localStorage para que el script inline lo aplique antes de renderizar
    try {
      localStorage.setItem('marketplace-theme', JSON.stringify({
        themeId,
        customColors,
        primary: theme.primary,
        secondary: theme.secondary,
        accent: theme.accent,
        bgSite: theme.bgSite,
        bgPage: theme.bgPage,
      }));
    } catch (e) {
      // Ignorar errores de localStorage
    }

    // Inyectar/actualizar hoja de estilos dinámica para overridear fondos de Tailwind
    let styleEl = document.getElementById('theme-bg-override') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'theme-bg-override';
      document.head.appendChild(styleEl);
    }
    // Overridea el fondo del body y de los wrappers principales
    // Usar !important para asegurar que se sobrescriba Tailwind
    styleEl.textContent = `
      html, body {
        background-color: ${theme.bgSite} !important;
        background-image: none !important;
      }
      .min-h-screen {
        background-color: ${theme.bgSite} !important;
        background-image: none !important;
      }
      .theme-gradient-bg {
        background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%) !important;
        background-image: linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%) !important;
      }
      div[class*="theme-gradient-bg"] {
        background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%) !important;
      }
    `;

    console.log('✅ Tema aplicado:', {
      bgSite: theme.bgSite,
      bgPage: theme.bgPage,
      primary: theme.primary,
      secondary: theme.secondary,
    });
  }
}
