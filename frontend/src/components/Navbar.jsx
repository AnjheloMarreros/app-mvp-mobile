import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  Scale, LogOut, User, BookOpen, Clock, BarChart3,
  School, Users, FolderPlus, Accessibility,
  Trash2, AlertTriangle, X, AlertCircle
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenAuth, isGuest, onLogout }) {
  const { user, logout, authFetch } = useAuth();
  const { setIsMenuOpen, activeCount } = useAccessibility();

  // Delete account state
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleLogout = () => {
    logout();
    if (onLogout) onLogout();
  };

  const handleConfirmDeleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== 'ELIMINAR') return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await authFetch('/api/auth/me', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al eliminar la cuenta');
      // Logout and redirect
      logout();
      if (onLogout) onLogout();
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar la cuenta');
      setIsDeleting(false);
    }
  };

  const openDeleteAccount = () => {
    setShowDeleteAccount(true);
    setConfirmText('');
    setDeleteError('');
  };

  return (
    <>
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

          {/* User Profile, Accessibility & Auth Actions */}
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
                {/* Menú de acciones de usuario */}
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    className="btn-logout"
                    onClick={handleLogout}
                    title="Cerrar sesión"
                    aria-label="Cerrar sesión"
                  >
                    <LogOut size={15} />
                    <span>Salir</span>
                  </button>
                  <button
                    className="btn-danger-outline"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', gap: '0.25rem' }}
                    onClick={openDeleteAccount}
                    title="Eliminar mi cuenta permanentemente"
                    aria-label="Eliminar cuenta"
                  >
                    <Trash2 size={13} />
                    <span>Cuenta</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="guest-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                {isGuest && <span className="guest-mode-pill">Modo Invitado</span>}
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
                <button className={`nav-tab-item ${activeTab === 'casos' ? 'active' : ''}`} onClick={() => setActiveTab('casos')}>
                  <BookOpen size={16} /><span>Resolver Casos</span>
                </button>
                <button className={`nav-tab-item ${activeTab === 'historial' ? 'active' : ''}`} onClick={() => setActiveTab('historial')}>
                  <Clock size={16} /><span>Mi Historial</span>
                </button>
                <button className={`nav-tab-item ${activeTab === 'desempeno' ? 'active' : ''}`} onClick={() => setActiveTab('desempeno')}>
                  <BarChart3 size={16} /><span>Mi Desempeño</span>
                </button>
                <button className={`nav-tab-item ${activeTab === 'clase' ? 'active' : ''}`} onClick={() => setActiveTab('clase')}>
                  <School size={16} /><span>Mi Clase</span>
                </button>
              </>
            ) : (
              <>
                <button className={`nav-tab-item ${activeTab === 'clases' ? 'active' : ''}`} onClick={() => setActiveTab('clases')}>
                  <School size={16} /><span>Mis Clases</span>
                </button>
                <button className={`nav-tab-item ${activeTab === 'reporte' ? 'active' : ''}`} onClick={() => setActiveTab('reporte')}>
                  <Users size={16} /><span>Reporte de Notas</span>
                </button>
                <button className={`nav-tab-item ${activeTab === 'gestor_casos' ? 'active' : ''}`} onClick={() => setActiveTab('gestor_casos')}>
                  <FolderPlus size={16} /><span>Gestor de Casos</span>
                </button>
              </>
            )}
          </div>
        )}
      </header>

      {/* Modal: Eliminar cuenta */}
      {showDeleteAccount && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => { if (!isDeleting) { setShowDeleteAccount(false); setConfirmText(''); } }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={22} style={{ color: 'hsl(var(--danger-color))' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'hsl(var(--danger-color))' }}>
                  Eliminar Cuenta Permanentemente
                </h3>
              </div>
              <button className="btn-icon-close" onClick={() => setShowDeleteAccount(false)} disabled={isDeleting}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {/* Tarjeta de identidad del usuario */}
              <div style={{
                background: 'hsl(var(--bg-color-tertiary))',
                border: '1px solid hsl(var(--danger-color) / 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem'
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'hsl(var(--danger-color) / 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <User size={20} style={{ color: 'hsl(var(--danger-color))' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{user?.full_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>
                    {user?.user_code} · {user?.role} · {user?.email}
                  </div>
                </div>
              </div>

              {/* Advertencia */}
              <div style={{
                background: 'hsl(var(--danger-color) / 0.08)',
                border: '1px solid hsl(var(--danger-color) / 0.35)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 1rem',
                marginBottom: '1.1rem',
                fontSize: '0.84rem', color: 'hsl(var(--danger-color))'
              }}>
                <div style={{ fontWeight: 800, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertTriangle size={14} /> ¡Esta acción es completamente irreversible!
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.7 }}>
                  {user?.role === 'alumno' ? (
                    <>
                      <li>Se eliminarán todos tus registros de evaluaciones e historial.</li>
                      <li>Serás desvinculado de todas las clases en las que estás inscrito.</li>
                      <li>No podrás recuperar tu cuenta ni tus datos.</li>
                    </>
                  ) : (
                    <>
                      <li>Se eliminarán todas las clases que has creado y sus inscripciones.</li>
                      <li>Se eliminarán todos los casos jurídicos que hayas publicado.</li>
                      <li>No podrás recuperar tu cuenta ni tus datos.</li>
                    </>
                  )}
                </ul>
              </div>

              {/* Campo de confirmación */}
              <div className="form-group" style={{ marginBottom: '0' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                  Para confirmar, escribe <strong style={{ color: 'hsl(var(--danger-color))' }}>ELIMINAR</strong> en el campo de abajo:
                </label>
                <input
                  type="text"
                  placeholder="ELIMINAR"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={isDeleting}
                  autoFocus
                  style={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                />
              </div>

              {deleteError && (
                <div className="alert-banner error" style={{ marginTop: '0.75rem' }}>
                  <AlertCircle size={15} /><span>{deleteError}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowDeleteAccount(false); setConfirmText(''); }} disabled={isDeleting}>
                Cancelar, mantener cuenta
              </button>
              <button
                className="btn-danger"
                onClick={handleConfirmDeleteAccount}
                disabled={isDeleting || confirmText.trim().toUpperCase() !== 'ELIMINAR'}
              >
                <Trash2 size={15} />
                {isDeleting ? 'Eliminando...' : 'Eliminar mi cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
