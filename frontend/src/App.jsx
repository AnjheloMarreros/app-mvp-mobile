import { useState, useEffect, useRef } from 'react';
import {
  Search, Mic, MicOff, Send, Scale, BookOpen, AlertCircle,
  CheckCircle2, Copy, Check, RotateCcw, ArrowLeft,
  FileText, ShieldCheck, HelpCircle, Layers, Award, Edit3
} from 'lucide-react';
import './index.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [cases, setCases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);

  // Backend status
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline' | 'checking'

  // Argument and evaluation state
  const [argumentText, setArgumentText] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Voice dictation state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [dictationMode, setDictationMode] = useState('none'); // 'webspeech' | 'mediarecorder' | 'none'
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);

  // Refs for audio handling
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const baseTextBeforeRecordingRef = useRef('');

  // 1. Check backend health and load cases
  useEffect(() => {
    checkHealthAndFetchCases();
  }, []);

  const checkHealthAndFetchCases = async () => {
    try {
      setBackendStatus('checking');
      const healthRes = await fetch(`${API_BASE}/api/health`, { method: 'GET' });
      if (healthRes.ok) {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }

    try {
      const casesRes = await fetch(`${API_BASE}/api/cases`);
      if (casesRes.ok) {
        const data = await casesRes.json();
        setCases(data);
      }
    } catch (err) {
      console.error("Error cargando casos:", err);
    }
  };

  // Timer for recording duration
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

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      stopDictation();
    };
  }, []);

  // Filter cases by search
  const filteredCases = cases.filter(c => {
    const term = searchTerm.toLowerCase();
    const titleMatch = (c.titulo || '').toLowerCase().includes(term);
    const statementMatch = (c.enunciado || '').toLowerCase().includes(term);
    const idMatch = (c.id || '').toLowerCase().includes(term);
    return titleMatch || statementMatch || idMatch;
  });

  // ==========================================
  // Voice Dictation Implementation
  // ==========================================
  const startDictation = async () => {
    setErrorMessage('');
    baseTextBeforeRecordingRef.current = argumentText;

    // Check if Web Speech API is supported (Chrome, Edge, Safari iOS/macOS)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-PE'; // Español (Perú) con fallback a español general

        recognition.onstart = () => {
          setIsRecording(true);
          setDictationMode('webspeech');
        };

        recognition.onresult = (event) => {
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
          console.warn("SpeechRecognition error:", event.error);
          if (event.error === 'not-allowed') {
            setErrorMessage('Permiso de micrófono denegado. Habilita el acceso al micrófono en la barra de direcciones de tu navegador.');
            stopDictation();
          } else if (event.error === 'no-speech') {
            // No speech detected yet, continue listening
          } else {
            // Switch to MediaRecorder fallback
            console.log("Intentando fallback con MediaRecorder...");
            stopSpeechRecognition();
            startMediaRecorderFallback();
          }
        };

        recognition.onend = () => {
          // If we didn't explicitly stop, but recognition ended, restart if still recording
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
        console.warn("No se pudo iniciar SpeechRecognition, usando MediaRecorder:", err);
      }
    }

    // Fallback: Use MediaRecorder + Deepgram server-side transcription
    startMediaRecorderFallback();
  };

  const startMediaRecorderFallback = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('Tu navegador no soporta grabación de audio ni dictado por voz.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop audio tracks
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 0) {
          await sendAudioToDeepgram(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDictationMode('mediarecorder');
    } catch (err) {
      console.error("Error al acceder al micrófono:", err);
      setErrorMessage('No se pudo acceder al micrófono. Por favor verifica los permisos en el navegador.');
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
      } catch {
        // ignore
      }
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
      // Convert blob to base64
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

  // ==========================================
  // Argument Evaluation
  // ==========================================
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

      const response = await fetch(`${API_BASE}/api/evaluate`, {
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
      console.error("Error evaluating:", error);
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

  // Helper color for scores
  const getScoreColor = (score) => {
    if (score >= 4.5) return 'var(--level-5)';
    if (score >= 3.5) return 'var(--level-4)';
    if (score >= 2.5) return 'var(--level-3)';
    if (score >= 1.5) return 'var(--level-2)';
    return 'var(--level-1)';
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <h1>MVP Mobile - Evaluación de Coherencia Argumentativa</h1>
      </header>

      {/* Backend Offline Warning */}
      {backendStatus === 'offline' && (
        <div className="alert-banner warning">
          <AlertCircle size={20} />
          <div>
            <strong>Servidor Backend no detectado en puerto 8000.</strong><br />
            Asegúrate de que uvicorn esté ejecutándose: <code>uvicorn main:app --reload --port 8000</code> en la carpeta backend.
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="alert-banner error">
          <AlertCircle size={20} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* View 1: Cases List */}
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
              placeholder="Buscar por caso o palabras clave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="cases-count-badge">
            <span>Mostrando {filteredCases.length} de {cases.length} casos disponibles</span>
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
                  setErrorMessage('');
                  stopDictation();
                }}
              >
                <div className="case-card-header">
                  <h3 className="case-title">{c.titulo}</h3>
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
        /* View 2: Case Details and Evaluation Workspace */
        <div className="case-detail-container">
          <button
            className="back-button"
            onClick={() => {
              stopDictation();
              setSelectedCase(null);
              setIsEditingText(false);
            }}
          >
            <ArrowLeft size={16} />
            Volver a la lista de casos
          </button>

          {/* Case Information Card */}
          <div className="info-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '800' }}>{selectedCase.titulo}</h2>
            </div>

            <p style={{ color: 'hsl(var(--text-primary))', marginBottom: '1.25rem', fontSize: '0.98rem', lineHeight: '1.6' }}>
              {selectedCase.enunciado}
            </p>

            {/* Hechos Clave del Caso */}
            {selectedCase.contexto && selectedCase.contexto.length > 0 && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid hsl(var(--border-color))' }}>
                <h4 className="section-title">
                  <FileText size={16} />
                  Hechos y Contexto del Caso
                </h4>
                <ul className="bullet-list">
                  {selectedCase.contexto.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Instrucciones y Pautas para el Estudiante */}
            {selectedCase.instrucciones && selectedCase.instrucciones.length > 0 && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid hsl(var(--border-color))' }}>
                <h4 className="section-title">
                  <ShieldCheck size={16} />
                  Pautas de Argumentación Solicitadas
                </h4>
                <ul className="bullet-list">
                  {selectedCase.instrucciones.map((inst, idx) => (
                    <li key={idx}>{inst}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Student Argument Input Workspace */}
          <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                <Layers size={18} />
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: '700' }}>
                    {formatSeconds(recordingSeconds)}
                  </span>
                  <button
                    className="btn-stop-recording"
                    onClick={stopDictation}
                    title="Detener dictado y procesar"
                  >
                    <MicOff size={15} />
                    Detener
                  </button>
                </div>
              </div>
            )}

            {isTranscribing && (
              <div className="dictation-status-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                  <span>Procesando y transcribiendo audio con IA (Deepgram Nova-2)...</span>
                </div>
              </div>
            )}

            {/* In recording mode with live text preview */}
            {isRecording && argumentText.trim() && (
              <div className="live-preview-box">
                <span className="live-preview-label">Dictando en tiempo real:</span>
                <p className="live-preview-text">{argumentText}</p>
              </div>
            )}

            {/* Empty State: No argument dictated yet and not recording */}
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
                    La entrada mediante escritura ha sido deshabilitada. Presiona el botón del micrófono y expón tus argumentos oralmente.
                  </p>
                </div>
              </div>
            )}

            {/* Ready State: Transcribed text is available and not actively recording/transcribing */}
            {argumentText.trim() && !isRecording && !isTranscribing && (
              <>
                {!isEditingText ? (
                  /* Display read-only transcribed text with Edit option */
                  <div className="transcription-display-card">
                    <div className="transcription-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={17} style={{ color: 'hsl(var(--success-color))' }} />
                        <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>Texto Transcrito por Voz</span>
                      </div>
                      <button
                        className="btn-secondary"
                        onClick={() => setIsEditingText(true)}
                        title="Editar el texto para corregir errores de transcripción"
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
                  /* Edit mode: Editable textarea to fix transcription mistakes */
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
                        title="Guardar corrección y cerrar edición"
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
                      Corrige artículos de leyes, nombres o términos que el reconocedor de voz no haya captado con exactitud.
                    </span>
                  </div>
                )}

                {/* Editor Footer Actions */}
                <div className="editor-controls">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button
                      onClick={toggleRecording}
                      disabled={isLoading || isTranscribing}
                      className="btn-secondary"
                      title="Agregar más dictado por voz"
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
                      title="Borrar texto y volver a dictar"
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

          {/* Loading Indicator with progress steps */}
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

          {/* Results: Evaluation, Toulmin Breakdown and Rubric Scores */}
          {evaluation && !isLoading && (
            <div className="evaluation-container">
              {/* Header with Title and Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'hsl(var(--text-primary))' }}>
                    Resultados de la Evaluación
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                    Evaluación realizada según el modelo de Stephen Toulmin y la rúbrica oficial docente.
                  </p>
                </div>

                <button
                  className="btn-secondary"
                  onClick={handleCopyEvaluation}
                  style={{ gap: '0.4rem' }}
                >
                  {copied ? <Check size={16} style={{ color: 'hsl(var(--success-color))' }} /> : <Copy size={16} />}
                  {copied ? '¡Copiado!' : 'Copiar Dictamen'}
                </button>
              </div>

              {/* Score Hero */}
              {evaluation.rubric_scores && (
                (() => {
                  const s = evaluation.rubric_scores;
                  const total = ((s.estructura_logica || 0) * 0.25) +
                    ((s.relevancia_pertinencia || 0) * 0.25) +
                    ((s.consistencia_logica || 0) * 0.25) +
                    ((s.cohesion_calidad || 0) * 0.25);

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
                            Promedio ponderado en los 4 criterios de argumentación jurídica.
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Award size={32} style={{ color: scoreColor, opacity: 0.8 }} />
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Rubric Criteria 4 Cards */}
              {evaluation.rubric_scores && (
                <div>
                  <h4 className="section-title">
                    <Scale size={18} />
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
                      const percentage = (score / 5) * 100;
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

              {/* Toulmin Analysis Breakdown */}
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
                      <p className="toulmin-text">{evaluation.toulmin_analysis.claim || 'No identificada con claridad.'}</p>
                    </div>

                    <div className="toulmin-item">
                      <span className="toulmin-tag" style={{ backgroundColor: 'hsl(var(--accent-color) / 0.15)', color: 'hsl(var(--accent-color))' }}>
                        2. Datos / Hechos (Data)
                      </span>
                      <p className="toulmin-text">{evaluation.toulmin_analysis.data || 'No se señalaron datos fácticos suficientes.'}</p>
                    </div>

                    <div className="toulmin-item">
                      <span className="toulmin-tag" style={{ backgroundColor: 'hsl(var(--warning-color) / 0.15)', color: 'hsl(var(--warning-color))' }}>
                        3. Garantía (Warrant)
                      </span>
                      <p className="toulmin-text">{evaluation.toulmin_analysis.warrant || 'Falta conexión lógica explícita.'}</p>
                    </div>

                    <div className="toulmin-item">
                      <span className="toulmin-tag" style={{ backgroundColor: 'hsl(var(--success-color) / 0.15)', color: 'hsl(var(--success-color))' }}>
                        4. Respaldo (Backing)
                      </span>
                      <p className="toulmin-text">{evaluation.toulmin_analysis.backing || 'Sin citas normativas o doctrinales.'}</p>
                    </div>

                    <div className="toulmin-item">
                      <span className="toulmin-tag" style={{ backgroundColor: 'hsl(280 80% 60% / 0.15)', color: 'hsl(280 80% 65%)' }}>
                        5. Refutación / Salvedad (Rebuttal)
                      </span>
                      <p className="toulmin-text">{evaluation.toulmin_analysis.rebuttal || 'No anticipa contraargumentos o excepciones.'}</p>
                    </div>

                    <div className="toulmin-item">
                      <span className="toulmin-tag" style={{ backgroundColor: 'hsl(190 80% 50% / 0.15)', color: 'hsl(190 80% 50%)' }}>
                        6. Cualificador Modal (Qualifier)
                      </span>
                      <p className="toulmin-text">{evaluation.toulmin_analysis.qualifier || 'No especificado (e.g., indudablemente, presumiblemente).'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dictamen Docente y Justificación */}
              {evaluation.rubric_scores?.justificacion && (
                <div>
                  <h4 className="section-title">
                    <CheckCircle2 size={18} />
                    Observaciones y Justificación Docente
                  </h4>
                  <div className="feedback-box">
                    {evaluation.rubric_scores.justificacion}
                  </div>
                </div>
              )}

              {/* Legal Context Retrieved via RAG */}
              {evaluation.retrieved_laws && (
                <div>
                  <h4 className="section-title">
                    <BookOpen size={18} />
                    Normativa Legal y Fuentes Recuperadas (RAG ChromaDB)
                  </h4>
                  <div className="laws-box">
                    {evaluation.retrieved_laws}
                  </div>
                </div>
              )}

              {/* Botón para reintentar o mejorar */}
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
    </div>
  );
}

export default App;
