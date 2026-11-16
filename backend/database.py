import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Boolean, DateTime, Float, ForeignKey
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "app.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_code = Column(String(10), unique=True, index=True, nullable=False)  # AXXXXXXXX o DXXXXXXXX
    role = Column(String(20), nullable=False)  # 'alumno' o 'docente'
    full_name = Column(String(150), nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    created_classes = relationship("ClassSession", back_populates="teacher", cascade="all, delete-orphan")
    enrollments = relationship("ClassEnrollment", back_populates="student", cascade="all, delete-orphan")
    submissions = relationship("EvaluationSubmission", back_populates="student", cascade="all, delete-orphan")


class ClassSession(Base):
    __tablename__ = "class_sessions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(15), unique=True, index=True, nullable=False)  # CLS-XXXXXX
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    teacher = relationship("User", back_populates="created_classes")
    enrollments = relationship("ClassEnrollment", back_populates="class_session", cascade="all, delete-orphan")


class ClassEnrollment(Base):
    __tablename__ = "class_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("class_sessions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    class_session = relationship("ClassSession", back_populates="enrollments")
    student = relationship("User", back_populates="enrollments")


class CaseModel(Base):
    __tablename__ = "cases"

    id = Column(String(30), primary_key=True, index=True)  # caso_001, caso_041
    number = Column(Integer, unique=True, index=True, nullable=False)  # 1, 41
    titulo = Column(String(150), nullable=False)  # "Caso 1", "Caso 41"
    enunciado = Column(Text, nullable=False)
    contexto = Column(Text, nullable=False)  # JSON string con la lista de antecedentes
    hechos_relevantes = Column(Text, nullable=True)
    soporte_juridico = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)  # True para los 40 originales
    created_by_teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    teacher_name = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class EvaluationSubmission(Base):
    __tablename__ = "evaluation_submissions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    case_id = Column(String(30), ForeignKey("cases.id"), nullable=False)
    student_argument = Column(Text, nullable=False)
    toulmin_analysis = Column(Text, nullable=False)  # JSON string
    rubric_scores = Column(Text, nullable=False)  # JSON string
    final_feedback = Column(Text, nullable=False)
    retrieved_laws = Column(Text, nullable=True)
    score_total = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    student = relationship("User", back_populates="submissions")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

