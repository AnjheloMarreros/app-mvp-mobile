import { createContext, useContext, useState, useEffect } from 'react';

const AccessibilityContext = createContext(null);

const STORAGE_SETTINGS_KEY = 'juris_a11y_settings';
const STORAGE_FLOATING_KEY = 'juris_a11y_floating_visible';

export const DEFAULT_A11Y_SETTINGS = {
  contrast: 'normal',        // 'normal' | 'high' | 'inverted'
  highlightLinks: false,     // boolean
  fontSize: 100,             // 100 | 115 | 130 | 145
  textSpacing: 'normal',     // 'normal' | 'moderate' | 'expanded'
  dyslexicFont: false,       // boolean
  lineHeight: 'normal',      // 'normal' | 'medium' | 'large'
  textAlign: 'left',         // 'left' | 'justify' | 'center' | 'right'
  saturation: 'normal'       // 'normal' | 'high' | 'low' | 'monochrome'
};

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_A11Y_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback a predeterminados
    }
    return DEFAULT_A11Y_SETTINGS;
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Visibilidad del botón flotante (persiste en localStorage)
  const [showFloatingTrigger, setShowFloatingTrigger] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_FLOATING_KEY);
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  const toggleFloatingTrigger = () => {
    setShowFloatingTrigger(prev => {
      const nextVal = !prev;
      try {
        localStorage.setItem(STORAGE_FLOATING_KEY, JSON.stringify(nextVal));
      } catch {}
      return nextVal;
    });
  };

  const setFloatingTriggerVisible = (visible) => {
    setShowFloatingTrigger(visible);
    try {
      localStorage.setItem(STORAGE_FLOATING_KEY, JSON.stringify(visible));
    } catch {}
  };

  // Sincronizar con localStorage y con atributos data-* en el elemento HTML raíz
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('No se pudo guardar la configuración de accesibilidad:', e);
    }

    const root = document.documentElement;
    root.setAttribute('data-a11y-contrast', settings.contrast);
    root.setAttribute('data-a11y-highlight-links', String(settings.highlightLinks));
    root.setAttribute('data-a11y-font-size', String(settings.fontSize));
    root.setAttribute('data-a11y-spacing', settings.textSpacing);
    root.setAttribute('data-a11y-dyslexic', String(settings.dyslexicFont));
    root.setAttribute('data-a11y-line-height', settings.lineHeight);
    root.setAttribute('data-a11y-align', settings.textAlign);
    root.setAttribute('data-a11y-saturation', settings.saturation);
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetAllSettings = () => {
    setSettings(DEFAULT_A11Y_SETTINGS);
  };

  // Contar cuántos ajustes están activos (distintos del valor por defecto)
  const activeCount = Object.keys(DEFAULT_A11Y_SETTINGS).reduce((count, key) => {
    return settings[key] !== DEFAULT_A11Y_SETTINGS[key] ? count + 1 : count;
  }, 0);

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        updateSetting,
        resetAllSettings,
        isMenuOpen,
        setIsMenuOpen,
        showFloatingTrigger,
        setShowFloatingTrigger: setFloatingTriggerVisible,
        toggleFloatingTrigger,
        activeCount
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility debe ser utilizado dentro de un AccessibilityProvider');
  }
  return context;
}
