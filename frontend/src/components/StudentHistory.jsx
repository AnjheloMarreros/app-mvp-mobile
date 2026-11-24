import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Clock, CheckCircle2, ChevronRight, Layers, Trash2, AlertTriangle,
  Calendar, RotateCcw, FileText, X, AlertCircle
} from 'lucide-react';

export default function StudentHistory() {
  const { authFetch } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState(null);

  // Clear history state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/evaluations/my');
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      }
    } catch (err) {
      console.error("Error cargando historial:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmClearHistory = async () => {
    setIsClearing(true);
    setClearError('');
    try {
      const res = await authFetch('/api/evaluations/my', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al eliminar historial');
      setShowClearConfirm(false);
      setSubmissions([]);
    } catch (err) {
      setClearError(err.message || 'No se pudo eliminar el historial');
    } finally {
      setIsClearing(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 4.5) return 'hsl(var(--level-5))';
    if (score >= 3.5) return 'hsl(var(--level-4))';
    if (score >= 2.5) return 'hsl(var(--level-3))';
    if (score >= 1.5) return 'hsl(var(--level-2))';
    return 'hsl(var(--level-1))';
  };

  const getNivel = (score) => {
    if (score <= 1.9) return "Muy bajo";
    if (score <= 2.9) return "Bajo";
    if (score <= 3.9) return "Medio";
    if (score <= 4.9) return "Alto";
    return "Excelente";
  };

  const formatDate = (isoStr) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return isoStr; }
  };

  return (
    <div className="tab-pane-container">
      <div className="pane-header-box">
        <div>
          <h2 className="pane-title">Historial de Casos Resueltos</h2>
          <p className="pane-subtitle">
            Registro cronológico de todas tus posturas argumentativas y dictámenes emitidos por la IA.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={fetchHistory} title="Actualizar historial">
            <RotateCcw size={15} />
            Actualizar
          </button>
          {submissions.length > 0 && (
            <button
              className="btn-danger-outline"
              style={{ gap: '0.4rem', fontSize: '0.82rem' }}
              onClick={() => { setShowClearConfirm(true); setClearError(''); }}
              title="Eliminar todo el historial"
            >
              <Trash2 size={14} />
              Eliminar historial
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="loading-box info-card" style={{ marginTop: '1.5rem' }}>
          <div className="loading-spinner"></div>
          <span>Cargando tu historial de evaluaciones...</span>
        </div>
      ) : submissions.length === 0 ? (
        <div className="empty-state-card">
          <Clock size={40} style={{ opacity: 0.4, margin: '0 auto 0.75rem auto' }} />
          <h3>Aún no tienes casos resueltos</h3>
          <p>Ve a la sección <strong>"Resolver Casos"</strong>, dicta tu postura jurídica oral y presiona <em>Evaluar</em> para registrar tus notas aquí.</p>
        </div>
      ) : (
        <div className="history-list-grid">
          {submissions.map((sub) => {
            const scoreColor = getScoreColor(sub.score_total);
            const nivel = getNivel(sub.score_total);
            const r = sub.rubric_scores || {};

            return (
              <div key={sub.id} className="history-card" onClick={() => setSelectedSub(sub)}>
                <div className="history-card-top">
                  <div>
                    <h3 className="history-case-title">{sub.case_title}</h3>
                    <div className="history-date">
                      <Calendar size={13} />
                      <span>{formatDate(sub.created_at)}</span>
                    </div>
                  </div>
                  <div className="history-score-badge" style={{ borderColor: scoreColor, color: scoreColor }}>
                    <span className="score-num">{sub.score_total.toFixed(2)}</span>
                    <span className="score-nivel">{nivel}</span>
                  </div>
                </div>
                <div className="history-rubric-mini-grid">
                  <div className="rubric-mini-chip"><span className="chip-name">Estructura</span><span className="chip-val">{r.estructura_logica || '-'}/5</span></div>
                  <div className="rubric-mini-chip"><span className="chip-name">Relevancia</span><span className="chip-val">{r.relevancia_pertinencia || '-'}/5</span></div>
                  <div className="rubric-mini-chip"><span className="chip-name">Consistencia</span><span className="chip-val">{r.consistencia_logica || '-'}/5</span></div>
                  <div className="rubric-mini-chip"><span className="chip-name">Cohesión</span><span className="chip-val">{r.cohesion_calidad || '-'}/5</span></div>
                </div>
                <div className="history-card-footer">
                  <span className="btn-text-link">Ver dictamen completo y análisis Toulmin <ChevronRight size={14} /></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Confirmar eliminar historial */}
      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => { if (!isClearing) setShowClearConfirm(false); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} style={{ color: 'hsl(var(--danger-color))' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'hsl(var(--danger-color))' }}>
                  Eliminar Historial
                </h3>
              </div>
              <button className="btn-icon-close" onClick={() => setShowClearConfirm(false)} disabled={isClearing}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                ¿Estás seguro de que deseas <strong>eliminar todo tu historial</strong> de evaluaciones?
              </p>
              <div style={{
                background: 'hsl(var(--bg-color-tertiary))',
                border: '1px solid hsl(var(--danger-color) / 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}>
                <Clock size={18} style={{ color: 'hsl(var(--danger-color))' }} />
                <span style={{ fontWeight: 700 }}>{submissions.length} evaluación{submissions.length !== 1 ? 'es' : ''} registrada{submissions.length !== 1 ? 's' : ''}</span>
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
                <span>Esta acción es <strong>irreversible</strong>. Se eliminarán permanentemente todos tus registros de puntajes y dictámenes de la IA.</span>
              </div>
              {clearError && (
                <div className="alert-banner error" style={{ marginTop: '0.75rem' }}>
                  <AlertCircle size={15} /><span>{clearError}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowClearConfirm(false)} disabled={isClearing}>Cancelar</button>
              <button className="btn-danger" onClick={handleConfirmClearHistory} disabled={isClearing}>
                <Trash2 size={15} />
                {isClearing ? 'Eliminando...' : 'Sí, eliminar todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ver dictamen completo */}
      {selectedSub && (
        <div className="modal-overlay" onClick={() => setSelectedSub(null)}>
          <div className="modal-card-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="case-badge" style={{ marginBottom: '0.35rem', display: 'inline-block' }}>
                  {formatDate(selectedSub.created_at)}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{selectedSub.case_title}</h3>
              </div>
              <button className="btn-icon-close" onClick={() => setSelectedSub(null)}><X size={18} /></button>
            </div>
            <div className="modal-body-scroll">
              <div className="score-hero" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="score-badge-circle" style={{ borderColor: getScoreColor(selectedSub.score_total), color: getScoreColor(selectedSub.score_total) }}>
                    <span className="num">{selectedSub.score_total.toFixed(2)}</span>
                    <span className="max">de 5.00</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--text-secondary))' }}>Nivel de Desempeño</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: getScoreColor(selectedSub.score_total) }}>{getNivel(selectedSub.score_total)}</div>
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 className="section-title"><FileText size={16} /> Tu Argumento Presentado</h4>
                <div className="transcription-text-body" style={{ minHeight: 'auto', fontStyle: 'italic' }}>
                  "{selectedSub.student_argument}"
                </div>
              </div>
              {selectedSub.final_feedback && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 className="section-title"><CheckCircle2 size={16} /> Dictamen Pedagógico de la IA</h4>
                  <div className="feedback-box">{selectedSub.final_feedback}</div>
                </div>
              )}
              {selectedSub.toulmin_analysis && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 className="section-title"><Layers size={16} /> Desglose del Modelo de Toulmin</h4>
                  <div className="toulmin-grid">
                    <div className="toulmin-item"><span className="toulmin-tag" style={{ backgroundColor: 'hsl(var(--primary-color) / 0.15)', color: 'hsl(var(--primary-color))' }}>1. Pretensión (Claim)</span><p className="toulmin-text">{selectedSub.toulmin_analysis.claim || 'No especificada.'}</p></div>
                    <div className="toulmin-item"><span className="toulmin-tag" style={{ backgroundColor: 'hsl(var(--accent-color) / 0.15)', color: 'hsl(var(--accent-color))' }}>2. Datos (Data)</span><p className="toulmin-text">{selectedSub.toulmin_analysis.data || 'No especificados.'}</p></div>
                    <div className="toulmin-item"><span className="toulmin-tag" style={{ backgroundColor: 'hsl(var(--warning-color) / 0.15)', color: 'hsl(var(--warning-color))' }}>3. Garantía (Warrant)</span><p className="toulmin-text">{selectedSub.toulmin_analysis.warrant || 'No especificada.'}</p></div>
                    <div className="toulmin-item"><span className="toulmin-tag" style={{ backgroundColor: 'hsl(var(--success-color) / 0.15)', color: 'hsl(var(--success-color))' }}>4. Respaldo (Backing)</span><p className="toulmin-text">{selectedSub.toulmin_analysis.backing || 'No especificado.'}</p></div>
                    <div className="toulmin-item"><span className="toulmin-tag" style={{ backgroundColor: 'hsl(280 80% 60% / 0.15)', color: 'hsl(280 80% 65%)' }}>5. Refutación (Rebuttal)</span><p className="toulmin-text">{selectedSub.toulmin_analysis.rebuttal || 'No especificada.'}</p></div>
                    <div className="toulmin-item"><span className="toulmin-tag" style={{ backgroundColor: 'hsl(190 80% 50% / 0.15)', color: 'hsl(190 80% 50%)' }}>6. Cualificador (Qualifier)</span><p className="toulmin-text">{selectedSub.toulmin_analysis.qualifier || 'No especificado.'}</p></div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedSub(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
