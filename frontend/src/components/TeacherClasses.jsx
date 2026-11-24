import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  School, Plus, Users, Copy, Check, Calendar,
  ArrowRight, FileSpreadsheet, X, AlertCircle,
  Trash2, AlertTriangle
} from 'lucide-react';

export default function TeacherClasses({ onSelectClassReport }) {
  const { authFetch } = useAuth();
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [error, setError] = useState('');

  // Delete confirmation state
  const [classToDelete, setClassToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/classes/my');
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
      }
    } catch (err) {
      console.error("Error cargando clases del docente:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsSubmitting(true);
    setError('');
    try {
      const res = await authFetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al crear la clase');
      setNewTitle('');
      setNewDesc('');
      setShowModal(false);
      fetchClasses();
    } catch (err) {
      setError(err.message || 'No se pudo crear la clase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteClass = async () => {
    if (!classToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await authFetch(`/api/classes/${classToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al eliminar la clase');
      setClassToDelete(null);
      fetchClasses();
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar la clase');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2200);
  };

  const formatDate = (isoStr) => {
    try {
      return new Date(isoStr).toLocaleDateString('es-PE', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch { return isoStr; }
  };

  return (
    <div className="tab-pane-container">
      <div className="pane-header-box">
        <div>
          <h2 className="pane-title">Gestión de Clases y Sesiones</h2>
          <p className="pane-subtitle">
            Crea espacios académicos independientes para cada grupo de estudiantes y supervisa su avance individual.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          Crear Nueva Clase
        </button>
      </div>

      {isLoading ? (
        <div className="loading-box info-card" style={{ marginTop: '1.5rem' }}>
          <div className="loading-spinner"></div>
          <span>Cargando tus clases registradas...</span>
        </div>
      ) : classes.length === 0 ? (
        <div className="empty-state-card">
          <School size={40} style={{ opacity: 0.4, margin: '0 auto 0.75rem auto' }} />
          <h3>No tienes clases activas</h3>
          <p>Crea tu primera clase haciendo clic en <strong>"Crear Nueva Clase"</strong>. El sistema generará automáticamente un código único para que tus alumnos se vinculen.</p>
        </div>
      ) : (
        <div className="classes-grid">
          {classes.map((cls) => (
            <div key={cls.id} className="teacher-class-card info-card">
              <div className="teacher-class-card-header">
                <div>
                  <h3 className="class-card-title">{cls.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'hsl(var(--text-muted))', marginTop: '0.2rem' }}>
                    <Calendar size={12} />
                    <span>Creada el {formatDate(cls.created_at)}</span>
                  </div>
                </div>
                <div className="class-code-copy-box">
                  <span className="code-text">{cls.code}</span>
                  <button
                    className="btn-icon-copy"
                    onClick={() => handleCopyCode(cls.code)}
                    title="Copiar código para compartir con alumnos"
                  >
                    {copiedCode === cls.code
                      ? <Check size={14} style={{ color: 'hsl(var(--success-color))' }} />
                      : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {cls.description && (
                <p className="class-card-desc">{cls.description}</p>
              )}

              <div className="teacher-class-card-footer">
                <div className="enrolled-badge">
                  <Users size={15} />
                  <span><strong>{cls.enrolled_students}</strong> {cls.enrolled_students === 1 ? 'alumno' : 'alumnos'}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn-secondary"
                    style={{ gap: '0.4rem', fontSize: '0.82rem' }}
                    onClick={() => onSelectClassReport && onSelectClassReport(cls.id)}
                  >
                    <FileSpreadsheet size={15} />
                    Ver Reporte
                  </button>
                  <button
                    className="btn-danger-outline"
                    style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', gap: '0.35rem' }}
                    onClick={() => { setClassToDelete(cls); setDeleteError(''); }}
                    title="Eliminar esta clase"
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Crear clase */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <School size={20} style={{ color: 'hsl(var(--primary-color))' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Crear Clase / Sesión Académica</h3>
              </div>
              <button className="btn-icon-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateClass}>
              <div className="modal-body">
                {error && (
                  <div className="alert-banner error" style={{ marginBottom: '1rem' }}>
                    <AlertCircle size={16} /><span>{error}</span>
                  </div>
                )}
                <div className="form-group">
                  <label>Nombre de la Clase o Asignatura *</label>
                  <input
                    type="text"
                    placeholder="Ej. Argumentación y Lógica Jurídica - Sección A"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Descripción u Observaciones (Opcional)</label>
                  <textarea
                    rows={3}
                    placeholder="Ej. Semestre 2026-I, casos de Derecho Civil y Constitucional..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
                <div className="id-explanation-pill">
                  <span>El sistema generará automáticamente un código único con formato <strong>CLS-XXXXXX</strong>.</span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting || !newTitle.trim()}>
                  {isSubmitting ? 'Creando...' : 'Crear Clase'}
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar eliminación de clase */}
      {classToDelete && (
        <div className="modal-overlay" onClick={() => { if (!isDeleting) setClassToDelete(null); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} style={{ color: 'hsl(var(--danger-color))' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'hsl(var(--danger-color))' }}>
                  Eliminar Clase
                </h3>
              </div>
              <button className="btn-icon-close" onClick={() => setClassToDelete(null)} disabled={isDeleting}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                ¿Estás seguro de que deseas <strong>eliminar y dar por terminada</strong> la clase:
              </p>
              <div style={{
                background: 'hsl(var(--bg-color-tertiary))',
                border: '1px solid hsl(var(--danger-color) / 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{classToDelete.title}</div>
                <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))', marginTop: '0.2rem' }}>
                  Código: {classToDelete.code} · {classToDelete.enrolled_students} {classToDelete.enrolled_students === 1 ? 'alumno inscrito' : 'alumnos inscritos'}
                </div>
              </div>
              <div className="alert-banner" style={{
                background: 'hsl(var(--danger-color) / 0.08)',
                border: '1px solid hsl(var(--danger-color) / 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.85rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                fontSize: '0.84rem', color: 'hsl(var(--danger-color))'
              }}>
                <AlertTriangle size={15} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                <span>Esta acción es <strong>irreversible</strong>. Se desvinculará a todos los alumnos inscritos y no podrán acceder a esta clase.</span>
              </div>
              {deleteError && (
                <div className="alert-banner error" style={{ marginTop: '0.75rem' }}>
                  <AlertCircle size={15} /><span>{deleteError}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setClassToDelete(null)} disabled={isDeleting}>
                Cancelar
              </button>
              <button
                className="btn-danger"
                onClick={handleConfirmDeleteClass}
                disabled={isDeleting}
              >
                <Trash2 size={15} />
                {isDeleting ? 'Eliminando...' : 'Sí, eliminar clase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
