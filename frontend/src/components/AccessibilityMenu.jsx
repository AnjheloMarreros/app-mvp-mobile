import { useEffect } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  Accessibility, Contrast, Link2, Type, MoveHorizontal,
  MoveVertical, BookOpenCheck, AlignLeft, AlignJustify,
  AlignCenter, AlignRight, Palette, RotateCcw, X, Eye, EyeOff
} from 'lucide-react';

export default function AccessibilityMenu() {
  const {
    settings,
    updateSetting,
    resetAllSettings,
    isMenuOpen,
    setIsMenuOpen,
    showFloatingTrigger,
    toggleFloatingTrigger,
    activeCount
  } = useAccessibility();

  // Cerrar con la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen, setIsMenuOpen]);

  return (
    <>
      {/* Botón Flotante de Acceso Rápido (Se puede mostrar u ocultar en cualquier momento) */}
      {showFloatingTrigger && (
        <div className="a11y-floating-container">
          <button
            type="button"
            className="a11y-floating-trigger"
            onClick={() => setIsMenuOpen(prev => !prev)}
            aria-label="Abrir menú de accesibilidad"
            aria-haspopup="dialog"
            aria-expanded={isMenuOpen}
            title="Menú de Accesibilidad"
          >
            <Accessibility size={24} />
            {activeCount > 0 && (
              <span className="a11y-active-badge" title={`${activeCount} ajustes activos`}>
                {activeCount}
              </span>
            )}
          </button>

          {/* Botón rápido para ocultar el ícono flotante si obstruye la lectura */}
          <button
            type="button"
            className="a11y-floating-dismiss-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleFloatingTrigger();
            }}
            title="Ocultar ícono flotante (puedes reactivarlo desde la barra superior)"
            aria-label="Ocultar ícono flotante"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Modal / Panel de Accesibilidad */}
      {isMenuOpen && (
        <div className="a11y-modal-backdrop" onClick={() => setIsMenuOpen(false)}>
          <div
            className="a11y-modal-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="a11y-menu-title"
          >
            {/* Header del Panel */}
            <div className="a11y-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div className="a11y-header-icon-box">
                  <Accessibility size={22} />
                </div>
                <div>
                  <h2 id="a11y-menu-title" className="a11y-panel-title">
                    Menú de Accesibilidad
                  </h2>
                  <span className="a11y-panel-subtitle">
                    {activeCount > 0
                      ? `${activeCount} personalización${activeCount > 1 ? 'es' : ''} activa${activeCount > 1 ? 's' : ''}`
                      : 'Configuración predeterminada'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="a11y-close-btn"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Cerrar menú de accesibilidad"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Banner de control de visibilidad del ícono flotante */}
            <div className="a11y-floating-visibility-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                {showFloatingTrigger ? (
                  <Eye size={18} style={{ color: 'hsl(var(--primary-color))', flexShrink: 0 }} />
                ) : (
                  <EyeOff size={18} style={{ color: 'hsl(var(--text-muted))', flexShrink: 0 }} />
                )}
                <div>
                  <span className="a11y-visibility-title">Ícono flotante en pantalla</span>
                  <span className="a11y-visibility-desc">
                    {showFloatingTrigger
                      ? 'Visible en la esquina inferior izquierda'
                      : 'Oculto (accede siempre desde la barra superior)'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className={`a11y-visibility-toggle-btn ${showFloatingTrigger ? 'active' : ''}`}
                onClick={toggleFloatingTrigger}
              >
                {showFloatingTrigger ? 'Ocultar ícono' : 'Mostrar ícono'}
              </button>
            </div>

            {/* Opciones de Accesibilidad */}
            <div className="a11y-options-grid">
              {/* 1. Contraste */}
              <div className="a11y-card">
                <div className="a11y-card-header">
                  <Contrast size={18} className="a11y-card-icon" />
                  <span className="a11y-card-title">Contraste</span>
                </div>
                <div className="a11y-btn-group">
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.contrast === 'normal' ? 'selected' : ''}`}
                    onClick={() => updateSetting('contrast', 'normal')}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.contrast === 'high' ? 'selected' : ''}`}
                    onClick={() => updateSetting('contrast', 'high')}
                  >
                    Alto Contraste
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.contrast === 'inverted' ? 'selected' : ''}`}
                    onClick={() => updateSetting('contrast', 'inverted')}
                  >
                    Invertido
                  </button>
                </div>
              </div>

              {/* 2. Resaltar Enlaces */}
              <div className="a11y-card">
                <div className="a11y-card-header">
                  <Link2 size={18} className="a11y-card-icon" />
                  <span className="a11y-card-title">Resaltar Enlaces</span>
                </div>
                <div className="a11y-btn-group">
                  <button
                    type="button"
                    className={`a11y-btn-choice ${!settings.highlightLinks ? 'selected' : ''}`}
                    onClick={() => updateSetting('highlightLinks', false)}
                  >
                    Desactivado
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.highlightLinks ? 'selected' : ''}`}
                    onClick={() => updateSetting('highlightLinks', true)}
                  >
                    {settings.highlightLinks ? '✓ Resaltados' : 'Activar'}
                  </button>
                </div>
              </div>

              {/* 3. Agrandar Texto */}
              <div className="a11y-card">
                <div className="a11y-card-header">
                  <Type size={18} className="a11y-card-icon" />
                  <span className="a11y-card-title">Agrandar Texto</span>
                </div>
                <div className="a11y-btn-group">
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.fontSize === 100 ? 'selected' : ''}`}
                    onClick={() => updateSetting('fontSize', 100)}
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.fontSize === 115 ? 'selected' : ''}`}
                    onClick={() => updateSetting('fontSize', 115)}
                  >
                    115%
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.fontSize === 130 ? 'selected' : ''}`}
                    onClick={() => updateSetting('fontSize', 130)}
                  >
                    130%
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.fontSize === 145 ? 'selected' : ''}`}
                    onClick={() => updateSetting('fontSize', 145)}
                  >
                    145%
                  </button>
                </div>
              </div>

              {/* 4. Espaciado de Texto */}
              <div className="a11y-card">
                <div className="a11y-card-header">
                  <MoveHorizontal size={18} className="a11y-card-icon" />
                  <span className="a11y-card-title">Espaciado de Texto</span>
                </div>
                <div className="a11y-btn-group">
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.textSpacing === 'normal' ? 'selected' : ''}`}
                    onClick={() => updateSetting('textSpacing', 'normal')}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.textSpacing === 'moderate' ? 'selected' : ''}`}
                    onClick={() => updateSetting('textSpacing', 'moderate')}
                  >
                    Aumentado
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.textSpacing === 'expanded' ? 'selected' : ''}`}
                    onClick={() => updateSetting('textSpacing', 'expanded')}
                  >
                    Máximo
                  </button>
                </div>
              </div>

              {/* 5. Apto para Dislexia */}
              <div className="a11y-card">
                <div className="a11y-card-header">
                  <BookOpenCheck size={18} className="a11y-card-icon" />
                  <span className="a11y-card-title">Apto para Dislexia</span>
                </div>
                <div className="a11y-btn-group">
                  <button
                    type="button"
                    className={`a11y-btn-choice ${!settings.dyslexicFont ? 'selected' : ''}`}
                    onClick={() => updateSetting('dyslexicFont', false)}
                  >
                    Estándar
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.dyslexicFont ? 'selected' : ''}`}
                    onClick={() => updateSetting('dyslexicFont', true)}
                  >
                    {settings.dyslexicFont ? '✓ Fuente Dislexia' : 'Activar Fuente'}
                  </button>
                </div>
              </div>

              {/* 6. Altura de la Línea */}
              <div className="a11y-card">
                <div className="a11y-card-header">
                  <MoveVertical size={18} className="a11y-card-icon" />
                  <span className="a11y-card-title">Altura de la Línea</span>
                </div>
                <div className="a11y-btn-group">
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.lineHeight === 'normal' ? 'selected' : ''}`}
                    onClick={() => updateSetting('lineHeight', 'normal')}
                  >
                    Normal (1.5x)
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.lineHeight === 'medium' ? 'selected' : ''}`}
                    onClick={() => updateSetting('lineHeight', 'medium')}
                  >
                    Media (1.85x)
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.lineHeight === 'large' ? 'selected' : ''}`}
                    onClick={() => updateSetting('lineHeight', 'large')}
                  >
                    Amplia (2.2x)
                  </button>
                </div>
              </div>

              {/* 7. Texto Alineado */}
              <div className="a11y-card">
                <div className="a11y-card-header">
                  <AlignLeft size={18} className="a11y-card-icon" />
                  <span className="a11y-card-title">Texto Alineado</span>
                </div>
                <div className="a11y-btn-group">
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.textAlign === 'left' ? 'selected' : ''}`}
                    onClick={() => updateSetting('textAlign', 'left')}
                    title="Alineado a la izquierda"
                  >
                    <AlignLeft size={15} style={{ marginRight: '0.25rem' }} /> Izquierda
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.textAlign === 'justify' ? 'selected' : ''}`}
                    onClick={() => updateSetting('textAlign', 'justify')}
                    title="Texto justificado"
                  >
                    <AlignJustify size={15} style={{ marginRight: '0.25rem' }} /> Justificado
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.textAlign === 'center' ? 'selected' : ''}`}
                    onClick={() => updateSetting('textAlign', 'center')}
                    title="Texto centrado"
                  >
                    <AlignCenter size={15} style={{ marginRight: '0.25rem' }} /> Centrado
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.textAlign === 'right' ? 'selected' : ''}`}
                    onClick={() => updateSetting('textAlign', 'right')}
                    title="Alineado a la derecha"
                  >
                    <AlignRight size={15} style={{ marginRight: '0.25rem' }} /> Derecha
                  </button>
                </div>
              </div>

              {/* 8. Saturación */}
              <div className="a11y-card">
                <div className="a11y-card-header">
                  <Palette size={18} className="a11y-card-icon" />
                  <span className="a11y-card-title">Saturación</span>
                </div>
                <div className="a11y-btn-group">
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.saturation === 'normal' ? 'selected' : ''}`}
                    onClick={() => updateSetting('saturation', 'normal')}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.saturation === 'high' ? 'selected' : ''}`}
                    onClick={() => updateSetting('saturation', 'high')}
                  >
                    Alta
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.saturation === 'low' ? 'selected' : ''}`}
                    onClick={() => updateSetting('saturation', 'low')}
                  >
                    Baja
                  </button>
                  <button
                    type="button"
                    className={`a11y-btn-choice ${settings.saturation === 'monochrome' ? 'selected' : ''}`}
                    onClick={() => updateSetting('saturation', 'monochrome')}
                  >
                    Monocromo
                  </button>
                </div>
              </div>
            </div>

            {/* Botón para Restablecer Todas las Configuraciones */}
            <div className="a11y-panel-footer">
              <button
                type="button"
                className="a11y-reset-all-btn"
                onClick={resetAllSettings}
                title="Restablecer todas las configuraciones a valores por defecto"
              >
                <RotateCcw size={16} />
                <span>Restablecer todas las configuraciones de accesibilidad</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
