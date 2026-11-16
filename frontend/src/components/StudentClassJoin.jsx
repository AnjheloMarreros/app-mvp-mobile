import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  School, CheckCircle2, AlertCircle, PlusCircle, User,
  Calendar, ArrowRight
} from 'lucide-react';

export default function StudentClassJoin() {
  const { authFetch } = useAuth();
  const [classes, setClasses] = useState([]);
  const [classCode, setClassCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

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
      if (!res.ok) {
        throw new Error(data.detail || 'Error al unirse a la clase');
      }

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

  const formatDate = (isoStr) => {
    try {
      return new Date(isoStr).toLocaleDateString('es-PE', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch {
      return isoStr;
    }
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
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting || !classCode.trim()}
          >
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

      {/* Clases a las que pertenece el alumno */}
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
