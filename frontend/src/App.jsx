import { useState, useEffect, useRef } from 'react';
import { useAuth, AuthProvider, API_BASE } from './context/AuthContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import AccessibilityMenu from './components/AccessibilityMenu';
import StudentHistory from './components/StudentHistory';
import StudentAnalytics from './components/StudentAnalytics';
import StudentClassJoin from './components/StudentClassJoin';
import TeacherClasses from './components/TeacherClasses';
import TeacherGradesReport from './components/TeacherGradesReport';
import TeacherCaseManager from './components/TeacherCaseManager';
import {
  Search, Mic, MicOff, Send, Scale, BookOpen, AlertCircle,
  CheckCircle2, Copy, Check, RotateCcw, ArrowLeft,
  FileText, HelpCircle, Layers, Edit3,
  ChevronDown, ChevronUp, X, Sparkles
} from 'lucide-react';
import './index.css';

function MainApp() {
  const { user, authFetch } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [activeTab, setActiveTab] = useState('casos');
  const [selectedClassIdForReport, setSelectedClassIdForReport] = useState(null);

  // Set default tab based on user role
  useEffect(() => {
    if (user) {
      if (user.role === 'docente') {
        setActiveTab('clases');
      } else {
        setActiveTab('casos');
      }
    }
  }, [user?.role]);

  // Case Solving State
  const [cases, setCases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');

  // Argument & Evaluation State
  const [argumentText, setArgumentText] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Voice Dictation State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [dictationMode, setDictationMode] = useState('none');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);

  // Collapsible reference guides (Plantilla & Ejemplo)
  const [showTemplate, setShowTemplate] = useState(false);
  const [showExample, setShowExample] = useState(false);

  // Audio Refs
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const baseTextBeforeRecordingRef = useRef('');
  const mediaStreamRef = useRef(null);
  const isCanceledRef = useRef(false);

  // 1. Initial health and cases load
  useEffect(() => {
    checkHealthAndFetchCases();
  }, [user]);

  const checkHealthAndFetchCases = async () => {
    try {
      setBackendStatus('checking');
      const healthRes = await fetch(`${API_BASE}/api/health`);
      if (healthRes.ok) {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }

    try {
      const casesRes = await authFetch('/api/cases');
      if (casesRes.ok) {
        const data = await casesRes.json();
        setCases(data);
      }
    } catch (err) {
      console.error("Error cargando casos:", err);
    }
  };

  // Recording Timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  useEffect(() => {
    return () => {
      cancelDictation();
    };
  }, []);

  const filteredCases = cases.filter(c => {
    const term = searchTerm.toLowerCase();
    const titleMatch = (c.titulo || '').toLowerCase().includes(term);
    const statementMatch = (c.enunciado || '').toLowerCase().includes(term);
    const authorMatch = (c.teacher_name || '').toLowerCase().includes(term);
    return titleMatch || statementMatch || authorMatch;
  });

  // Voice Dictation Methods
  const startDictation = async () => {
    setErrorMessage('');
    isCanceledRef.current = false;
    baseTextBeforeRecordingRef.current = argumentText;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-PE';

        recognition.onstart = () => {
          if (isCanceledRef.current) {
            try { recognition.abort(); } catch { }
            return;
          }
          setIsRecording(true);
          setDictationMode('webspeech');
        };

        recognition.onresult = (event) => {
          if (isCanceledRef.current) return;
          let currentSessionText = '';
          for (let i = 0; i < event.results.length; i++) {
            currentSessionText += event.results[i][0].transcript;
          }

          const prefix = baseTextBeforeRecordingRef.current.trim()
            ? baseTextBeforeRecordingRef.current.trim() + ' '
            : '';
          setArgumentText(prefix + currentSessionText);
        };

        recognition.onerror = (event) => {
          if (isCanceledRef.current) return;
          console.warn("SpeechRecognition error:", event.error);
          if (event.error === 'not-allowed') {
            setErrorMessage('Permiso de micrófono denegado. Habilita el acceso al micrófono en tu navegador.');
            stopDictation();
          } else if (event.error === 'no-speech') {
            // sigue escuchando
          } else {
            stopSpeechRecognition();
            startMediaRecorderFallback();
          }
        };

        recognition.onend = () => {
          if (isCanceledRef.current) {
            setIsRecording(false);
            setDictationMode('none');
            return;
          }
          if (recognitionRef.current && isRecording) {
            try {
              recognition.start();
            } catch {
              setIsRecording(false);
              setDictationMode('none');
            }
          } else {
            setIsRecording(false);
            setDictationMode('none');
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (err) {
        console.warn("SpeechRecognition error, fallback a MediaRecorder:", err);
      }
    }

    startMediaRecorderFallback();
  };

  const startMediaRecorderFallback = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('Tu navegador no soporta grabación de audio ni dictado por voz.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (!isCanceledRef.current && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;

        if (isCanceledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 0) {
          await sendAudioToDeepgram(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDictationMode('mediarecorder');
    } catch (err) {
      console.error("Error micrófono:", err);
      setErrorMessage('No se pudo acceder al micrófono. Por favor verifica los permisos.');
      setIsRecording(false);
      setDictationMode('none');
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec.stop();
      } catch { }
    }
  };

  const stopDictation = () => {
    setIsRecording(false);
    if (dictationMode === 'webspeech') {
      stopSpeechRecognition();
    } else if (dictationMode === 'mediarecorder') {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
    setDictationMode('none');
  };

  const cancelDictation = () => {
    isCanceledRef.current = true;
    setIsRecording(false);
    setDictationMode('none');
    setRecordingSeconds(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec.abort();
      } catch { }
    }

    if (mediaRecorderRef.current) {
      const mr = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      try {
        if (mr.state !== 'inactive') {
          mr.stop();
        }
      } catch { }
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      } catch { }
      mediaStreamRef.current = null;
    }

    audioChunksRef.current = [];
    setArgumentText(baseTextBeforeRecordingRef.current);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopDictation();
    } else {
      startDictation();
    }
  };

  const sendAudioToDeepgram = async (audioBlob) => {
    setIsTranscribing(true);
    setLoadingStep('Transcribiendo audio con Deepgram...');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result.split(',')[1];
        const response = await fetch(`${API_BASE}/api/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_base64: base64Audio,
            mime_type: audioBlob.type || 'audio/webm'
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Error en transcripción');
        }

        const data = await response.json();
        if (data.text) {
          setArgumentText(prev => {
            const prefix = prev.trim() ? prev.trim() + ' ' : '';
            return prefix + data.text;
          });
        }
        setIsTranscribing(false);
      };
    } catch (error) {
      console.error("Error enviando audio:", error);
      setErrorMessage(`Error transcribiendo: ${error.message}`);
      setIsTranscribing(false);
    }
  };

  // Evaluation
  const handleEvaluate = async () => {
    if (!argumentText.trim() || !selectedCase) return;

    setIsLoading(true);
    setErrorMessage('');
    setEvaluation(null);
    setLoadingStep('Recuperando contexto legal y leyes peruanas...');

    try {
      const stepTimer1 = setTimeout(() => {
        setLoadingStep('Extrayendo componentes con Modelo de Toulmin...');
      }, 2500);

      const stepTimer2 = setTimeout(() => {
        setLoadingStep('Calificando con los 4 criterios de la Rúbrica Jurídica...');
      }, 5500);

      const response = await authFetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: selectedCase.id,
          student_argument: argumentText
        })
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Error en servidor (${response.status})`);
      }

      const data = await response.json();
      setEvaluation(data);
    } catch (error) {
      console.error("Error evaluando:", error);
      setErrorMessage(`No se pudo completar la evaluación: ${error.message}`);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleCopyEvaluation = () => {
    if (!evaluation) return;
    const scores = evaluation.rubric_scores || {};
    const textToCopy =
      `--- DICTAMEN DE EVALUACIÓN ARGUMENTATIVA ---
Caso: ${selectedCase?.titulo}

${evaluation.final_feedback}

--- ANÁLISIS DEL MODELO DE TOULMIN ---
• Pretensión (Claim): ${evaluation.toulmin_analysis?.claim}
• Datos (Data): ${evaluation.toulmin_analysis?.data}
• Garantía (Warrant): ${evaluation.toulmin_analysis?.warrant}
• Respaldo (Backing): ${evaluation.toulmin_analysis?.backing}
• Refutación (Rebuttal): ${evaluation.toulmin_analysis?.rebuttal}
• Cualificador (Qualifier): ${evaluation.toulmin_analysis?.qualifier}

--- PUNTAJES POR CRITERIO ---
• Estructura Lógica: ${scores.estructura_logica || '-'}/5
• Relevancia y Pertinencia: ${scores.relevancia_pertinencia || '-'}/5
• Consistencia Lógica: ${scores.consistencia_logica || '-'}/5
• Cohesión y Calidad: ${scores.cohesion_calidad || '-'}/5`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formatSeconds = (sec) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score) => {
    if (score >= 4.5) return 'hsl(var(--level-5))';
    if (score >= 3.5) return 'hsl(var(--level-4))';
    if (score >= 2.5) return 'hsl(var(--level-3))';
    if (score >= 1.5) return 'hsl(var(--level-2))';
    return 'hsl(var(--level-1))';
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => setShowAuthModal(true)}
        isGuest={!user && isGuest}
        onLogout={() => {
          setIsGuest(false);
          setActiveTab('casos');
        }}
      />

      {/* Auth Modal when requested or if user clicks login */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onEnterGuest={() => {
            setIsGuest(true);
            setShowAuthModal(false);
            setActiveTab('casos');
          }}
          onLoginSuccess={() => {
            setShowAuthModal(false);
          }}
        />
      )}

      {/* Backend Offline Warning */}
      {backendStatus === 'offline' && (
        <div className="alert-banner warning" style={{ margin: '1rem 0' }}>
          <AlertCircle size={20} />
          <div>
            <strong>Servidor Backend no detectado en puerto 8000.</strong><br />
            Verifica que uvicorn esté ejecutándose: <code>uvicorn main:app --reload --port 8000</code>.
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="alert-banner error" style={{ margin: '1rem 0' }}>
          <AlertCircle size={20} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Standalone Authentication View when not authenticated and not entered as guest */}
      {!user && !isGuest ? (
        <div className="auth-standalone-container">
          <AuthModal
            isStandalone={true}
            onEnterGuest={() => {
              setIsGuest(true);
              setActiveTab('casos');
            }}
            onLoginSuccess={() => {
              // Context will automatically update user
            }}
          />
        </div>
      ) : (
        <>
          {/* Guest reminder banner when user is browsing as a guest */}
          {!user && isGuest && (
            <div className="guest-welcome-banner info-card" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.2rem' }}>
                    Estás navegando en modo invitado
                  </h3>
                  <p style={{ fontSize: '0.86rem', color: 'hsl(var(--text-secondary))' }}>
                    Puedes resolver y evaluar casos jurídicos por dictado de voz. Para guardar tu historial institucional o vincularte a una clase, inicia sesión o regístrate.
                  </p>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => setShowAuthModal(true)}
                >
                  Iniciar Sesión / Registro
                </button>
              </div>
            </div>
          )}

          {/* ROUTING BY ROLE AND ACTIVE TAB */}

      {/* DOCENTE VIEWS */}
      {user && user.role === 'docente' && (
        <>
          {activeTab === 'clases' && (
            <TeacherClasses
              onSelectClassReport={(classId) => {
                setSelectedClassIdForReport(classId);
                setActiveTab('reporte');
              }}
            />
          )}

          {activeTab === 'reporte' && (
            <TeacherGradesReport
              preselectedClassId={selectedClassIdForReport}
            />
          )}

          {activeTab === 'gestor_casos' && (
            <TeacherCaseManager />
          )}
        </>
      )}

      {/* ALUMNO VIEWS (OR GUEST VIEW) */}
      {(!user || user.role === 'alumno') && (
        <>
          {activeTab === 'historial' && user && (
            <StudentHistory />
          )}

          {activeTab === 'desempeno' && user && (
            <StudentAnalytics />
          )}

          {activeTab === 'clase' && user && (
            <StudentClassJoin />
          )}

          {activeTab === 'casos' && (
            <>
              {/* Cases List View */}
              {!selectedCase ? (
                <>
                  <div className="search-container">
                    <Search
                      style={{ position: 'absolute', left: '1rem', top: '1.05rem', color: 'hsl(var(--text-muted))' }}
                      size={18}
                    />
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Buscar por caso, palabras clave o docente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="cases-count-badge">
                    <span>Mostrando {filteredCases.length} de {cases.length} casos jurídicos</span>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        style={{ background: 'none', border: 'none', color: 'hsl(var(--primary-color))', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        Limpiar filtro
                      </button>
                    )}
                  </div>

                  <div className="cases-list">
                    {filteredCases.map(c => (
                      <div
                        key={c.id}
                        className="case-card"
                        onClick={() => {
                          setSelectedCase(c);
                          setEvaluation(null);
                          setArgumentText('');
                          setIsEditingText(false);
                          setShowTemplate(false);
                          setShowExample(false);
                          setErrorMessage('');
                          cancelDictation();
                        }}
                      >
                        <div className="case-card-header">
                          <div>
                            <h3 className="case-title">{c.titulo}</h3>
                            {!c.is_default && c.teacher_name && (
                              <div className="case-published-by-tag">
                                Caso publicado por {c.teacher_name}
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="case-preview">{c.enunciado}</p>
                      </div>
                    ))}

                    {filteredCases.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'hsl(var(--text-secondary))' }}>
                        <HelpCircle size={36} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                        <p>No se encontraron casos que coincidan con la búsqueda "{searchTerm}".</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Case Details & Voice Dictation Workspace */
                <div className="case-detail-container">
                  <button
                    className="back-button"
                    onClick={() => {
                      cancelDictation();
                      setSelectedCase(null);
                      setIsEditingText(false);
                      setShowTemplate(false);
                      setShowExample(false);
                    }}
                  >
                    <ArrowLeft size={16} />
                    Volver a la lista de casos
                  </button>

                  {/* Case Info Card */}
                  <div className="info-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div>
                        <h2 style={{ fontSize: '1.35rem', fontWeight: '800' }}>{selectedCase.titulo}</h2>
                        {!selectedCase.is_default && selectedCase.teacher_name && (
                          <div className="case-published-by-tag" style={{ marginTop: '0.2rem' }}>
                            Caso publicado por {selectedCase.teacher_name}
                          </div>
                        )}
                      </div>
                    </div>

                    <p style={{ color: 'hsl(var(--text-primary))', marginBottom: '1.25rem', fontSize: '0.98rem', lineHeight: '1.6' }}>
                      {selectedCase.enunciado}
                    </p>

                    {/* Contexto del caso */}
                    {selectedCase.contexto && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid hsl(var(--border-color))' }}>
                        <h4 className="section-title">
                          <FileText size={16} />
                          Contexto y Antecedentes
                        </h4>
                        {Array.isArray(selectedCase.contexto) ? (
                          <ul className="bullet-list">
                            {selectedCase.contexto.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', lineHeight: '1.55' }}>
                            {selectedCase.contexto}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Hechos Relevantes (si existen) */}
                    {selectedCase.hechos_relevantes && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid hsl(var(--border-color))' }}>
                        <h4 className="section-title">
                          <CheckCircle2 size={16} />
                          Hechos Relevantes
                        </h4>
                        <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', lineHeight: '1.55', whiteSpace: 'pre-line' }}>
                          {selectedCase.hechos_relevantes}
                        </p>
                      </div>
                    )}

                    {/* Soporte Jurídico (si existe) */}
                    {selectedCase.soporte_juridico && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid hsl(var(--border-color))' }}>
                        <h4 className="section-title">
                          <Scale size={16} />
                          Soporte Constitucional y Jurídico Sugerido
                        </h4>
                        <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', lineHeight: '1.55', whiteSpace: 'pre-line' }}>
                          {selectedCase.soporte_juridico}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Guías Desplegables de Consulta (Plantilla y Ejemplo) */}
                  <div className="reference-guides-container">
                    <div className="accordion-card">
                      <button
                        className="accordion-header"
                        onClick={() => setShowTemplate(prev => !prev)}
                        type="button"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <FileText size={17} style={{ color: 'hsl(var(--primary-color))' }} />
                          <span style={{ fontWeight: '700', fontSize: '0.92rem' }}>
                            Plantilla de Estructura Argumentativa
                          </span>
                        </div>
                        {showTemplate ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>

                      {showTemplate && (
                        <div className="accordion-content">
                          <p className="accordion-description">
                            Estructura lógica sugerida para tu argumentación oral (modelo Stephen Toulmin):
                          </p>
                          <div className="template-grid">
                            <div className="template-item">
                              <span className="template-badge badge-claim">[1. Postura / Afirmación Inicial]</span>
                              <p className="template-text">Sostengo que... (Expón con claridad tu posición jurídica frente al conflicto).</p>
                            </div>
                            <div className="template-item">
                              <span className="template-badge badge-data">[2. Hechos del Caso]</span>
                              <p className="template-text">En este caso se evidencia que... (Detalla los antecedentes fácticos relevantes).</p>
                            </div>
                            <div className="template-item">
                              <span className="template-badge badge-warrant">[3. Garantía Lógica]</span>
                              <p className="template-text">Todo acto o derecho exige que... (Regla o principio general que une los hechos con la conclusión).</p>
                            </div>
                            <div className="template-item">
                              <span className="template-badge badge-backing">[4. Respaldo Normativo]</span>
                              <p className="template-text">De conformidad con la Constitución / Código Civil peruano... (Cita artículos de ley o jurisprudencia).</p>
                            </div>
                            <div className="template-item">
                              <span className="template-badge badge-rebuttal">[5. Reserva o Salvedad]</span>
                              <p className="template-text">Si bien la contraparte argumenta..., carece de sustento porque... (Anticipa objeciones o contraargumentos).</p>
                            </div>
                            <div className="template-item">
                              <span className="template-badge badge-conclusion">[6. Conclusión]</span>
                              <p className="template-text">Por lo tanto, concluyo que... (Cierre categórico y consistente con las premisas).</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="accordion-card">
                      <button
                        className="accordion-header"
                        onClick={() => setShowExample(prev => !prev)}
                        type="button"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <FileText size={17} style={{ color: 'hsl(var(--primary-color))' }} />
                          <span style={{ fontWeight: '700', fontSize: '0.92rem' }}>
                            Ejemplo de Argumentación Jurídica
                          </span>
                        </div>
                        {showExample ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>

                      {showExample && (
                        <div className="accordion-content">
                          <p className="accordion-description">
                            Ejemplo de discurso oral sólido para ilustrar el orden de las premisas (texto de consulta no editable):
                          </p>
                          <div className="example-text-box">
                            “Considero que en el presente caso el contrato verbal carece de eficacia y validez vinculante plena respecto a las condiciones pretendidas. En primer lugar, de acuerdo con los hechos, no existió una manifestación de voluntad expresa ni un consentimiento indubitable sobre las prestaciones esenciales del servicio. Conforme a las normas del Código Civil peruano sobre la validez del acto jurídico y formación del consentimiento contractual, para que surja una obligación debe mediar acuerdo sobre los elementos esenciales. Aunque la contraparte apele a una supuesta intención tácita, esta resulta insuficiente ante la discrepancia probatoria. Por tanto, no puede exigirse el cumplimiento forzoso del acuerdo en las condiciones controvertidas.”
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Student Argument Workspace */}
                  <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h3 className="section-title" style={{ margin: 0 }}>
                        <BookOpen size={17} style={{ color: 'hsl(var(--primary-color))' }} />
                        Tu Sustento y Postura Jurídica
                      </h3>
                    </div>

                    {/* Dictation Live Status Banner */}
                    {isRecording && (
                      <div className="dictation-status-bar active">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div className="sound-waves">
                            <span className="sound-bar"></span>
                            <span className="sound-bar"></span>
                            <span className="sound-bar"></span>
                            <span className="sound-bar"></span>
                            <span className="sound-bar"></span>
                          </div>
                          <strong>
                            {dictationMode === 'webspeech' ? 'Escuchando y transcribiendo en vivo...' : 'Grabando audio para Deepgram...'}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', marginRight: '0.25rem' }}>
                            {formatSeconds(recordingSeconds)}
                          </span>
                          <button
                            className="btn-stop-recording"
                            onClick={stopDictation}
                            title="Detener dictado y procesar el argumento"
                          >
                            <MicOff size={15} />
                            Detener
                          </button>
                          <button
                            className="btn-cancel-recording"
                            onClick={cancelDictation}
                            title="Cancelar grabación y descartar lo hablado"
                          >
                            <X size={15} />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {isTranscribing && (
                      <div className="dictation-status-bar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                          <span>Procesando y transcribiendo audio con IA...</span>
                        </div>
                      </div>
                    )}

                    {/* Live preview while recording */}
                    {isRecording && argumentText.trim() && (
                      <div className="live-preview-box">
                        <span className="live-preview-label">Dictando en tiempo real:</span>
                        <p className="live-preview-text">{argumentText}</p>
                      </div>
                    )}

                    {/* Empty State: Ready to record */}
                    {!argumentText.trim() && !isRecording && !isTranscribing && (
                      <div className="voice-prompt-card">
                        <button
                          onClick={toggleRecording}
                          disabled={isLoading || isTranscribing}
                          className="mic-hero-button"
                          title="Iniciar dictado por voz"
                        >
                          <Mic size={32} />
                        </button>
                        <div style={{ textAlign: 'center' }}>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                            Dicta tu postura jurídica
                          </h4>
                          <p style={{ fontSize: '0.86rem', color: 'hsl(var(--text-secondary))', maxWidth: '440px', margin: '0 auto', lineHeight: '1.5' }}>
                            La entrada por escritura manual se encuentra deshabilitada. Presiona el micrófono y redacta oralmente tu argumento.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Transcribed text available */}
                    {argumentText.trim() && !isRecording && !isTranscribing && (
                      <>
                        {!isEditingText ? (
                          <div className="transcription-display-card">
                            <div className="transcription-card-header">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle2 size={17} style={{ color: 'hsl(var(--success-color))' }} />
                                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>Texto Transcrito por Voz</span>
                              </div>
                              <button
                                className="btn-secondary"
                                onClick={() => setIsEditingText(true)}
                                title="Editar para corregir errores ortográficos o de captura"
                              >
                                <Edit3 size={15} />
                                Editar transcripción
                              </button>
                            </div>
                            <div className="transcription-text-body">
                              {argumentText}
                            </div>
                          </div>
                        ) : (
                          <div className="transcription-edit-card">
                            <div className="transcription-card-header">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Edit3 size={17} style={{ color: 'hsl(var(--primary-color))' }} />
                                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>Corregir Transcripción</span>
                              </div>
                              <button
                                className="btn-primary"
                                style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                                onClick={() => setIsEditingText(false)}
                              >
                                <Check size={15} />
                                Listo
                              </button>
                            </div>
                            <textarea
                              className="argument-textarea"
                              value={argumentText}
                              onChange={(e) => setArgumentText(e.target.value)}
                              placeholder="Corrige posibles errores del dictado..."
                              disabled={isLoading}
                              autoFocus
                            />
                            <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>
                              Ajusta artículos, nombres o palabras que el reconocedor no haya captado exactamente.
                            </span>
                          </div>
                        )}

                        {/* Controls */}
                        <div className="editor-controls">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <button
                              onClick={toggleRecording}
                              disabled={isLoading || isTranscribing}
                              className="btn-secondary"
                              title="Dictar más argumentos"
                            >
                              <Mic size={15} />
                              Dictar más
                            </button>
                            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                              {argumentText.trim().split(/\s+/).length} palabras
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <button
                              className="btn-secondary"
                              onClick={() => {
                                setArgumentText('');
                                setIsEditingText(false);
                                setEvaluation(null);
                              }}
                              disabled={isLoading}
                            >
                              <RotateCcw size={14} />
                              Reiniciar
                            </button>

                            <button
                              className="btn-primary"
                              onClick={() => {
                                setIsEditingText(false);
                                handleEvaluate();
                              }}
                              disabled={isLoading || !argumentText.trim() || backendStatus === 'offline'}
                            >
                              {isLoading ? (
                                <>
                                  <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                                  Evaluando...
                                </>
                              ) : (
                                <>
                                  <Send size={16} />
                                  Evaluar Argumento
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Loading Box */}
                  {isLoading && (
                    <div className="loading-box info-card">
                      <div className="loading-spinner"></div>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                          Evaluando Coherencia y Lógica Jurídica
                        </h4>
                        <p style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))' }}>
                          {loadingStep || 'Ejecutando grafo agéntico LangGraph...'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Results Display */}
                  {evaluation && !isLoading && (
                    <div className="evaluation-container">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1.3rem', fontWeight: '800' }}>Resultados de la Evaluación</h3>
                          {user?.role === 'alumno' && (
                            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--success-color))', fontWeight: 600 }}>
                              ✓ Guardado automáticamente en tu historial
                            </span>
                          )}
                        </div>

                        <button className="btn-secondary" onClick={handleCopyEvaluation} style={{ gap: '0.4rem' }}>
                          {copied ? <Check size={16} style={{ color: 'hsl(var(--success-color))' }} /> : <Copy size={16} />}
                          {copied ? '¡Copiado!' : 'Copiar Dictamen'}
                        </button>
                      </div>

                      {/* Score Hero */}
                      {evaluation.rubric_scores && (
                        (() => {
                          const s = evaluation.rubric_scores;
                          const total = evaluation.score_total || (
                            ((s.estructura_logica || 0) * 0.25) +
                            ((s.relevancia_pertinencia || 0) * 0.25) +
                            ((s.consistencia_logica || 0) * 0.25) +
                            ((s.cohesion_calidad || 0) * 0.25)
                          );

                          let nivel = "Medio";
                          if (total <= 1.9) nivel = "Muy bajo";
                          else if (total <= 2.9) nivel = "Bajo";
                          else if (total <= 3.9) nivel = "Medio";
                          else if (total <= 4.9) nivel = "Alto";
                          else nivel = "Excelente";

                          const scoreColor = getScoreColor(total);

                          return (
                            <div className="score-hero">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                <div className="score-badge-circle" style={{ borderColor: scoreColor, color: scoreColor }}>
                                  <span className="num">{total.toFixed(2)}</span>
                                  <span className="max">de 5.00</span>
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', fontWeight: '700' }}>
                                    Nivel de Desempeño
                                  </div>
                                  <div style={{ fontSize: '1.45rem', fontWeight: '800', color: scoreColor }}>
                                    {nivel}
                                  </div>
                                  <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))' }}>
                                    Promedio ponderado en los 4 criterios de evaluación.
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      )}

                      {/* Rubric Criteria Cards */}
                      {evaluation.rubric_scores && (
                        <div>
                          <h4 className="section-title">
                            Rúbrica de Evaluación (Puntaje por Criterio)
                          </h4>
                          <div className="rubric-grid">
                            {[
                              { key: 'estructura_logica', label: 'Estructura Lógica', desc: 'Premisas y conclusión' },
                              { key: 'relevancia_pertinencia', label: 'Relevancia y Pertinencia', desc: 'Ajuste al caso y leyes' },
                              { key: 'consistencia_logica', label: 'Consistencia Lógica', desc: 'Sin contradicciones' },
                              { key: 'cohesion_calidad', label: 'Cohesión Discursiva', desc: 'Claridad y vocabulario' }
                            ].map(crit => {
                              const score = evaluation.rubric_scores[crit.key] || 0;
                              const percentage = score > 0 ? Math.max((score / 5) * 100, 20) : 0;
                              const color = getScoreColor(score);
                              return (
                                <div key={crit.key} className="rubric-card">
                                  <span className="rubric-label">{crit.label}</span>
                                  <div className="rubric-card-footer">
                                    <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>{crit.desc}</span>
                                    <span style={{ color: color }}>{score} / 5</span>
                                  </div>
                                  <div className="rubric-score-bar-bg">
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
                      )}

                      {/* Toulmin Analysis */}
                      {evaluation.toulmin_analysis && (
                        <div>
                          <h4 className="section-title">
                            <Layers size={18} />
                            Desglose del Modelo de Toulmin
                          </h4>
                          <div className="toulmin-grid">
                            <div className="toulmin-item">
                              <span className="toulmin-tag" style={{ backgroundColor: 'hsl(var(--primary-color) / 0.15)', color: 'hsl(var(--primary-color))' }}>
                                1. Pretensión (Claim)
                              </span>
                              <p className="toulmin-text">{evaluation.toulmin_analysis.claim || 'No identificada.'}</p>
                            </div>
                            <div className="toulmin-item">
                              <span className="toulmin-tag" style={{ backgroundColor: 'hsl(var(--accent-color) / 0.15)', color: 'hsl(var(--accent-color))' }}>
                                2. Datos (Data)
                              </span>
                              <p className="toulmin-text">{evaluation.toulmin_analysis.data || 'No señalados.'}</p>
                            </div>
                            <div className="toulmin-item">
                              <span className="toulmin-tag" style={{ backgroundColor: 'hsl(var(--warning-color) / 0.15)', color: 'hsl(var(--warning-color))' }}>
                                3. Garantía (Warrant)
                              </span>
                              <p className="toulmin-text">{evaluation.toulmin_analysis.warrant || 'No explícita.'}</p>
                            </div>
                            <div className="toulmin-item">
                              <span className="toulmin-tag" style={{ backgroundColor: 'hsl(var(--success-color) / 0.15)', color: 'hsl(var(--success-color))' }}>
                                4. Respaldo (Backing)
                              </span>
                              <p className="toulmin-text">{evaluation.toulmin_analysis.backing || 'Sin citas normativas.'}</p>
                            </div>
                            <div className="toulmin-item">
                              <span className="toulmin-tag" style={{ backgroundColor: 'hsl(280 80% 60% / 0.15)', color: 'hsl(280 80% 65%)' }}>
                                5. Refutación (Rebuttal)
                              </span>
                              <p className="toulmin-text">{evaluation.toulmin_analysis.rebuttal || 'No anticipada.'}</p>
                            </div>
                            <div className="toulmin-item">
                              <span className="toulmin-tag" style={{ backgroundColor: 'hsl(190 80% 50% / 0.15)', color: 'hsl(190 80% 50%)' }}>
                                6. Cualificador (Qualifier)
                              </span>
                              <p className="toulmin-text">{evaluation.toulmin_analysis.qualifier || 'No especificado.'}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Observations */}
                      {evaluation.final_feedback && (
                        <div>
                          <h4 className="section-title">
                            <CheckCircle2 size={18} />
                            Dictamen y Observaciones Docentes
                          </h4>
                          <div className="feedback-box">
                            {evaluation.final_feedback}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setIsEditingText(true);
                            window.scrollTo({ top: 300, behavior: 'smooth' });
                          }}
                        >
                          <Edit3 size={16} />
                          Ajustar y Reevaluar Postura
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  )}
</div>
  );
}

export default function App() {
  return (
    <AccessibilityProvider>
      <AuthProvider>
        <MainApp />
        <AccessibilityMenu />
      </AuthProvider>
    </AccessibilityProvider>
  );
}
