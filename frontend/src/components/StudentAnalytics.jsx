import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3, TrendingUp, Award, Target, CheckCircle2,
  AlertTriangle, RotateCcw
} from 'lucide-react';

export default function StudentAnalytics() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/evaluations/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error cargando analíticas:", err);
    } finally {
      setIsLoading(false);
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

  if (isLoading) {
    return (
      <div className="tab-pane-container">
        <div className="loading-box info-card" style={{ marginTop: '1.5rem' }}>
          <div className="loading-spinner"></div>
          <span>Calculando tus métricas de desempeño jurídico...</span>
        </div>
      </div>
    );
  }

  if (!stats || stats.total_cases_resolved === 0) {
    return (
      <div className="tab-pane-container">
        <div className="empty-state-card">
          <BarChart3 size={40} style={{ opacity: 0.4, margin: '0 auto 0.75rem auto' }} />
          <h3>Sin datos suficientes para gráficos</h3>
          <p>
            Resuelve casos en la sección <strong>"Resolver Casos"</strong> para generar tus métricas de consistencia,
            evolución de notas y análisis por criterios de la rúbrica.
          </p>
        </div>
      </div>
    );
  }

  const {
    total_cases_resolved,
    average_general,
    criteria_averages,
    timeline,
    performance_levels
  } = stats;

  // Encontrar criterio más fuerte y más débil
  const criteriaList = [
    { key: 'estructura_logica', label: 'Estructura Lógica', val: criteria_averages.estructura_logica },
    { key: 'relevancia_pertinencia', label: 'Relevancia y Pertinencia', val: criteria_averages.relevancia_pertinencia },
    { key: 'consistencia_logica', label: 'Consistencia Lógica', val: criteria_averages.consistencia_logica },
    { key: 'cohesion_calidad', label: 'Cohesión Discursiva', val: criteria_averages.cohesion_calidad },
  ];

  criteriaList.sort((a, b) => b.val - a.val);
  const bestCriteria = criteriaList[0];
  const lowestCriteria = criteriaList[criteriaList.length - 1];

  // Configuración SVG para el gráfico de línea temporal
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 30;

  const points = timeline.map((pt, index) => {
    const x = timeline.length === 1
      ? svgWidth / 2
      : paddingX + (index / (timeline.length - 1)) * (svgWidth - paddingX * 2);
    // score 0 a 5 -> invertido para SVG (y = 0 arriba)
    const y = svgHeight - paddingY - (pt.score / 5) * (svgHeight - paddingY * 2);
    return { ...pt, x, y };
  });

  const pathD = points.length === 1
    ? `M ${points[0].x} ${points[0].y}`
    : points.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');

  const areaD = points.length > 1
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : '';

  return (
    <div className="tab-pane-container">
      <div className="pane-header-box">
        <div>
          <h2 className="pane-title">Panel de Desempeño y Analítica</h2>
          <p className="pane-subtitle">
            Monitoreo gráfico de tu progreso y consolidación en argumentación jurídica.
          </p>
        </div>
        <button className="btn-secondary" onClick={fetchStats} title="Recalcular métricas">
          <RotateCcw size={15} />
          Actualizar
        </button>
      </div>

      {/* 1. Summary Hero KPI Cards */}
      <div className="analytics-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-pill" style={{ color: 'hsl(var(--primary-color))', backgroundColor: 'hsl(var(--primary-color) / 0.12)' }}>
            <Award size={20} />
          </div>
          <div className="kpi-value">{average_general.toFixed(2)}</div>
          <div className="kpi-label">Promedio General Ponderado</div>
          <div className="kpi-sub" style={{ color: getScoreColor(average_general) }}>
            Nivel: {getNivel(average_general)}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-pill" style={{ color: 'hsl(var(--accent-color))', backgroundColor: 'hsl(var(--accent-color) / 0.12)' }}>
            <Target size={20} />
          </div>
          <div className="kpi-value">{total_cases_resolved}</div>
          <div className="kpi-label">Casos Evaluados</div>
          <div className="kpi-sub">Total de participaciones registradas</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-pill" style={{ color: 'hsl(var(--success-color))', backgroundColor: 'hsl(var(--success-color) / 0.12)' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.25rem' }}>{bestCriteria.label}</div>
          <div className="kpi-label">Mayor Fortaleza</div>
          <div className="kpi-sub" style={{ color: getScoreColor(bestCriteria.val) }}>
            Promedio: {bestCriteria.val.toFixed(2)} / 5.0
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-pill" style={{ color: 'hsl(var(--warning-color))', backgroundColor: 'hsl(var(--warning-color) / 0.12)' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.25rem' }}>{lowestCriteria.label}</div>
          <div className="kpi-label">Oportunidad de Mejora</div>
          <div className="kpi-sub" style={{ color: getScoreColor(lowestCriteria.val) }}>
            Promedio: {lowestCriteria.val.toFixed(2)} / 5.0
          </div>
        </div>
      </div>

      {/* 2. Gráfico de Evolución Temporal (Timeline SVG) */}
      <div className="chart-card info-card">
        <div className="chart-header">
          <div>
            <h3 className="section-title" style={{ margin: 0 }}>
              <TrendingUp size={18} />
              Evolución Temporal de Calificaciones
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginTop: '0.2rem' }}>
              Puntaje promedio obtenido en cada caso resuelto cronológicamente.
            </p>
          </div>
        </div>

        <div className="svg-chart-container">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="analytics-svg">
            <defs>
              <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary-color))" stopOpacity="0.35" />
                <stop offset="100%" stopColor="hsl(var(--primary-color))" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid horizontal lines */}
            {[1, 2, 3, 4, 5].map((lvl) => {
              const y = svgHeight - paddingY - (lvl / 5) * (svgHeight - paddingY * 2);
              return (
                <g key={lvl}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={svgWidth - paddingX}
                    y2={y}
                    stroke="hsl(var(--border-color))"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingX - 10}
                    y={y + 4}
                    fill="hsl(var(--text-muted))"
                    fontSize="10"
                    textAnchor="end"
                  >
                    {lvl}.0
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            {areaD && <path d={areaD} fill="url(#scoreAreaGradient)" />}

            {/* Main trend line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="hsl(var(--primary-color))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points */}
            {points.map((pt, i) => (
              <g key={i}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={5}
                  fill="hsl(var(--bg-card))"
                  stroke={getScoreColor(pt.score)}
                  strokeWidth="3"
                />
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  fill={getScoreColor(pt.score)}
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {pt.score.toFixed(1)}
                </text>
                <text
                  x={pt.x}
                  y={svgHeight - 10}
                  fill="hsl(var(--text-secondary))"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {pt.date}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="analytics-double-grid">
        {/* 3. Gráfico de Promedios por Criterio de la Rúbrica */}
        <div className="chart-card info-card">
          <h3 className="section-title">
            <Target size={18} />
            Promedios por Criterio de la Rúbrica
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.25rem' }}>
            Desempeño acumulado en las 4 dimensiones de argumentación jurídica (escala 1 a 5).
          </p>

          <div className="criteria-bars-list">
            {[
              { key: 'estructura_logica', label: 'Estructura Lógica', desc: 'Premisas y conclusión' },
              { key: 'relevancia_pertinencia', label: 'Relevancia y Pertinencia', desc: 'Ajuste al caso y leyes peruanas' },
              { key: 'consistencia_logica', label: 'Consistencia Lógica', desc: 'Solidez sin falacias' },
              { key: 'cohesion_calidad', label: 'Cohesión Discursiva', desc: 'Claridad y vocabulario forense' },
            ].map((c) => {
              const val = criteria_averages[c.key] || 0;
              const percentage = Math.max((val / 5) * 100, val > 0 ? 20 : 0);
              const color = getScoreColor(val);

              return (
                <div key={c.key} className="criteria-progress-row">
                  <div className="criteria-row-header">
                    <div>
                      <span className="criteria-title">{c.label}</span>
                      <span className="criteria-desc">{c.desc}</span>
                    </div>
                    <span className="criteria-score-val" style={{ color }}>
                      {val.toFixed(2)} <small>/ 5.00</small>
                    </span>
                  </div>
                  <div className="rubric-score-bar-bg" style={{ height: '10px' }}>
                    <div
                      className="rubric-score-bar-fill"
                      style={{ width: `${percentage}%`, backgroundColor: color }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Gráfico de Distribución de Niveles de Desempeño */}
        <div className="chart-card info-card">
          <h3 className="section-title">
            <BarChart3 size={18} />
            Distribución de Niveles de Logro
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.25rem' }}>
            Frecuencia de calificaciones agrupadas por nivel de competencia.
          </p>

          <div className="levels-distribution-list">
            {[
              { name: 'Excelente', range: '5.00', color: 'hsl(var(--level-5))' },
              { name: 'Alto', range: '4.00 - 4.99', color: 'hsl(var(--level-4))' },
              { name: 'Medio', range: '3.00 - 3.99', color: 'hsl(var(--level-3))' },
              { name: 'Bajo', range: '2.00 - 2.99', color: 'hsl(var(--level-2))' },
              { name: 'Muy bajo', range: '1.00 - 1.99', color: 'hsl(var(--level-1))' },
            ].map((lvl) => {
              const count = performance_levels[lvl.name] || 0;
              const pct = total_cases_resolved > 0 ? (count / total_cases_resolved) * 100 : 0;

              return (
                <div key={lvl.name} className="level-distribution-item">
                  <div className="level-item-info">
                    <span className="level-name-dot" style={{ backgroundColor: lvl.color }}></span>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{lvl.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>({lvl.range})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="level-bar-container">
                      <div
                        className="level-bar-fill"
                        style={{ width: `${pct}%`, backgroundColor: lvl.color }}
                      ></div>
                    </div>
                    <span style={{ minWidth: '40px', textAlign: 'right', fontSize: '0.82rem', fontWeight: 700 }}>
                      {count} {count === 1 ? 'caso' : 'casos'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
