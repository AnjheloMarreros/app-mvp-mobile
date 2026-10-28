import os
from typing import TypedDict, List, Dict, Any
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langgraph.graph import StateGraph, START, END

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")

# ==========================================
# 1. State Definition
# ==========================================
class AgentState(TypedDict):
    student_argument: str
    case_id: str
    case_context: str
    retrieved_laws: str
    toulmin_analysis: Dict[str, Any]
    rubric_scores: Dict[str, Any]
    final_feedback: str

# ==========================================
# 2. Schema Definitions for LLM output
# ==========================================
class ToulminExtraction(BaseModel):
    claim: str = Field(description="Afirmación o postura principal sustentada por el estudiante (Claim)")
    data: str = Field(description="Datos, hechos o elementos del caso en los que se apoya (Data)")
    warrant: str = Field(description="Garantía lógica o normativa que conecta los datos con la afirmación (Warrant)")
    backing: str = Field(description="Respaldo legal, doctrinal o jurisprudencial (Backing)")
    rebuttal: str = Field(description="Posibles reservas, excepciones o contraargumentos anticipados (Rebuttal)")
    qualifier: str = Field(description="Cualificador modal o grado de certeza (e.g., ciertamente, probablemente, en principio) (Qualifier)")

class RubricEvaluation(BaseModel):
    estructura_logica: int = Field(description="Puntaje de 1 a 5 para Estructura lógica del argumento")
    relevancia_pertinencia: int = Field(description="Puntaje de 1 a 5 para Relevancia y pertinencia del contenido")
    consistencia_logica: int = Field(description="Puntaje de 1 a 5 para Consistencia lógica del razonamiento")
    cohesion_calidad: int = Field(description="Puntaje de 1 a 5 para Cohesión y calidad discursiva")
    justificacion: str = Field(description="Justificación detallada y recomendaciones pedagógicas para el estudiante")

# ==========================================
# 3. Model Configuration
# ==========================================
# Modelo principal y de respaldo con alta resiliencia
primary_llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash", temperature=0.2)
fallback_llm = ChatGoogleGenerativeAI(model="gemini-3.8-flash", temperature=0.2)
lite_llm = ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite", temperature=0.2)
llm = primary_llm.with_fallbacks([fallback_llm, lite_llm])

embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-2")

# ==========================================
# 4. Graph Nodes
# ==========================================
def retrieve_laws_node(state: AgentState):
    """Recupera contexto legal relevante usando ChromaDB."""
    try:
        if os.path.exists(CHROMA_PATH):
            vector_db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
            # Primero intentar con filtro de ley peruana
            docs = vector_db.similarity_search(state["student_argument"], k=4, filter={"type": "ley_peruana"})
            if not docs:
                # Si no hay resultados con filtro, buscar en toda la base
                docs = vector_db.similarity_search(state["student_argument"], k=4)
            leyes_text = "\n\n".join([d.page_content for d in docs if d.page_content.strip()])
        else:
            leyes_text = "Normativa general del Código Civil y principios generales del Derecho."
    except Exception as e:
        print(f"Aviso en retrieve_laws: {e}")
        leyes_text = "Normas del Código Civil aplicables sobre actos jurídicos y contratos."
        
    return {"retrieved_laws": leyes_text or "Normas legales generales aplicables al caso."}

def toulmin_extractor_node(state: AgentState):
    """Extrae los componentes del Modelo de Toulmin del argumento."""
    prompt = f"""
    Eres un experto en Lógica Jurídica y Teoría de la Argumentación (Modelo de Toulmin).
    Analiza exhaustivamente el argumento redactado por un estudiante de derecho y desglosa sus 6 componentes estructurales.
    
    Contexto del Caso:
    {state['case_context']}
    
    Argumento del Estudiante:
    {state['student_argument']}
    
    Por favor identifica:
    1. Claim (Pretensión/Afirmación principal)
    2. Data (Hechos/Datos invocados)
    3. Warrant (Garantía o puente lógico-normativo)
    4. Backing (Respaldo en leyes, principios o doctrina)
    5. Rebuttal (Refutación o salvedades consideradas)
    6. Qualifier (Cualificador de certeza modal)
    """
    structured_llm = llm.with_structured_output(ToulminExtraction)
    result = structured_llm.invoke(prompt)
    data = result.model_dump() if hasattr(result, "model_dump") else (result.dict() if hasattr(result, "dict") else dict(result))
    return {"toulmin_analysis": data}

def rubric_evaluator_node(state: AgentState):
    """Evalúa el argumento usando la rúbrica y las leyes."""
    prompt = f"""
    Eres un docente evaluador universitario de Lógica Jurídica.
    Califica el argumento del estudiante del 1 al 5 en cada uno de los 4 criterios de la rúbrica:
    
    1. Estructura lógica del argumento (1: Muy deficiente, 2: Insuficiente, 3: Aceptable, 4: Bueno, 5: Excelente)
    2. Relevancia y pertinencia del contenido respecto al caso y normativa (1 al 5)
    3. Consistencia lógica del razonamiento (evitando falacias o contradicciones) (1 al 5)
    4. Cohesión y calidad discursiva jurídica (1 al 5)
    
    Contexto Legal (Leyes Recuperadas):
    {state['retrieved_laws']}
    
    Análisis de Toulmin extraído:
    {state['toulmin_analysis']}
    
    Argumento original del estudiante:
    {state['student_argument']}
    
    Justifica tus calificaciones con un comentario constructivo, claro y orientado al aprendizaje.
    """
    structured_llm = llm.with_structured_output(RubricEvaluation)
    result = structured_llm.invoke(prompt)
    data = result.model_dump() if hasattr(result, "model_dump") else (result.dict() if hasattr(result, "dict") else dict(result))
    return {"rubric_scores": data}

def feedback_generator_node(state: AgentState):
    """Genera la puntuación ponderada y el feedback pedagógico."""
    scores = state["rubric_scores"]
    total = (scores["estructura_logica"] * 0.25) + \
            (scores["relevancia_pertinencia"] * 0.25) + \
            (scores["consistencia_logica"] * 0.25) + \
            (scores["cohesion_calidad"] * 0.25)
    
    if total <= 1.9:
        nivel = "Muy bajo"
        color = "Nivel 1"
    elif total <= 2.9:
        nivel = "Bajo"
        color = "Nivel 2"
    elif total <= 3.9:
        nivel = "Medio"
        color = "Nivel 3"
    elif total <= 4.9:
        nivel = "Alto"
        color = "Nivel 4"
    else:
        nivel = "Excelente"
        color = "Nivel 5"

    feedback = (
        f"Calificación Final Ponderada: {total:.2f}/5.00 (Nivel: {nivel})\n\n"
        f"• Estructura Lógica: {scores['estructura_logica']}/5\n"
        f"• Relevancia y Pertinencia: {scores['relevancia_pertinencia']}/5\n"
        f"• Consistencia Lógica: {scores['consistencia_logica']}/5\n"
        f"• Cohesión y Calidad Discursiva: {scores['cohesion_calidad']}/5\n\n"
        f"Dictamen Docente:\n{scores.get('justificacion', '')}"
    )
    return {"final_feedback": feedback}

# ==========================================
# 5. Build Graph
# ==========================================
workflow = StateGraph(AgentState)

workflow.add_node("retrieve", retrieve_laws_node)
workflow.add_node("toulmin", toulmin_extractor_node)
workflow.add_node("rubric", rubric_evaluator_node)
workflow.add_node("feedback", feedback_generator_node)

workflow.add_edge(START, "retrieve")
workflow.add_edge("retrieve", "toulmin")
workflow.add_edge("toulmin", "rubric")
workflow.add_edge("rubric", "feedback")
workflow.add_edge("feedback", END)

evaluator_app = workflow.compile()
