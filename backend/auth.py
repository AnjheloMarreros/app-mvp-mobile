import os
import hmac
import hashlib
import base64
import json
import time
import secrets
import string
import bcrypt
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from database import User, get_db

SECRET_KEY = os.environ.get("AUTH_SECRET_KEY", "peru-juris-logic-eval-secure-key-2026")


def hash_password(password: str) -> str:
    """Hashea una contraseña usando bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si una contraseña en texto plano coincide con el hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def generate_user_code(db: Session, role: str) -> str:
    """
    Genera un ID aleatorio único con formato:
    - Alumno: 'AXXXXXXXX' (A + 8 dígitos)
    - Docente: 'DXXXXXXXX' (D + 8 dígitos)
    """
    prefix = "A" if role == "alumno" else "D"
    max_attempts = 100
    for _ in range(max_attempts):
        digits = "".join(secrets.choice(string.digits) for _ in range(8))
        code = f"{prefix}{digits}"
        # Verificar unicidad en la base de datos
        existing = db.query(User).filter(User.user_code == code).first()
        if not existing:
            return code
    # Fallback timestamp si colisiona (muy improbable)
    return f"{prefix}{int(time.time()) % 100000000:08d}"


def generate_class_code(db: Session) -> str:
    """
    Genera un ID aleatorio único para una clase/sesión: 'CLS-XXXXXX' (6 dígitos).
    """
    from database import ClassSession
    max_attempts = 100
    for _ in range(max_attempts):
        digits = "".join(secrets.choice(string.digits) for _ in range(6))
        code = f"CLS-{digits}"
        existing = db.query(ClassSession).filter(ClassSession.code == code).first()
        if not existing:
            return code
    return f"CLS-{secrets.randbelow(900000) + 100000}"


# ==========================================
# Signed Bearer Token Utilities (HMAC-SHA256)
# ==========================================
def create_access_token(data: Dict[str, Any], expires_in_seconds: int = 86400 * 7) -> str:
    """Crea un token firmado con HMAC-SHA256 válido por 7 días por defecto."""
    payload = data.copy()
    payload["exp"] = int(time.time()) + expires_in_seconds

    header_bytes = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode("utf-8")).rstrip(b"=")
    payload_bytes = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).rstrip(b"=")

    message = header_bytes + b"." + payload_bytes
    signature = hmac.new(SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
    sig_bytes = base64.urlsafe_b64encode(signature).rstrip(b"=")

    return (message + b"." + sig_bytes).decode("utf-8")


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodifica y verifica la firma y expiración del token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, sig_b64 = parts
        message = (header_b64 + "." + payload_b64).encode("utf-8")

        # Verificar firma
        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
        # Padding base64
        padded_sig = sig_b64 + "=" * (-len(sig_b64) % 4)
        actual_sig = base64.urlsafe_b64decode(padded_sig.encode("utf-8"))

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        # Decodificar payload
        padded_payload = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload_data = json.loads(base64.urlsafe_b64decode(padded_payload.encode("utf-8")).decode("utf-8"))

        # Verificar expiración
        if "exp" in payload_data and payload_data["exp"] < time.time():
            return None

        return payload_data
    except Exception:
        return None


def get_current_user_optional(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> Optional[User]:
    """Obtiene el usuario actual si el header Authorization contiene un token válido."""
    if not authorization:
        return None
    try:
        token = authorization.replace("Bearer ", "").strip()
        payload = decode_access_token(token)
        if not payload or "sub" not in payload:
            return None
        user_id = payload["sub"]
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None


def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> User:
    """Requiere autenticación obligatoria; de lo contrario lanza HTTP 401."""
    user = get_current_user_optional(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail="Sesión no válida o expirada. Por favor inicia sesión.")
    return user

