import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Edit3, Lock, CheckCircle2, Trash2, AlertTriangle,
  AlertCircle, Search, X, ArrowRight, FileText
} from 'lucide-react';

export default function TeacherCaseManager() {
  const { authFetch, user } = useAuth();
  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [enunciado, setEnunciado] = useState('');
  const [contexto, setContexto] = useState('');
  const [hechosRelevantes, setHechosRelevantes] = useState('');
  const [soporteJuridico, setSoporteJuridico] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Edit Modal state
  const [editingCase, setEditingCase] = useState(null);
  const [editEnunciado, setEditEnunciado] = useState('');
  const [editContexto, setEditContexto] = useState('');
  const [editHechos, setEditHechos] = useState('');
  const [editSoporte, setEditSoporte] = useState('');

  // Delete confirmation state
  const [caseToDelete, setCaseToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/cases');
      if (res.ok) {
        const data = await res.json();
        setCases(data);
      }
    } catch (err) {
      console.error("Error cargando casos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const nextCaseNumber = cases.length > 0
    ? Math.max(...cases.map(c => c.number || 0)) + 1
    : 41;
  const nextCaseId = `caso_${String(nextCaseNumber).padStart(3, '0')}`;
  const nextCaseTitle = `Caso ${nextCaseNumber}`;

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!enunciado.trim() || !contexto.trim() || !hechosRelevantes.trim() || !soporteJuridico.trim()) {
      setErrorMsg('Por favor completa todos los campos requeridos para publicar el caso.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await authFetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enunciado: enunciado.trim(),
          contexto: contexto.trim(),
          hechos_relevantes: hechosRelevantes.trim(),
          soporte_juridico: soporteJuridico.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al publicar el caso');
      setSuccessMsg(`¡${nextCaseTitle} publicado exitosamente!`);
      setTimeout(() => {
        setEnunciado(''); setContexto(''); setHechosRelevantes(''); setSoporteJuridico('');
        setShowCreateModal(false); setSuccessMsg(''); loadCases();
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo publicar el caso');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (c) => {
    setEditingCase(c);
    setEditEnunciado(c.enunciado || '');
    setEditContexto(Array.isArray(c.contexto) ? c.contexto.join('\n') : (c.contexto || ''));
    setEditHechos(c.hechos_relevantes || '');
    setEditSoporte(c.soporte_juridico || '');
    setErrorMsg('');
  };

  const handleUpdateCase = async (e) => {
    e.preventDefault();
    if (!editingCase) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await authFetch(`/api/cases/${editingCase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enunciado: editEnunciado.trim(),
          contexto: editContexto.trim(),
          hechos_relevantes: editHechos.trim(),
          soporte_juridico: editSoporte.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al actualizar el caso');
      setEditingCase(null);
      loadCases();
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo actualizar el caso');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteCase = async () => {
    if (!caseToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await authFetch(`/api/cases/${caseToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al eliminar el caso');
      setCaseToDelete(null);
      loadCases();
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar el caso');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCases = cases.filter(c => {
    const term = searchTerm.toLowerCase();
    return (c.titulo || '').toLowerCase().includes(term)
      || (c.enunciado || '').toLowerCase().includes(term)
      || (c.teacher_name || '').toLowerCase().includes(term);
  });

  return (
    <div className="tab-pane-container">
      <div className="pane-header-box">
        <div>
          <h2 className="pane-title">Módulo de Casos Jurídicos</h2>
          <p className="pane-subtitle">
            Publica y administra casos prácticos para evaluación. Los 40 casos base oficiales están protegidos; los nuevos son administrables por su docente autor.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} />
          Publicar Nuevo Caso
        </button>
      </div>

      {/* Search */}
      <div className="search-container">
        <Search style={{ position: 'absolute', left: '1rem', top: '1.05rem', color: 'hsl(var(--text-muted))' }} size={18} />
        <input
          type="text"
          className="search-input"
          placeholder="Buscar caso por título, enunciado o docente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Cases List */}
      {isLoading ? (
        <div className="loading-box info-card">
          <div className="loading-spinner"></div>
          <span>Cargando catálogo de casos jurídicos...</span>
        </div>
      ) : (
        <div className="cases-list">
          {filteredCases.map((c) => (
            <div key={c.id} className="case-card" style={{ cursor: 'default' }}>
              <div className="case-card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <h3 className="case-title">{c.titulo}</h3>
                    {c.is_default ? (
                      <span className="protected-case-pill"><Lock size={12} /> Caso Base Oficial (Protegido)</span>
                    ) : (
                      <span className="teacher-published-pill"><FileText size={12} /> Propuesto por Docente</span>
                    )}
                  </div>
                  {!c.is_default && c.teacher_name && (
                    <div className="case-published-by-tag">Caso publicado por {c.teacher_name}</div>
                  )}
                </div>

                {/* Acciones: solo para casos propios del docente */}
                {c.can_edit && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      onClick={() => openEditModal(c)}
                    >
                      <Edit3 size={14} />
                      Modificar
                    </button>
                    <button
                      className="btn-danger-outline"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', gap: '0.3rem' }}
                      onClick={() => { setCaseToDelete(c); setDeleteError(''); }}
                      title="Eliminar este caso"
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>

              <p className="case-preview" style={{ WebkitLineClamp: 3 }}>{c.enunciado}</p>

              {c.hechos_relevantes && (
                <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginTop: '0.2rem' }}>
                  <strong>Hechos relevantes:</strong> {c.hechos_relevantes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Publicar Nuevo Caso */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Proponer / Publicar Nuevo Caso Jurídico</h3>
                <span style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))' }}>
                  Los campos de ID y Título se enumeran automáticamente de manera correlativa.
                </span>
              </div>
              <button className="btn-icon-close" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateCase}>
              <div className="modal-body-scroll">
                {errorMsg && <div className="alert-banner error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /><span>{errorMsg}</span></div>}
                {successMsg && <div className="alert-banner success" style={{ marginBottom: '1rem' }}><CheckCircle2 size={16} /><span>{successMsg}</span></div>}
                <div className="form-row-2" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label>ID del Caso (Automático)</label>
                    <input type="text" value={nextCaseId} disabled style={{ opacity: 0.75, cursor: 'not-allowed', fontFamily: 'JetBrains Mono, monospace' }} />
                  </div>
                  <div className="form-group">
                    <label>Título del Caso (Automático)</label>
                    <input type="text" value={nextCaseTitle} disabled style={{ opacity: 0.75, cursor: 'not-allowed', fontWeight: 700 }} />
                  </div>
                </div>
                <div className="id-explanation-pill" style={{ marginBottom: '1rem' }}>
                  <span>El caso se publicará con el texto: <strong>"Caso publicado por {user?.full_name}"</strong>.</span>
                </div>
                <div className="form-group">
                  <label>1. Enunciado del Caso *</label>
                  <textarea rows={3} placeholder="Describe el conflicto o situación jurídica inicial planteada..." value={enunciado} onChange={(e) => setEnunciado(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>2. Contexto y Antecedentes *</label>
                  <textarea rows={3} placeholder="Detalla el contexto procesal, resoluciones de primera instancia, etc..." value={contexto} onChange={(e) => setContexto(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>3. Hechos Relevantes *</label>
                  <textarea rows={3} placeholder="Hechos fácticos probados o controvertidos..." value={hechosRelevantes} onChange={(e) => setHechosRelevantes(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>4. Soporte Constitucional y Jurídico Sugerido *</label>
                  <textarea rows={3} placeholder="Normas aplicables (ej. Código Civil art. 1361, Constitución art. 2 inc. 14)..." value={soporteJuridico} onChange={(e) => setSoporteJuridico(e.target.value)} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Publicando...' : 'Publicar Caso'}
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Modificar Caso */}
      {editingCase && (
        <div className="modal-overlay" onClick={() => setEditingCase(null)}>
          <div className="modal-card-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Modificar {editingCase.titulo}</h3>
                <span style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))' }}>
                  Solo puedes modificar casos que tú mismo hayas publicado.
                </span>
              </div>
              <button className="btn-icon-close" onClick={() => setEditingCase(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleUpdateCase}>
              <div className="modal-body-scroll">
                {errorMsg && <div className="alert-banner error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /><span>{errorMsg}</span></div>}
                <div className="form-group"><label>Enunciado del Caso</label><textarea rows={3} value={editEnunciado} onChange={(e) => setEditEnunciado(e.target.value)} required /></div>
                <div className="form-group"><label>Contexto</label><textarea rows={3} value={editContexto} onChange={(e) => setEditContexto(e.target.value)} required /></div>
                <div className="form-group"><label>Hechos Relevantes</label><textarea rows={3} value={editHechos} onChange={(e) => setEditHechos(e.target.value)} required /></div>
                <div className="form-group"><label>Soporte Constitucional y Jurídico Sugerido</label><textarea rows={3} value={editSoporte} onChange={(e) => setEditSoporte(e.target.value)} required /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingCase(null)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar eliminación de caso */}
      {caseToDelete && (
        <div className="modal-overlay" onClick={() => { if (!isDeleting) setCaseToDelete(null); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} style={{ color: 'hsl(var(--danger-color))' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'hsl(var(--danger-color))' }}>
                  Eliminar Caso
                </h3>
              </div>
              <button className="btn-icon-close" onClick={() => setCaseToDelete(null)} disabled={isDeleting}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                ¿Estás seguro de que deseas <strong>eliminar permanentemente</strong> el siguiente caso?
              </p>
              <div style={{
                background: 'hsl(var(--bg-color-tertiary))',
                border: '1px solid hsl(var(--danger-color) / 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{caseToDelete.titulo}</div>
                <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginTop: '0.3rem', WebkitLineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>
                  {caseToDelete.enunciado}
                </div>
              </div>
              <div style={{
                background: 'hsl(var(--danger-color) / 0.08)',
                border: '1px solid hsl(var(--danger-color) / 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.85rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                fontSize: '0.84rem', color: 'hsl(var(--danger-color))'
              }}>
                <AlertTriangle size={15} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                <span>Esta acción es <strong>irreversible</strong>. Se eliminarán también todas las evaluaciones de alumnos asociadas a este caso.</span>
              </div>
              {deleteError && (
                <div className="alert-banner error" style={{ marginTop: '0.75rem' }}>
                  <AlertCircle size={15} /><span>{deleteError}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setCaseToDelete(null)} disabled={isDeleting}>Cancelar</button>
              <button className="btn-danger" onClick={handleConfirmDeleteCase} disabled={isDeleting}>
                <Trash2 size={15} />
                {isDeleting ? 'Eliminando...' : 'Sí, eliminar caso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
