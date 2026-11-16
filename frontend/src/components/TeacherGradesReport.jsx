import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users, RotateCcw, X
} from 'lucide-react';

export default function TeacherGradesReport({ preselectedClassId }) {
  const { authFetch } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(preselectedClassId || null);
  const [reportData, setReportData] = useState(null);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [selectedStudentSubmissions, setSelectedStudentSubmissions] = useState(null);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadReport(selectedClassId);
    }
  }, [selectedClassId]);

  const loadClasses = async () => {
    setIsLoadingClasses(true);
    try {
      const res = await authFetch('/api/classes/my');
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
        if (data.length > 0 && !selectedClassId) {
          setSelectedClassId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error cargando clases del docente:", err);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  const loadReport = async (classId) => {
    setIsLoadingReport(true);
    try {
      const res = await authFetch(`/api/classes/${classId}/report`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error("Error cargando reporte de notas:", err);
    } finally {
      setIsLoadingReport(false);
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
    if (score === 0) return "Sin entregas";
    if (score <= 1.9) return "Muy bajo";
    if (score <= 2.9) return "Bajo";
    if (score <= 3.9) return "Medio";
    if (score <= 4.9) return "Alto";
    return "Excelente";
  };

  const formatDate = (isoStr) => {
    try {
      return new Date(isoStr).toLocaleDateString('es-PE', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="tab-pane-container">
      <div className="pane-header-box">
        <div>
          <h2 className="pane-title">Reporte de Calificaciones por Clase</h2>
          <p className="pane-subtitle">
            Monitoreo en tiempo real de las posturas argumentativas y dictámenes de los alumnos inscritos.
          </p>
        </div>

        {selectedClassId && (
          <button
            className="btn-secondary"
            onClick={() => loadReport(selectedClassId)}
            title="Actualizar reporte"
          >
            <RotateCcw size={15} />
            Actualizar
          </button>
        )}
      </div>

      {/* Class selector */}
      <div className="class-selector-bar info-card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Seleccionar Clase:</span>
          {isLoadingClasses ? (
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Cargando clases...</span>
          ) : classes.length === 0 ? (
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--warning-color))' }}>
              No tienes clases creadas aún. Crea una en la pestaña <strong>"Mis Clases"</strong>.
            </span>
          ) : (
            <select
              className="search-input"
              style={{ minWidth: '280px', padding: '0.5rem 0.85rem' }}
              value={selectedClassId || ''}
              onChange={(e) => setSelectedClassId(Number(e.target.value))}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.code}) - {c.enrolled_students} alumnos
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Report Table */}
      {isLoadingReport ? (
        <div className="loading-box info-card">
          <div className="loading-spinner"></div>
          <span>Generando cuadro de calificaciones...</span>
        </div>
      ) : !reportData || reportData.students.length === 0 ? (
        <div className="empty-state-card">
          <Users size={36} style={{ opacity: 0.4, margin: '0 auto 0.75rem auto' }} />
          <h4>No hay alumnos matriculados en esta clase</h4>
          <p>
            Comparte el código <strong>{reportData?.class_code}</strong> con tus estudiantes para que se vinculen a tu clase.
          </p>
        </div>
      ) : (
        <div className="grades-table-card info-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{reportData.class_title}</h3>
              <span style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))' }}>
                Código de Clase: <strong>{reportData.class_code}</strong> | Total matriculados: <strong>{reportData.total_enrolled}</strong>
              </span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="grades-table">
              <thead>
                <tr>
                  <th>ID Institucional</th>
                  <th>Alumno</th>
                  <th>Correo</th>
                  <th style={{ textAlign: 'center' }}>Casos Resueltos</th>
                  <th style={{ textAlign: 'center' }}>Promedio Ponderado</th>
                  <th style={{ textAlign: 'center' }}>Nivel</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reportData.students.map((st) => {
                  const scoreColor = getScoreColor(st.average_score);
                  const nivel = getNivel(st.average_score);

                  return (
                    <tr key={st.student_id}>
                      <td>
                        <span className="user-code-pill" data-role="alumno">
                          {st.user_code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{st.full_name}</td>
                      <td style={{ color: 'hsl(var(--text-secondary))' }}>{st.email}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        {st.total_cases_resolved}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, color: scoreColor, fontSize: '1.05rem' }}>
                          {st.total_cases_resolved > 0 ? st.average_score.toFixed(2) : '-'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="case-badge" style={{ color: scoreColor, borderColor: scoreColor }}>
                          {nivel}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                          disabled={st.total_cases_resolved === 0}
                          onClick={() => setSelectedStudentSubmissions(st)}
                        >
                          Ver Entregas ({st.total_cases_resolved})
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal para ver detalle de entregas del alumno */}
      {selectedStudentSubmissions && (
        <div className="modal-overlay" onClick={() => setSelectedStudentSubmissions(null)}>
          <div className="modal-card-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="user-code-pill" data-role="alumno" style={{ marginBottom: '0.4rem', display: 'inline-flex' }}>
                  {selectedStudentSubmissions.user_code}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  Entregas de {selectedStudentSubmissions.full_name}
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))' }}>
                  Promedio general: <strong>{selectedStudentSubmissions.average_score.toFixed(2)} / 5.00</strong> ({selectedStudentSubmissions.total_cases_resolved} casos resueltos)
                </span>
              </div>
              <button className="btn-icon-close" onClick={() => setSelectedStudentSubmissions(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body-scroll">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedStudentSubmissions.submissions.map((sub, i) => (
                  <div key={sub.id || i} className="info-card" style={{ borderLeft: `4px solid ${getScoreColor(sub.score_total)}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{sub.case_title}</h4>
                        <span style={{ fontSize: '0.76rem', color: 'hsl(var(--text-muted))' }}>
                          Evaluado el {formatDate(sub.created_at)}
                        </span>
                      </div>
                      <div className="history-score-badge" style={{ borderColor: getScoreColor(sub.score_total), color: getScoreColor(sub.score_total) }}>
                        <span className="score-num">{sub.score_total.toFixed(2)}</span>
                        <span className="score-nivel">{getNivel(sub.score_total)}</span>
                      </div>
                    </div>

                    {/* Rubric scores */}
                    <div className="history-rubric-mini-grid" style={{ marginBottom: '0.75rem' }}>
                      <div className="rubric-mini-chip">
                        <span className="chip-name">Estructura</span>
                        <span className="chip-val">{sub.rubric_scores?.estructura_logica || '-'}/5</span>
                      </div>
                      <div className="rubric-mini-chip">
                        <span className="chip-name">Relevancia</span>
                        <span className="chip-val">{sub.rubric_scores?.relevancia_pertinencia || '-'}/5</span>
                      </div>
                      <div className="rubric-mini-chip">
                        <span className="chip-name">Consistencia</span>
                        <span className="chip-val">{sub.rubric_scores?.consistencia_logica || '-'}/5</span>
                      </div>
                      <div className="rubric-mini-chip">
                        <span className="chip-name">Cohesión</span>
                        <span className="chip-val">{sub.rubric_scores?.cohesion_calidad || '-'}/5</span>
                      </div>
                    </div>

                    {/* Argumento */}
                    <div style={{ marginBottom: '0.65rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase' }}>
                        Postura Argumentativa Dictada:
                      </span>
                      <p style={{ fontSize: '0.88rem', fontStyle: 'italic', color: 'hsl(var(--text-primary))', marginTop: '0.2rem' }}>
                        "{sub.student_argument}"
                      </p>
                    </div>

                    {/* Feedback */}
                    {sub.final_feedback && (
                      <div style={{ background: 'hsl(var(--bg-color-tertiary))', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                        <strong>Observaciones de la IA:</strong> {sub.final_feedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedStudentSubmissions(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
