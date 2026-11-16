import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  Scale, LogOut, User, BookOpen, Clock, BarChart3,
  School, Users, FolderPlus, Accessibility
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenAuth, isGuest, onLogout }) {
  const { user, logout } = useAuth();
  const { setIsMenuOpen, activeCount } = useAccessibility();

  const handleLogout = () => {
    logout();
    if (onLogout) onLogout();
  };

  return (
    <header className="header-nav">
      <div className="header-top-row">
        <div className="header-brand">
          <div className="brand-icon-wrapper">
            <Scale size={22} style={{ color: 'hsl(var(--primary-color))' }} />
          </div>
          <div>
            <h1 className="header-title">MVP Mobile</h1>
            <span className="header-subtitle-tag">Aplicación móvil para evaluar Coherencia Argumentativa</span>
          </div>
        </div>

        {/* User Profile, Accessibility Shortcut & Auth Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn-a11y-nav"
            onClick={() => setIsMenuOpen(prev => !prev)}
            title="Menú de Accesibilidad"
            aria-label="Abrir menú de accesibilidad"
          >
            <Accessibility size={17} />
            {activeCount > 0 && <span className="a11y-nav-dot" title={`${activeCount} ajustes activos`} />}
          </button>

          {user ? (
            <div className="user-profile-badge">
              <span className="user-code-pill" data-role={user.role} title={`ID Institucional: ${user.user_code}`}>
                {user.user_code}
              </span>
              <div className="user-name-box">
                <span className="user-display-name">{user.full_name || user.username}</span>
                <span className="user-role-label">{user.role}</span>
              </div>
              <button
                className="btn-logout"
                onClick={handleLogout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={15} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          ) : (
            <div className="guest-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {isGuest && (
                <span className="guest-mode-pill">
                  Modo Invitado
                </span>
              )}
              <button
                className="btn-primary"
                style={{ fontSize: '0.82rem', padding: '0.42rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={onOpenAuth}
              >
                <User size={15} />
                <span>Iniciar Sesión / Registro</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Role-based navigation tabs */}
      {user && (
        <div className="nav-tabs-container">
          {user.role === 'alumno' ? (
            <>
              <button
                className={`nav-tab-item ${activeTab === 'casos' ? 'active' : ''}`}
                onClick={() => setActiveTab('casos')}
              >
                <BookOpen size={16} />
                <span>Resolver Casos</span>
              </button>

              <button
                className={`nav-tab-item ${activeTab === 'historial' ? 'active' : ''}`}
                onClick={() => setActiveTab('historial')}
              >
                <Clock size={16} />
                <span>Mi Historial</span>
              </button>

              <button
                className={`nav-tab-item ${activeTab === 'desempeno' ? 'active' : ''}`}
                onClick={() => setActiveTab('desempeno')}
              >
                <BarChart3 size={16} />
                <span>Mi Desempeño</span>
              </button>

              <button
                className={`nav-tab-item ${activeTab === 'clase' ? 'active' : ''}`}
                onClick={() => setActiveTab('clase')}
              >
                <School size={16} />
                <span>Mi Clase</span>
              </button>
            </>
          ) : (
            <>
              <button
                className={`nav-tab-item ${activeTab === 'clases' ? 'active' : ''}`}
                onClick={() => setActiveTab('clases')}
              >
                <School size={16} />
                <span>Mis Clases</span>
              </button>

              <button
                className={`nav-tab-item ${activeTab === 'reporte' ? 'active' : ''}`}
                onClick={() => setActiveTab('reporte')}
              >
                <Users size={16} />
                <span>Reporte de Notas</span>
              </button>

              <button
                className={`nav-tab-item ${activeTab === 'gestor_casos' ? 'active' : ''}`}
                onClick={() => setActiveTab('gestor_casos')}
              >
                <FolderPlus size={16} />
                <span>Gestor de Casos</span>
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
