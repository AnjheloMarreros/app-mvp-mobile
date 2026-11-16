import os
import glob
import json
import base64
import requests
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv()

from database import (
    SessionLocal, init_db, get_db, User, ClassSession, ClassEnrollment, CaseModel, EvaluationSubmission
)
from auth import (
    hash_password, verify_password, generate_user_code, generate_class_code,
    create_access_token, get_current_user, get_current_user_optional
)
from seed import seed_default_cases
from agent import evaluator_app

app = FastAPI(title="API de Evaluación de Coherencia Argumentativa Jurídica")

# Configurar CORS para Vite y entornos de desarrollo
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


# Inicialización de la base de datos al arrancar
@app.on_event("startup")
def on_startup():
    init_db()
    db = SessionLocal()
    try:
        seed_default_cases(db)
    finally:
        db.close()


# ==========================================
# Esquemas Pydantic
# ==========================================
class UserRegisterRequest(BaseModel):
    role: str  # 'alumno' o 'docente'
    full_name: str
    username: str
    email: str
    password: str


class UserLoginRequest(BaseModel):
    identifier: str  # username o email
    password: str


class ClassCreateRequest(BaseModel):
    title: str
    description: Optional[str] = ""


class ClassJoinRequest(BaseModel):
    code: str


class CaseCreateRequest(BaseModel):
    enunciado: str
    contexto: str
    hechos_relevantes: str
    soporte_juridico: str


class CaseUpdateRequest(BaseModel):
    enunciado: Optional[str] = None
    contexto: Optional[str] = None
    hechos_relevantes: Optional[str] = None
    soporte_juridico: Optional[str] = None


class ArgumentSubmission(BaseModel):
    case_id: str
    student_argument: str


class AudioTranscriptionRequest(BaseModel):
    audio_base64: str
    mime_type: Optional[str] = "audio/webm"


# ==========================================
# 1. Health Check
# ==========================================
@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """Verifica el estado del backend y servicios."""
    cases_count = db.query(CaseModel).count()
    return {
        "status": "ok",
        "service": "Evaluador de Coherencia Argumentativa Jurídica",
        "deepgram_configured": bool(DEEPGRAM_API_KEY),
        "total_cases": cases_count
    }


# ==========================================
# 2. Módulo de Autenticación & Registro
# ==========================================
@app.post("/api/auth/register")
def register_user(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Registra a un nuevo usuario (Alumno o Docente).
    Genera automáticamente el ID institucional con formato AXXXXXXXX o DXXXXXXXX.
    """
    role_norm = payload.role.strip().lower()
    if role_norm not in ["alumno", "docente"]:
        raise HTTPException(status_code=400, detail="El rol debe ser 'alumno' o 'docente'.")

    clean_username = payload.username.strip().lower()
    clean_email = payload.email.strip().lower()

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres.")

    # Verificar si el nombre de usuario o correo ya existen
    if db.query(User).filter(User.username == clean_username).first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya se encuentra registrado.")

    if db.query(User).filter(User.email == clean_email).first():
        raise HTTPException(status_code=400, detail="El correo electrónico ya se encuentra registrado.")

    # Generar ID institucional aleatorio (AXXXXXXXX o DXXXXXXXX)
    user_code = generate_user_code(db, role_norm)
    pwd_hash = hash_password(payload.password)

    new_user = User(
        user_code=user_code,
        role=role_norm,
        full_name=payload.full_name.strip(),
        username=clean_username,
        email=clean_email,
        password_hash=pwd_hash
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": new_user.id, "role": new_user.role, "code": new_user.user_code})

    return {
        "status": "success",
        "message": f"Cuenta creada con éxito. Tu ID asignado es {user_code}",
        "token": token,
        "user": {
            "id": new_user.id,
            "user_code": new_user.user_code,
            "role": new_user.role,
            "full_name": new_user.full_name,
            "username": new_user.username,
            "email": new_user.email
        }
    }


@app.post("/api/auth/login")
def login_user(payload: UserLoginRequest, db: Session = Depends(get_db)):
    """
    Permite iniciar sesión mediante Nombre de Usuario o Correo Electrónico.
    """
    identifier = payload.identifier.strip().lower()

    # Buscar por username o por email
    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas. Verifica tu usuario/correo y contraseña.")

    token = create_access_token({"sub": user.id, "role": user.role, "code": user.user_code})

    return {
        "status": "success",
        "token": token,
        "user": {
            "id": user.id,
            "user_code": user.user_code,
            "role": user.role,
            "full_name": user.full_name,
            "username": user.username,
            "email": user.email
        }
    }


@app.get("/api/auth/me")
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Retorna los datos del usuario autenticado."""
    return {
        "id": current_user.id,
        "user_code": current_user.user_code,
        "role": current_user.role,
        "full_name": current_user.full_name,
        "username": current_user.username,
        "email": current_user.email
    }


@app.delete("/api/auth/me")
def delete_my_account(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Elimina permanentemente la cuenta del usuario autenticado (Alumno o Docente).
    - Para Docentes: borra casos creados, archivos asociados, clases creadas y desvincula alumnos.
    - Para Alumnos: borra evaluaciones resueltas y desvincula de las clases.
    """
    if current_user.role == "docente":
        # Buscar y eliminar casos creados por este docente
        teacher_cases = db.query(CaseModel).filter(CaseModel.created_by_teacher_id == current_user.id).all()
        for tc in teacher_cases:
            # Eliminar evaluaciones asociadas a estos casos
            db.query(EvaluationSubmission).filter(EvaluationSubmission.case_id == tc.id).delete()
            # Eliminar archivos físicos en data/casos
            try:
                json_path = os.path.join(CASOS_DIR, f"{tc.id}.json")
                md_path = os.path.join(CASOS_DIR, f"{tc.id}.md")
                if os.path.exists(json_path):
                    os.remove(json_path)
                if os.path.exists(md_path):
                    os.remove(md_path)
            except Exception as e:
                print(f"Aviso al eliminar archivo físico de caso {tc.id}: {e}")
            db.delete(tc)
        
        # Eliminar clases creadas y sus matriculaciones
        classes = db.query(ClassSession).filter(ClassSession.teacher_id == current_user.id).all()
        for cls in classes:
            db.query(ClassEnrollment).filter(ClassEnrollment.class_id == cls.id).delete()
            db.delete(cls)

    elif current_user.role == "alumno":
        # Eliminar matriculaciones y evaluaciones del alumno
        db.query(ClassEnrollment).filter(ClassEnrollment.student_id == current_user.id).delete()
        db.query(EvaluationSubmission).filter(EvaluationSubmission.student_id == current_user.id).delete()

    db.delete(current_user)
    db.commit()

    return {
        "status": "success",
        "message": f"La cuenta {current_user.user_code} ha sido eliminada permanentemente del sistema."
    }


# ==========================================
# 3. Módulo de Clases y Sesiones
# ==========================================
@app.post("/api/classes")
def create_class_session(payload: ClassCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Crea una nueva clase/sesión docente con código aleatorio CLS-XXXXXX."""
    if current_user.role != "docente":
        raise HTTPException(status_code=403, detail="Solo los docentes pueden crear clases.")

    class_code = generate_class_code(db)
    new_class = ClassSession(
        code=class_code,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else "",
        teacher_id=current_user.id
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)

    return {
        "status": "success",
        "message": f"Clase creada con éxito. Código: {class_code}",
        "class": {
            "id": new_class.id,
            "code": new_class.code,
            "title": new_class.title,
            "description": new_class.description,
            "created_at": new_class.created_at.isoformat(),
            "enrolled_students": 0
        }
    }


@app.get("/api/classes/my")
def get_my_classes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Para docentes: lista las clases creadas con número de alumnos matriculados.
    Para alumnos: lista las clases a las que se ha unido con el nombre del docente.
    """
    if current_user.role == "docente":
        classes = db.query(ClassSession).filter(ClassSession.teacher_id == current_user.id).all()
        result = []
        for c in classes:
            student_count = db.query(ClassEnrollment).filter(ClassEnrollment.class_id == c.id).count()
            result.append({
                "id": c.id,
                "code": c.code,
                "title": c.title,
                "description": c.description,
                "created_at": c.created_at.isoformat(),
                "enrolled_students": student_count
            })
        return result
    else:
        enrollments = db.query(ClassEnrollment).filter(ClassEnrollment.student_id == current_user.id).all()
        result = []
        for en in enrollments:
            cls = en.class_session
            teacher = cls.teacher
            result.append({
                "id": cls.id,
                "code": cls.code,
                "title": cls.title,
                "description": cls.description,
                "teacher_name": teacher.full_name if teacher else "Docente",
                "teacher_code": teacher.user_code if teacher else "",
                "joined_at": en.joined_at.isoformat()
            })
        return result


@app.post("/api/classes/join")
def join_class(payload: ClassJoinRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Permite al alumno unirse a una clase usando el código CLS-XXXXXX."""
    if current_user.role != "alumno":
        raise HTTPException(status_code=403, detail="Solo los alumnos pueden registrarse en una clase.")

    code_clean = payload.code.strip().upper()
    cls = db.query(ClassSession).filter(ClassSession.code == code_clean).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Código de clase no encontrado. Verifica con tu docente.")

    # Verificar si ya está matriculado
    existing = db.query(ClassEnrollment).filter(
        ClassEnrollment.class_id == cls.id,
        ClassEnrollment.student_id == current_user.id
    ).first()
    if existing:
        return {"status": "info", "message": f"Ya te encuentras registrado en la clase '{cls.title}'."}

    enrollment = ClassEnrollment(
        class_id=cls.id,
        student_id=current_user.id
    )
    db.add(enrollment)
    db.commit()

    return {
        "status": "success",
        "message": f"Te has registrado exitosamente en la clase '{cls.title}'."
    }


@app.get("/api/classes/{class_id}/report")
def get_class_grades_report(class_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Reporte de notas de los alumnos matriculados en la clase del docente."""
    if current_user.role != "docente":
        raise HTTPException(status_code=403, detail="Acceso exclusivo para docentes.")

    cls = db.query(ClassSession).filter(ClassSession.id == class_id).first()
    if not cls or cls.teacher_id != current_user.id:
        raise HTTPException(status_code=404, detail="Clase no encontrada o no autorizada.")

    enrollments = db.query(ClassEnrollment).filter(ClassEnrollment.class_id == class_id).all()
    report = []

    for en in enrollments:
        student = en.student
        submissions = db.query(EvaluationSubmission).filter(
            EvaluationSubmission.student_id == student.id
        ).order_by(desc(EvaluationSubmission.created_at)).all()

        total_cases = len(submissions)
        avg_score = round(sum(s.score_total for s in submissions) / total_cases, 2) if total_cases > 0 else 0.0

        sub_list = []
        for s in submissions:
            case = db.query(CaseModel).filter(CaseModel.id == s.case_id).first()
            try:
                rubric = json.loads(s.rubric_scores)
            except Exception:
                rubric = {}
            try:
                toulmin = json.loads(s.toulmin_analysis)
            except Exception:
                toulmin = {}

            sub_list.append({
                "id": s.id,
                "case_id": s.case_id,
                "case_title": case.titulo if case else s.case_id,
                "score_total": s.score_total,
                "created_at": s.created_at.isoformat(),
                "rubric_scores": rubric,
                "toulmin_analysis": toulmin,
                "student_argument": s.student_argument,
                "final_feedback": s.final_feedback
            })

        report.append({
            "student_id": student.id,
            "user_code": student.user_code,
            "full_name": student.full_name,
            "email": student.email,
            "total_cases_resolved": total_cases,
            "cases_evaluated": total_cases,
            "average_score": avg_score,
            "average_grade": avg_score,
            "submissions": sub_list
        })

    return {
        "class": {
            "id": cls.id,
            "title": cls.title,
            "code": cls.code,
            "description": cls.description
        },
        "class_title": cls.title,
        "class_code": cls.code,
        "total_enrolled": len(report),
        "students": report
    }


@app.delete("/api/classes/{class_id}")
def delete_class_session(class_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Elimina o da por terminada una clase creada por el docente."""
    if current_user.role != "docente":
        raise HTTPException(status_code=403, detail="Solo los docentes pueden eliminar clases.")

    cls = db.query(ClassSession).filter(ClassSession.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Clase no encontrada.")

    if cls.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el docente creador de esta clase puede eliminarla.")

    class_title = cls.title
    # Eliminar matriculaciones de alumnos en esta clase
    db.query(ClassEnrollment).filter(ClassEnrollment.class_id == class_id).delete()
    db.delete(cls)
    db.commit()

    return {
        "status": "success",
        "message": f"La clase '{class_title}' ha sido eliminada y dada por terminada exitosamente."
    }


@app.delete("/api/classes/{class_id}/enrollment")
def leave_class(class_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Permite al alumno salir/desvincularse de una clase en la que está inscrito."""
    if current_user.role != "alumno":
        raise HTTPException(status_code=403, detail="Solo los alumnos pueden salir de una clase.")

    enrollment = db.query(ClassEnrollment).filter(
        ClassEnrollment.class_id == class_id,
        ClassEnrollment.student_id == current_user.id
    ).first()

    if not enrollment:
        raise HTTPException(status_code=404, detail="No estás inscrito en esta clase.")

    cls_title = enrollment.class_session.title if enrollment.class_session else "la clase"
    db.delete(enrollment)
    db.commit()

    return {
        "status": "success",
        "message": f"Has salido exitosamente de la clase '{cls_title}'."
    }


# ==========================================
# 4. Módulo de Casos Jurídicos (Base y Docente)
# ==========================================
@app.get("/api/cases")
def get_cases(current_user: Optional[User] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    """Devuelve la lista completa de casos jurídicos (base y publicados por docentes)."""
    cases = db.query(CaseModel).order_by(CaseModel.number.asc()).all()
    result = []

    for c in cases:
        try:
            context_list = json.loads(c.contexto)
        except Exception:
            context_list = [c.contexto] if c.contexto else []

        can_edit = bool(
            current_user and
            current_user.role == "docente" and
            not c.is_default and
            c.created_by_teacher_id == current_user.id
        )

        result.append({
            "id": c.id,
            "number": c.number,
            "titulo": c.titulo,
            "enunciado": c.enunciado,
            "contexto": context_list,
            "hechos_relevantes": c.hechos_relevantes or "",
            "soporte_juridico": c.soporte_juridico or "",
            "is_default": c.is_default,
            "teacher_name": c.teacher_name,
            "can_edit": can_edit
        })

    return result


@app.post("/api/cases")
def create_case(payload: CaseCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Publica un nuevo caso propuesto por el docente.
    Campos obligatorios recibidos: enunciado, contexto, hechos relevantes, soporte jurídico.
    ID y Título se calculan automáticamente de forma secuencial (ej. Caso 41 -> caso_041).
    """
    if current_user.role != "docente":
        raise HTTPException(status_code=403, detail="Solo los docentes pueden publicar nuevos casos.")

    # Calcular siguiente número correlativo
    max_num = db.query(func.max(CaseModel.number)).scalar() or 40
    next_num = max_num + 1

    case_id = f"caso_{next_num:03d}"
    case_title = f"Caso {next_num}"

    context_list = [p.strip() for p in payload.contexto.split("\n") if p.strip()] if payload.contexto else []
    context_json = json.dumps(context_list, ensure_ascii=False)

    new_case = CaseModel(
        id=case_id,
        number=next_num,
        titulo=case_title,
        enunciado=payload.enunciado.strip(),
        contexto=context_json,
        hechos_relevantes=payload.hechos_relevantes.strip(),
        soporte_juridico=payload.soporte_juridico.strip(),
        is_default=False,
        created_by_teacher_id=current_user.id,
        teacher_name=current_user.full_name
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    # Crear archivos físicos .json y .md en data/casos para persistencia y soporte RAG
    try:
        os.makedirs(CASOS_DIR, exist_ok=True)
        json_path = os.path.join(CASOS_DIR, f"{case_id}.json")
        json_data = {
            "id": case_id,
            "titulo": case_title,
            "enunciado": new_case.enunciado,
            "contexto": context_list,
            "hechos_relevantes": new_case.hechos_relevantes,
            "soporte_juridico": new_case.soporte_juridico,
            "teacher_name": current_user.full_name,
            "is_default": False,
            "instrucciones": [
                "Redacta tu respuesta con orden lógico.",
                "Incluye premisas, conclusión y sustento jurídico.",
                "Evita contradicciones internas.",
                "Usa conectores argumentativos claros."
            ],
            "criterios_evaluacion": [
                "Estructura lógica del argumento",
                "Relevancia y pertinencia del contenido",
                "Consistencia lógica del razonamiento",
                "Cohesión y calidad discursiva"
            ]
        }
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)

        md_path = os.path.join(CASOS_DIR, f"{case_id}.md")
        md_text = f"""# {case_title} - Propuesto por {current_user.full_name}

## Hechos relevantes
{new_case.hechos_relevantes}

## Soporte constitucional y jurídico sugerido
{new_case.soporte_juridico}

## Enunciado
{new_case.enunciado}

## Contexto
{payload.contexto}
"""
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(md_text)
    except Exception as e:
        print(f"Aviso: no se pudo escribir archivo físico para {case_id}: {e}")

    return {
        "status": "success",
        "message": f"Caso {next_num} publicado con éxito.",
        "case": {
            "id": new_case.id,
            "number": new_case.number,
            "titulo": new_case.titulo,
            "enunciado": new_case.enunciado,
            "contexto": context_list,
            "hechos_relevantes": new_case.hechos_relevantes,
            "soporte_juridico": new_case.soporte_juridico,
            "teacher_name": new_case.teacher_name,
            "is_default": False,
            "can_edit": True
        }
    }


@app.put("/api/cases/{case_id}")
def update_case(case_id: str, payload: CaseUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Modifica un caso. Solo permitido para casos creados por el docente conectado."""
    if current_user.role != "docente":
        raise HTTPException(status_code=403, detail="Solo los docentes pueden modificar casos.")

    caso = db.query(CaseModel).filter(CaseModel.id == case_id).first()
    if not caso:
        raise HTTPException(status_code=404, detail="Caso no encontrado.")

    if caso.is_default:
        raise HTTPException(status_code=403, detail="Los 40 casos originales están protegidos y no pueden ser modificados.")

    if caso.created_by_teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el docente que publicó este caso puede modificarlo.")

    if payload.enunciado is not None:
        caso.enunciado = payload.enunciado.strip()
    if payload.contexto is not None:
        ctx_list = [p.strip() for p in payload.contexto.split("\n") if p.strip()]
        caso.contexto = json.dumps(ctx_list, ensure_ascii=False)
    if payload.hechos_relevantes is not None:
        caso.hechos_relevantes = payload.hechos_relevantes.strip()
    if payload.soporte_juridico is not None:
        caso.soporte_juridico = payload.soporte_juridico.strip()

    db.commit()
    db.refresh(caso)

    # Actualizar archivos físicos
    try:
        json_path = os.path.join(CASOS_DIR, f"{case_id}.json")
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            data["enunciado"] = caso.enunciado
            data["contexto"] = json.loads(caso.contexto)
            data["hechos_relevantes"] = caso.hechos_relevantes
            data["soporte_juridico"] = caso.soporte_juridico
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        md_path = os.path.join(CASOS_DIR, f"{case_id}.md")
        md_text = f"""# {caso.titulo} - Propuesto por {caso.teacher_name}

## Hechos relevantes
{caso.hechos_relevantes}

## Soporte constitucional y jurídico sugerido
{caso.soporte_juridico}

## Enunciado
{caso.enunciado}

## Contexto
{caso.contexto}
"""
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(md_text)
    except Exception as e:
        print(f"Aviso actualizando archivos físicos de {case_id}: {e}")

    return {"status": "success", "message": f"{caso.titulo} actualizado correctamente."}


@app.delete("/api/cases/{case_id}")
def delete_case(case_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Elimina un caso creado por el docente.
    Los 40 casos base oficiales están protegidos y nunca pueden eliminarse.
    """
    if current_user.role != "docente":
        raise HTTPException(status_code=403, detail="Solo los docentes pueden eliminar casos.")

    caso = db.query(CaseModel).filter(CaseModel.id == case_id).first()
    if not caso:
        raise HTTPException(status_code=404, detail="Caso no encontrado.")

    if caso.is_default:
        raise HTTPException(status_code=403, detail="Los 40 casos originales están protegidos y no pueden ser eliminados.")

    if caso.created_by_teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el docente que publicó este caso puede eliminarlo.")

    caso_titulo = caso.titulo

    # Eliminar evaluaciones asociadas a este caso
    db.query(EvaluationSubmission).filter(EvaluationSubmission.case_id == case_id).delete()

    # Eliminar archivos físicos .json y .md en data/casos
    try:
        json_path = os.path.join(CASOS_DIR, f"{case_id}.json")
        md_path = os.path.join(CASOS_DIR, f"{case_id}.md")
        if os.path.exists(json_path):
            os.remove(json_path)
        if os.path.exists(md_path):
            os.remove(md_path)
    except Exception as e:
        print(f"Aviso al eliminar archivos físicos de {case_id}: {e}")

    db.delete(caso)
    db.commit()

    return {"status": "success", "message": f"{caso_titulo} eliminado correctamente."}


# ==========================================
# 5. Módulo de Dictado y Transcripción
# ==========================================
@app.post("/api/transcribe")
def transcribe_audio(payload: AudioTranscriptionRequest):
    """Transcribe audio enviado en base64 usando Deepgram Nova-2."""
    if not payload.audio_base64:
        raise HTTPException(status_code=400, detail="No se proporcionó audio")

    try:
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
            raise HTTPException(status_code=response.status_code, detail=f"Error en servicio de transcripción: {response.text}")

        data = response.json()
        transcript = ""
        results = data.get("results", {})
        channels = results.get("channels", [])
        if channels:
            alternatives = channels[0].get("alternatives", [])
            if alternatives:
                transcript = alternatives[0].get("transcript", "")

        return {
            "status": "success",
            "text": transcript.strip()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error transcribiendo audio: {str(e)}")


# ==========================================
# 6. Evaluación de Coherencia Argumentativa
# ==========================================
@app.post("/api/evaluate")
def evaluate_argument(
    submission: ArgumentSubmission,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Ejecuta el grafo de LangGraph para evaluar el argumento del estudiante.
    Si el alumno está autenticado, persiste la evaluación en su historial.
    """
    if not submission.student_argument.strip():
        raise HTTPException(status_code=400, detail="El argumento no puede estar vacío")

    # Obtener el caso desde la base de datos
    caso = db.query(CaseModel).filter(CaseModel.id == submission.case_id).first()
    if not caso:
        raise HTTPException(status_code=404, detail="Caso no encontrado")

    # Contexto para el RAG y LangGraph
    case_context = f"Título: {caso.titulo}\nEnunciado: {caso.enunciado}\n"
    if caso.hechos_relevantes:
        case_context += f"Hechos relevantes: {caso.hechos_relevantes}\n"
    if caso.soporte_juridico:
        case_context += f"Soporte constitucional y jurídico sugerido: {caso.soporte_juridico}\n"
    case_context += f"Contexto: {caso.contexto}"

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
        result_state = evaluator_app.invoke(initial_state)

        # Calcular score total ponderado
        scores = result_state.get("rubric_scores", {})
        total_score = round(
            ((scores.get("estructura_logica", 0) * 0.25) +
             (scores.get("relevancia_pertinencia", 0) * 0.25) +
             (scores.get("consistencia_logica", 0) * 0.25) +
             (scores.get("cohesion_calidad", 0) * 0.25)),
            2
        )

        # Si el usuario es un alumno autenticado, persistir en su historial
        if current_user and current_user.role == "alumno":
            new_sub = EvaluationSubmission(
                student_id=current_user.id,
                case_id=submission.case_id,
                student_argument=submission.student_argument,
                toulmin_analysis=json.dumps(result_state.get("toulmin_analysis", {}), ensure_ascii=False),
                rubric_scores=json.dumps(scores, ensure_ascii=False),
                final_feedback=result_state.get("final_feedback", ""),
                retrieved_laws=result_state.get("retrieved_laws", ""),
                score_total=total_score
            )
            db.add(new_sub)
            db.commit()

        return {
            "status": "success",
            "score_total": total_score,
            "retrieved_laws": result_state.get("retrieved_laws", ""),
            "toulmin_analysis": result_state.get("toulmin_analysis", {}),
            "rubric_scores": scores,
            "final_feedback": result_state.get("final_feedback", "")
        }
    except Exception as e:
        print(f"Error evaluando argumento: {e}")
        raise HTTPException(status_code=500, detail=f"Error en evaluación de IA: {str(e)}")


# ==========================================
# 7. Historial y Analítica Gráfica del Alumno
# ==========================================
@app.get("/api/evaluations/my")
def get_my_evaluation_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retorna el historial completo de casos resueltos por el alumno autenticado."""
    if current_user.role != "alumno":
        raise HTTPException(status_code=403, detail="Acceso exclusivo para alumnos.")

    submissions = db.query(EvaluationSubmission).filter(
        EvaluationSubmission.student_id == current_user.id
    ).order_by(desc(EvaluationSubmission.created_at)).all()

    result = []
    for s in submissions:
        case = db.query(CaseModel).filter(CaseModel.id == s.case_id).first()
        try:
            rubric = json.loads(s.rubric_scores)
        except Exception:
            rubric = {}
        try:
            toulmin = json.loads(s.toulmin_analysis)
        except Exception:
            toulmin = {}

        result.append({
            "id": s.id,
            "case_id": s.case_id,
            "case_title": case.titulo if case else s.case_id,
            "score_total": s.score_total,
            "created_at": s.created_at.isoformat(),
            "student_argument": s.student_argument,
            "rubric_scores": rubric,
            "toulmin_analysis": toulmin,
            "final_feedback": s.final_feedback,
            "retrieved_laws": s.retrieved_laws
        })

    return result


@app.delete("/api/evaluations/my")
def delete_my_evaluation_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Elimina permanentemente todo el historial de evaluaciones del alumno autenticado."""
    if current_user.role != "alumno":
        raise HTTPException(status_code=403, detail="Acceso exclusivo para alumnos.")

    count = db.query(EvaluationSubmission).filter(EvaluationSubmission.student_id == current_user.id).delete()
    db.commit()

    return {
        "status": "success",
        "message": f"Se eliminaron {count} evaluaciones de tu historial.",
        "deleted_count": count
    }


@app.get("/api/evaluations/stats")
def get_my_evaluation_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retorna métricas y datos estructurados para los gráficos de desempeño del alumno."""
    if current_user.role != "alumno":
        raise HTTPException(status_code=403, detail="Acceso exclusivo para alumnos.")

    submissions = db.query(EvaluationSubmission).filter(
        EvaluationSubmission.student_id == current_user.id
    ).order_by(EvaluationSubmission.created_at.asc()).all()

    total_submissions = len(submissions)
    if total_submissions == 0:
        return {
            "total_cases_resolved": 0,
            "average_general": 0.0,
            "criteria_averages": {
                "estructura_logica": 0.0,
                "relevancia_pertinencia": 0.0,
                "consistencia_logica": 0.0,
                "cohesion_calidad": 0.0
            },
            "timeline": [],
            "performance_levels": {
                "Muy bajo": 0,
                "Bajo": 0,
                "Medio": 0,
                "Alto": 0,
                "Excelente": 0
            }
        }

    sum_estructura = 0
    sum_relevancia = 0
    sum_consistencia = 0
    sum_cohesion = 0
    sum_total = 0.0

    levels = {"Muy bajo": 0, "Bajo": 0, "Medio": 0, "Alto": 0, "Excelente": 0}
    timeline = []

    for idx, s in enumerate(submissions):
        case = db.query(CaseModel).filter(CaseModel.id == s.case_id).first()
        case_title = case.titulo if case else f"Caso {idx + 1}"
        sum_total += s.score_total

        # Nivel
        tot = s.score_total
        if tot <= 1.9:
            levels["Muy bajo"] += 1
        elif tot <= 2.9:
            levels["Bajo"] += 1
        elif tot <= 3.9:
            levels["Medio"] += 1
        elif tot <= 4.9:
            levels["Alto"] += 1
        else:
            levels["Excelente"] += 1

        try:
            r = json.loads(s.rubric_scores)
            sum_estructura += r.get("estructura_logica", r.get("estructura", 0))
            sum_relevancia += r.get("relevancia_pertinencia", r.get("relevancia", 0))
            sum_consistencia += r.get("consistencia_logica", r.get("consistencia", 0))
            sum_cohesion += r.get("cohesion_calidad", r.get("cohesion", 0))
        except Exception:
            pass

        timeline.append({
            "index": idx + 1,
            "case_title": case_title,
            "score": s.score_total,
            "date": s.created_at.strftime("%d/%m")
        })

    avg_general = round(sum_total / total_submissions, 2)
    avg_estructura = round(sum_estructura / total_submissions, 2)
    avg_relevancia = round(sum_relevancia / total_submissions, 2)
    avg_consistencia = round(sum_consistencia / total_submissions, 2)
    avg_cohesion = round(sum_cohesion / total_submissions, 2)

    return {
        "total_cases_resolved": total_submissions,
        "average_general": avg_general,
        "criteria_averages": {
            "estructura_logica": avg_estructura,
            "relevancia_pertinencia": avg_relevancia,
            "consistencia_logica": avg_consistencia,
            "cohesion_calidad": avg_cohesion
        },
        "timeline": timeline,
        "performance_levels": levels
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
