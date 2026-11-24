import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  School, CheckCircle2, AlertCircle, PlusCircle, User,
  Calendar, ArrowRight, Trash2, AlertTriangle, X, LogOut
} from 'lucide-react';

export default function StudentClassJoin() {
  const { authFetch } = useAuth();
  const [classes, setClasses] = useState([]);
  const [classCode, setClassCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // Leave class confirmation state
  const [classToLeave, setClassToLeave] = useState(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  useEffect(() => {
    fetchMyClasses();
  }, []);

  const fetchMyClasses = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/classes/my');
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
      }
    } catch (err) {
      console.error("Error cargando clases del alumno:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinClass = async (e) => {
    e.preventDefault();
    if (!classCode.trim()) return;
    setIsSubmitting(true);
    setMessage('');
    setIsError(false);
    try {
      const res = await authFetch('/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: classCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al unirse a la clase');
      setMessage(data.message || 'Te has unido exitosamente a la clase.');
      setClassCode('');
      fetchMyClasses();
    } catch (err) {
      setIsError(true);
      setMessage(err.message || 'No se pudo vincular la clase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmLeaveClass = async () => {
    if (!classToLeave) return;
    setIsLeaving(true);
    setLeaveError('');
    try {
      const res = await authFetch(`/api/classes/${classToLeave.id}/enrollment`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al salir de la clase');
      setClassToLeave(null);
      fetchMyClasses();
    } catch (err) {
      setLeaveError(err.message || 'No se pudo salir de la clase');
    } finally {
      setIsLeaving(false);
    }
  };

  const formatDate = (isoStr) => {
    try {
      return new Date(isoStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return isoStr; }
  };

  return (
    <div className="tab-pane-container">
      <div className="pane-header-box">
        <div>
          <h2 className="pane-title">Mi Clase y Sesión Docente</h2>
          <p className="pane-subtitle">
            Vincula tu cuenta ingresando el código proporcionado por tu docente para reportar automáticamente tus calificaciones.
          </p>
        </div>
      </div>

      {/* Formulario de registro a clase */}
      <div className="info-card" style={{ maxWidth: '600px', marginBottom: '1.5rem' }}>
        <h3 className="section-title">
          <PlusCircle size={18} />
          Registrar Nueva Clase
        </h3>
        <p style={{ fontSize: '0.86rem', color: 'hsl(var(--text-secondary))', marginBottom: '1rem' }}>
          Ingresa el código único generado por tu docente (por ejemplo: <code>CLS-849201</code>):
        </p>
        <form onSubmit={handleJoinClass} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="search-input"
            style={{ flex: 1, minWidth: '220px', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700' }}
            placeholder="Ej. CLS-123456"
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            disabled={isSubmitting}
            required
          />
          <button type="submit" className="btn-primary" disabled={isSubmitting || !classCode.trim()}>
            {isSubmitting ? 'Vinculando...' : 'Unirse a Clase'}
            <ArrowRight size={16} />
          </button>
        </form>
        {message && (
          <div className={`alert-banner ${isError ? 'error' : 'success'}`} style={{ marginTop: '1rem' }}>
            {isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{message}</span>
          </div>
        )}
      </div>

      {/* Clases activas */}
      <div>
        <h3 className="section-title">
          <School size={18} />
          Mis Clases Activas
        </h3>
        {isLoading ? (
          <div className="loading-box info-card">
            <div className="loading-spinner"></div>
            <span>Consultando tus clases registradas...</span>
          </div>
        ) : classes.length === 0 ? (
          <div className="empty-state-card">
            <School size={36} style={{ opacity: 0.4, margin: '0 auto 0.75rem auto' }} />
            <h4>Aún no estás inscrito en ninguna clase</h4>
            <p>Pídele a tu docente el código único de su clase/sesión (formato <code>CLS-XXXXXX</code>) e ingrésalo en el recuadro superior.</p>
          </div>
        ) : (
          <div className="classes-grid">
            {classes.map((cls) => (
              <div key={cls.id} className="class-card info-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{cls.title}</h4>
                  <span className="class-code-badge">{cls.code}</span>
                </div>

                {cls.description && (
                  <p style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.85rem' }}>
                    {cls.description}
                  </p>
                )}

                <div className="class-meta-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                    <User size={14} style={{ color: 'hsl(var(--primary-color))' }} />
                    <span>Docente: <strong>{cls.teacher_name}</strong> ({cls.teacher_code})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'hsl(var(--text-muted))' }}>
                    <Calendar size={13} />
                    <span>Inscrito el {formatDate(cls.joined_at)}</span>
                  </div>
                </div>

                <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn-danger-outline"
                    style={{ padding: '0.38rem 0.75rem', fontSize: '0.82rem', gap: '0.35rem' }}
                    onClick={() => { setClassToLeave(cls); setLeaveError(''); }}
                    title="Salir de esta clase"
                  >
                    <LogOut size={14} />
                    Salir de la clase
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Confirmar salir de clase */}
      {classToLeave && (
        <div className="modal-overlay" onClick={() => { if (!isLeaving) setClassToLeave(null); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} style={{ color: 'hsl(var(--warning-color))' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'hsl(var(--warning-color))' }}>
                  Salir de la Clase
                </h3>
              </div>
              <button className="btn-icon-close" onClick={() => setClassToLeave(null)} disabled={isLeaving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                ¿Estás seguro de que deseas <strong>salir</strong> de la siguiente clase?
              </p>
              <div style={{
                background: 'hsl(var(--bg-color-tertiary))',
                border: '1px solid hsl(var(--warning-color) / 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{classToLeave.title}</div>
                <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginTop: '0.2rem' }}>
                  Docente: {classToLeave.teacher_name} · Código: {classToLeave.code}
                </div>
              </div>
              <div style={{
                background: 'hsl(var(--warning-color) / 0.08)',
                border: '1px solid hsl(var(--warning-color) / 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.85rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                fontSize: '0.84rem', color: 'hsl(var(--warning-color))'
              }}>
                <AlertTriangle size={15} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                <span>Si sales, tu docente dejará de ver tu progreso en esta clase. Podrás volver a unirte con el código correspondiente.</span>
              </div>
              {leaveError && (
                <div className="alert-banner error" style={{ marginTop: '0.75rem' }}>
                  <AlertCircle size={15} /><span>{leaveError}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setClassToLeave(null)} disabled={isLeaving}>Cancelar</button>
              <button
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  background: 'hsl(var(--warning-color))', color: '#000',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  padding: '0.45rem 1rem', fontWeight: 700, fontSize: '0.88rem',
                  cursor: isLeaving ? 'not-allowed' : 'pointer', opacity: isLeaving ? 0.7 : 1
                }}
                onClick={handleConfirmLeaveClass}
                disabled={isLeaving}
              >
                <LogOut size={15} />
                {isLeaving ? 'Saliendo...' : 'Sí, salir de la clase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
