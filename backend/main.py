import os
import glob
import json
import base64
import requests
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from agent import evaluator_app

app = FastAPI(title="API de Evaluación de Coherencia Argumentativa Jurídica")

# Configurar CORS para permitir peticiones desde Vite y cualquier origen local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CASOS_DIR = os.path.join(BASE_DIR, "data", "casos")
DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")

# Definir Modelos de Entrada
class ArgumentSubmission(BaseModel):
    case_id: str
    student_argument: str

class AudioTranscriptionRequest(BaseModel):
    audio_base64: str
    mime_type: Optional[str] = "audio/webm"

@app.get("/api/health")
def health_check():
    """Verifica el estado del backend y servicios."""
    return {
        "status": "ok",
        "service": "Evaluador de Coherencia Argumentativa",
        "deepgram_configured": bool(DEEPGRAM_API_KEY),
        "total_cases": len(glob.glob(os.path.join(CASOS_DIR, "*.json"))) if os.path.exists(CASOS_DIR) else 0
    }

@app.get("/api/cases")
def get_cases():
    """Devuelve la lista completa de casos jurídicos."""
    casos = []
    
    if not os.path.exists(CASOS_DIR):
        return []
        
    for json_file in glob.glob(os.path.join(CASOS_DIR, "*.json")):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                caso = json.load(f)
                casos.append(caso)
        except Exception as e:
            print(f"Error leyendo {json_file}: {e}")
            
    # Ordenar casos por id (caso_001, caso_002...)
    casos.sort(key=lambda x: x.get("id", ""))
    return casos

@app.post("/api/transcribe")
def transcribe_audio(payload: AudioTranscriptionRequest):
    """
    Transcribe audio enviado en base64 utilizando Deepgram Nova-2 en español.
    """
    if not payload.audio_base64:
        raise HTTPException(status_code=400, detail="No se proporcionó audio")
        
    try:
        # Decodificar el audio en base64
        audio_bytes = base64.b64decode(payload.audio_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Audio en base64 inválido: {str(e)}")

    if not DEEPGRAM_API_KEY:
        raise HTTPException(status_code=500, detail="DEEPGRAM_API_KEY no configurada en el servidor.")

    try:
        url = "https://api.deepgram.com/v1/listen?model=nova-2&language=es&smart_format=true&punctuate=true"
        headers = {
            "Authorization": f"Token {DEEPGRAM_API_KEY}",
            "Content-Type": payload.mime_type or "audio/webm"
        }
        
        response = requests.post(url, headers=headers, data=audio_bytes, timeout=30)
        
        if response.status_code != 200:
            print(f"Deepgram error {response.status_code}: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Error en servicio de transcripción: {response.text}")
            
        data = response.json()
        transcript = ""
        channels = data.get("results", {}).get("channels", [])
        if channels and len(channels) > 0:
            alts = channels[0].get("alternatives", [])
            if alts and len(alts) > 0:
                transcript = alts[0].get("transcript", "")
                
        return {
            "status": "success",
            "text": transcript.strip()
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error en transcripción: {e}")
        raise HTTPException(status_code=500, detail=f"Error transcribiendo audio: {str(e)}")

@app.post("/api/evaluate")
def evaluate_argument(submission: ArgumentSubmission):
    """Ejecuta el grafo de LangGraph para evaluar el argumento del estudiante."""
    if not submission.student_argument.strip():
        raise HTTPException(status_code=400, detail="El argumento no puede estar vacío")
        
    # Obtener el contexto del caso
    caso_md_path = os.path.join(CASOS_DIR, f"{submission.case_id}.md")
    case_context = ""
    
    if os.path.exists(caso_md_path):
        with open(caso_md_path, 'r', encoding='utf-8') as f:
            case_context = f.read()
    else:
        # Fallback al archivo .json si el .md no existe
        caso_json_path = os.path.join(CASOS_DIR, f"{submission.case_id}.json")
        if os.path.exists(caso_json_path):
            with open(caso_json_path, 'r', encoding='utf-8') as f:
                caso_data = json.load(f)
                case_context = f"Título: {caso_data.get('titulo')}\nEnunciado: {caso_data.get('enunciado')}\nContexto: {' '.join(caso_data.get('contexto', []))}"
        else:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        
    # Inicializar el estado de LangGraph
    initial_state = {
        "student_argument": submission.student_argument,
        "case_id": submission.case_id,
        "case_context": case_context,
        "retrieved_laws": "",
        "toulmin_analysis": {},
        "rubric_scores": {},
        "final_feedback": ""
    }
    
    try:
        # Ejecutar el workflow agéntico
        result_state = evaluator_app.invoke(initial_state)
        
        return {
            "status": "success",
            "retrieved_laws": result_state.get("retrieved_laws", ""),
            "toulmin_analysis": result_state["toulmin_analysis"],
            "rubric_scores": result_state["rubric_scores"],
            "final_feedback": result_state["final_feedback"]
        }
    except Exception as e:
        print(f"Error evaluando argumento: {e}")
        raise HTTPException(status_code=500, detail=f"Error en evaluación de IA: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
