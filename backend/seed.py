import os
import glob
import json
import re
from sqlalchemy.orm import Session
from database import CaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CASOS_DIR = os.path.join(BASE_DIR, "data", "casos")


def seed_default_cases(db: Session):
    """
    Lee los 40 casos iniciales desde data/casos/*.json y *.md
    y los registra en la base de datos SQLite con is_default=True si no existen aún.
    """
    if not os.path.exists(CASOS_DIR):
        print(f"Directorio de casos no encontrado: {CASOS_DIR}")
        return

    json_files = glob.glob(os.path.join(CASOS_DIR, "*.json"))
    print(f"Verificando siembra de {len(json_files)} casos...")

    inserted_count = 0
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            caso_id = data.get("id")
            if not caso_id:
                continue

            # Extraer número del caso (ej. caso_001 -> 1)
            num_match = re.search(r'\d+', caso_id)
            case_number = int(num_match.group()) if num_match else 0

            # Verificar si ya existe en la base de datos
            existing = db.query(CaseModel).filter(CaseModel.id == caso_id).first()
            if existing:
                continue

            # Leer archivo .md complementario si existe
            md_file = os.path.join(CASOS_DIR, f"{caso_id}.md")
            hechos_relevantes = ""
            soporte_juridico = ""

            if os.path.exists(md_file):
                with open(md_file, 'r', encoding='utf-8') as f:
                    md_content = f.read()

                # Extraer hechos relevantes
                hechos_match = re.search(r'## Hechos relevantes\s*\n(.*?)(?=\n##|$)', md_content, re.DOTALL)
                if hechos_match:
                    hechos_relevantes = hechos_match.group(1).strip()

                # Extraer soporte constitucional y jurídico sugerido
                soporte_match = re.search(r'## Soporte constitucional y jurídico sugerido\s*\n(.*?)(?=\n##|$)', md_content, re.DOTALL)
                if soporte_match:
                    soporte_juridico = soporte_match.group(1).strip()

            contexto_raw = data.get("contexto", [])
            contexto_str = json.dumps(contexto_raw if isinstance(contexto_raw, list) else [str(contexto_raw)], ensure_ascii=False)

            new_case = CaseModel(
                id=caso_id,
                number=case_number,
                titulo=data.get("titulo", f"Caso {case_number}"),
                enunciado=data.get("enunciado", ""),
                contexto=contexto_str,
                hechos_relevantes=hechos_relevantes,
                soporte_juridico=soporte_juridico,
                is_default=True,
                created_by_teacher_id=None,
                teacher_name=None
            )
            db.add(new_case)
            inserted_count += 1
        except Exception as e:
            print(f"Error procesando {json_file} en siembra: {e}")

    if inserted_count > 0:
        db.commit()
        print(f"Siembra completada: {inserted_count} casos base registrados en la base de datos.")
    else:
        print("Los casos base ya se encuentran sincronizados en la base de datos.")

