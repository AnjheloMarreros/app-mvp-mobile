import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User, Lock, Mail, GraduationCap, School, ArrowRight,
  CheckCircle2, AlertCircle, Shield, Sparkles, X
} from 'lucide-react';

export default function AuthModal({ onClose, onEnterGuest, onLoginSuccess, isStandalone = false }) {
  const { login, register, isLoadingAuth } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [role, setRole] = useState('alumno'); // 'alumno' | 'docente'
  const [fullName, setFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!loginIdentifier.trim() || !loginPassword) {
      setError('Por favor ingresa tu usuario o correo y contraseña.');
      return;
    }

    try {
      await login(loginIdentifier.trim(), loginPassword);
      if (onLoginSuccess) onLoginSuccess();
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!fullName.trim() || !regUsername.trim() || !regEmail.trim() || !regPassword) {
      setError('Por favor completa todos los campos.');
      return;
    }

    if (regPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      const res = await register({
        role,
        full_name: fullName.trim(),
        username: regUsername.trim(),
        email: regEmail.trim(),
        password: regPassword
      });

      setSuccessMsg(`¡Registro exitoso! Tu ID asignado es ${res.user.user_code}`);
      setTimeout(() => {
        if (onLoginSuccess) onLoginSuccess();
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Error al crear la cuenta');
    }
  };

  const modalBody = (
    <div className={`auth-modal-card ${isStandalone ? 'standalone' : ''}`}>
      {/* Header */}
      <div className="auth-header-wrapper">
        {!isStandalone && onClose && (
          <button
            type="button"
            className="auth-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        )}

        <div className="auth-header">
          <div className="auth-logo-badge">
            <Shield size={24} style={{ color: 'hsl(var(--primary-color))' }} />
          </div>
          <h2>Plataforma de Argumentación Jurídica</h2>
          <p className="auth-subtitle">
            {tab === 'login'
              ? 'Ingresa a tu cuenta para evaluar tus casos o gestionar tus clases.'
              : 'Crea tu cuenta institucional como Alumno o Docente.'}
          </p>
        </div>
      </div>

      {/* Tab switchers */}
      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
          onClick={() => { setTab('login'); setError(''); }}
        >
          Iniciar Sesión
        </button>
        <button
          type="button"
          className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`}
          onClick={() => { setTab('register'); setError(''); }}
        >
          Crear Cuenta
        </button>
      </div>

      {/* Error and Success alerts */}
      {error && (
        <div className="alert-banner error" style={{ margin: '0.75rem 0' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert-banner success" style={{ margin: '0.75rem 0' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Login Form */}
      {tab === 'login' ? (
        <form onSubmit={handleLoginSubmit} className="auth-form">
          <div className="form-group">
            <label>Usuario o Correo Electrónico</label>
            <div className="input-with-icon">
              <User size={17} className="input-icon" />
              <input
                type="text"
                placeholder="Ej. juan_perez o juan@universidad.edu.pe"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <div className="input-with-icon">
              <Lock size={17} className="input-icon" />
              <input
                type="password"
                placeholder="Tu contraseña"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={isLoadingAuth}
          >
            {isLoadingAuth ? 'Iniciando sesión...' : 'Ingresar a la plataforma'}
            <ArrowRight size={16} />
          </button>
        </form>
      ) : (
        /* Register Form */
        <form onSubmit={handleRegisterSubmit} className="auth-form">
          {/* Role selector */}
          <div className="form-group">
            <label>Selecciona tu Rol</label>
            <div className="role-selector-grid">
              <div
                className={`role-option-card ${role === 'alumno' ? 'selected' : ''}`}
                onClick={() => setRole('alumno')}
              >
                <GraduationCap size={22} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Alumno</div>
                  <div style={{ fontSize: '0.74rem', opacity: 0.8 }}>ID: AXXXXXXXX</div>
                </div>
              </div>

              <div
                className={`role-option-card ${role === 'docente' ? 'selected' : ''}`}
                onClick={() => setRole('docente')}
              >
                <School size={22} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Docente</div>
                  <div style={{ fontSize: '0.74rem', opacity: 0.8 }}>ID: DXXXXXXXX</div>
                </div>
              </div>
            </div>
          </div>

          <div className="id-explanation-pill">
            <Sparkles size={14} style={{ color: 'hsl(var(--primary-color))', flexShrink: 0 }} />
            <span>
              Se te asignará automáticamente un ID institucional único que iniciará con la letra{' '}
              <strong>{role === 'alumno' ? "'A' (AXXXXXXXX)" : "'D' (DXXXXXXXX)"}</strong>.
            </span>
          </div>

          <div className="form-group">
            <label>Nombres y Apellidos</label>
            <div className="input-with-icon">
              <User size={17} className="input-icon" />
              <input
                type="text"
                placeholder="Ej. Carlos Mendoza Ríos"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Nombre de Usuario</label>
              <input
                type="text"
                placeholder="Ej. cmendoza"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                required
              />
            </div>

            <div className="form-group">
              <label>Correo Electrónico</label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  type="email"
                  placeholder="carlos@correo.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Contraseña</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Confirmar Contraseña</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={isLoadingAuth}
          >
            {isLoadingAuth ? 'Creando cuenta...' : `Registrarse como ${role === 'alumno' ? 'Alumno' : 'Docente'}`}
            <ArrowRight size={16} />
          </button>
        </form>
      )}

      {/* Guest entry link */}
      <div className="auth-guest-footer">
        <div className="auth-divider">
          <span>o continúa sin cuenta</span>
        </div>
        <button
          type="button"
          className="auth-guest-link"
          onClick={() => {
            if (onEnterGuest) onEnterGuest();
            if (onClose) onClose();
          }}
        >
          Ingresar como invitado
        </button>
        <p className="auth-guest-desc">
          Explora y resuelve los casos jurídicos sin necesidad de iniciar sesión
        </p>
      </div>
    </div>
  );

  if (isStandalone) {
    return modalBody;
  }

  return (
    <div className="auth-overlay">
      {modalBody}
    </div>
  );
}
