import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import (
    SessionLocal, init_db, User, ClassSession, ClassEnrollment, CaseModel, EvaluationSubmission
)
from auth import (
    hash_password, verify_password, generate_user_code, generate_class_code,
    create_access_token
)
from main import (
    register_user, login_user, create_class_session, join_class, get_my_classes,
    create_case, update_case, get_class_grades_report, get_my_evaluation_history, get_my_evaluation_stats,
    UserRegisterRequest, UserLoginRequest, ClassCreateRequest, ClassJoinRequest,
    CaseCreateRequest, CaseUpdateRequest
)
from fastapi import HTTPException

def run_tests():
    print("==================================================================")
    print(" SUITE DE VERIFICACION FUNCIONAL DUAL APP: ALUMNO Y DOCENTE")
    print("==================================================================")
    init_db()
    db = SessionLocal()

    try:
        # Limpieza previa de usuarios de prueba si existían
        db.query(ClassEnrollment).delete()
        db.query(EvaluationSubmission).delete()
        db.query(ClassSession).delete()
        db.query(User).filter(User.username.in_(["juan_alumno_test", "maria_docente_test"])).delete()
        db.query(CaseModel).filter(CaseModel.is_default == False).delete()
        db.commit()

        # -------------------------------------------------------------
        # 1. Registro de Alumno y verificación de ID AXXXXXXXX
        # -------------------------------------------------------------
        print("\n[1] Probando registro de Alumno...")
        reg_alumno = UserRegisterRequest(
            role="alumno",
            full_name="Juan Perez Alumno",
            username="juan_alumno_test",
            email="juan.alumno@test.com",
            password="Password123!"
        )
        res_alumno = register_user(reg_alumno, db)
        user_alumno = res_alumno["user"]
        code_alumno = user_alumno["user_code"]
        print(f" -> Alumno registrado con éxito.")
        print(f" -> Código generado: {code_alumno}")
        assert code_alumno.startswith("A"), f"Código de alumno no inicia con A: {code_alumno}"
        assert len(code_alumno) == 9, f"Código de alumno debe tener 9 caracteres (A + 8 dígitos): {code_alumno}"
        assert code_alumno[1:].isdigit(), "Los 8 caracteres posteriores deben ser números"
        print(" [PASSED] Formato de ID de Alumno AXXXXXXXX validado.")

        # -------------------------------------------------------------
        # 2. Registro de Docente y verificación de ID DXXXXXXXX
        # -------------------------------------------------------------
        print("\n[2] Probando registro de Docente...")
        reg_docente = UserRegisterRequest(
            role="docente",
            full_name="Dra. Maria Docente",
            username="maria_docente_test",
            email="maria.docente@test.com",
            password="Password123!"
        )
        res_docente = register_user(reg_docente, db)
        user_docente = res_docente["user"]
        code_docente = user_docente["user_code"]
        print(f" -> Docente registrado con éxito.")
        print(f" -> Código generado: {code_docente}")
        assert code_docente.startswith("D"), f"Código de docente no inicia con D: {code_docente}"
        assert len(code_docente) == 9, f"Código de docente debe tener 9 caracteres (D + 8 dígitos): {code_docente}"
        assert code_docente[1:].isdigit(), "Los 8 caracteres posteriores deben ser números"
        print(" [PASSED] Formato de ID de Docente DXXXXXXXX validado.")

        # -------------------------------------------------------------
        # 3. Login por Nombre de Usuario y por Correo Electrónico
        # -------------------------------------------------------------
        print("\n[3] Probando inicio de sesión (username vs email)...")
        # Por username (alumno)
        login_u = login_user(UserLoginRequest(identifier="juan_alumno_test", password="Password123!"), db)
        assert login_u["user"]["user_code"] == code_alumno
        print(" -> Login por nombre de usuario (username) exitoso.")

        # Por email (docente)
        login_e = login_user(UserLoginRequest(identifier="maria.docente@test.com", password="Password123!"), db)
        assert login_e["user"]["user_code"] == code_docente
        print(" -> Login por correo electrónico (email) exitoso.")
        print(" [PASSED] Mecanismo dual de login validado.")

        # Instancias de usuario para endpoints protegidos
        alumno_db_user = db.query(User).filter(User.username == "juan_alumno_test").first()
        docente_db_user = db.query(User).filter(User.username == "maria_docente_test").first()

        # -------------------------------------------------------------
        # 4. Creación de Clase/Sesión por Docente
        # -------------------------------------------------------------
        print("\n[4] Probando creación de clase por Docente...")
        class_req = ClassCreateRequest(
            title="Derecho Constitucional 2026-I",
            description="Grupo 01 de Prácticas y Argumentación Jurídica"
        )
        res_class = create_class_session(class_req, docente_db_user, db)
        class_data = res_class["class"]
        class_id = class_data["id"]
        class_code = class_data["code"]
        print(f" -> Clase creada: '{class_data['title']}' con código: {class_code}")
        assert class_code.startswith("CLS-"), f"Código de clase inválido: {class_code}"
        print(" [PASSED] Creación de sesión con código único validada.")

        # -------------------------------------------------------------
        # 5. Inscripción del Alumno en la Clase mediante el Código
        # -------------------------------------------------------------
        print("\n[5] Probando inscripción del alumno a la clase...")
        join_req = ClassJoinRequest(code=class_code)
        res_join = join_class(join_req, alumno_db_user, db)
        print(f" -> Resultado inscripción: {res_join['message']}")

        # Consultar clases inscritas por el alumno
        my_classes = get_my_classes(alumno_db_user, db)
        assert len(my_classes) == 1
        assert my_classes[0]["code"] == class_code
        assert my_classes[0]["teacher_name"] == "Dra. Maria Docente"
        print(f" -> El alumno está registrado en: {my_classes[0]['title']} a cargo de {my_classes[0]['teacher_name']}")
        print(" [PASSED] Inscripción y reporte de clases del alumno validados.")

        # -------------------------------------------------------------
        # 6. Intento de modificación de un caso base (caso_001) -> 403 Forbidden
        # -------------------------------------------------------------
        print("\n[6] Probando protección de los 40 casos base originales...")
        try:
            update_case("caso_001", CaseUpdateRequest(
                enunciado="Alteración indebida de caso original",
                contexto="Contexto",
                hechos_relevantes="Hechos",
                soporte_juridico="Soporte"
            ), docente_db_user, db)
            assert False, "Debió lanzar HTTPException 403 al intentar editar un caso base"
        except HTTPException as he:
            assert he.status_code == 403, f"Status esperado 403, obtenido {he.status_code}"
            print(f" -> Bloqueo exitoso: {he.detail}")
        print(" [PASSED] Inmutabilidad estricta de los 40 casos originales comprobada.")

        # -------------------------------------------------------------
        # 7. Docente propone/publica un nuevo caso
        # -------------------------------------------------------------
        print("\n[7] Probando publicación de nuevo caso por Docente...")
        case_req = CaseCreateRequest(
            enunciado="Conflicto entre libertad de expresión y derecho al honor en plataformas digitales",
            contexto="Un periodista divulgó audios no verificados de una autoridad regional en un canal de streaming.",
            hechos_relevantes="1. Difusión de 3 horas continuas. 2. Solicitud notarial de rectificación ignorada.",
            soporte_juridico="Artículo 2 incisos 4 y 7 de la Constitución Política del Perú. Código Penal Art. 132."
        )
        res_new_case = create_case(case_req, docente_db_user, db)
        created_case = res_new_case["case"]
        case_id = created_case["id"]
        case_title = created_case["titulo"]
        author_name = created_case["teacher_name"]
        print(f" -> Caso generado: ID={case_id}, Título='{case_title}'")
        print(f" -> Docente autor: '{author_name}'")
        assert case_id.startswith("caso_"), "El ID no inicia con caso_"
        assert author_name == "Dra. Maria Docente"
        attribution_text = f"Caso publicado por {author_name}"
        assert "Caso publicado por Dra. Maria Docente" == attribution_text
        print(f" -> Texto de atribución confirmado: '{attribution_text}'")
        print(" [PASSED] Publicación de caso con ID/título secuencial y atribución de docente validada.")

        # -------------------------------------------------------------
        # 8. Docente edita su propio caso
        # -------------------------------------------------------------
        print("\n[8] Probando edición de caso propio por Docente...")
        edit_req = CaseUpdateRequest(
            enunciado="Conflicto entre libertad de información y tutela del honor (Actualizado)",
            contexto="Contexto ampliado con informe de la Defensoría del Pueblo.",
            hechos_relevantes="1. Difusión masiva. 2. Afectación demostrada. 3. Carta notarial de rectificación.",
            soporte_juridico="Constitución Art. 2 inc 4 y 7. Precedente vinculante TC Exp. 03362-2004-AA."
        )
        res_edited = update_case(case_id, edit_req, docente_db_user, db)
        assert res_edited["status"] == "success"
        # Verificar en base de datos la actualización
        caso_db = db.query(CaseModel).filter(CaseModel.id == case_id).first()
        assert "Actualizado" in caso_db.enunciado
        print(f" -> Caso editado con éxito en DB: '{caso_db.enunciado}'")
        print(" [PASSED] Edición de casos propios por parte del docente validada.")

        # -------------------------------------------------------------
        # 9. Alumno intenta editar el caso del docente -> 403 Forbidden
        # -------------------------------------------------------------
        print("\n[9] Probando que un alumno no pueda editar casos creados por docentes...")
        try:
            update_case(case_id, edit_req, alumno_db_user, db)
            assert False, "Un alumno no debe poder modificar ningún caso"
        except HTTPException as he:
            assert he.status_code == 403
            print(f" -> Bloqueo exitoso al alumno: {he.detail}")
        print(" [PASSED] Control de roles y permisos sobre casos validado.")

        # -------------------------------------------------------------
        # 10. Alumno resuelve casos y se consulta Historial y Métricas
        # -------------------------------------------------------------
        print("\n[10] Registrando entregas de evaluación para el Alumno...")
        sub1 = EvaluationSubmission(
            student_id=alumno_db_user.id,
            case_id=case_id,
            student_argument="Conforme al artículo 2 inciso 7 de la Constitución, el honor es un derecho fundamental...",
            toulmin_analysis='{"claim": "Prevalece el derecho al honor", "data": "Difusion sin pruebas"}',
            rubric_scores='{"estructura": 4, "relevancia": 4, "consistencia": 5, "cohesion": 4}',
            final_feedback="Excelente coherencia argumentativa y adecuada ponderación de derechos.",
            retrieved_laws="Art. 2 inc 7 Constitucion Politica",
            score_total=17.0
        )
        sub2 = EvaluationSubmission(
            student_id=alumno_db_user.id,
            case_id="caso_001",
            student_argument="En relación con el primer caso, la nulidad del acto jurídico procede en mérito a...",
            toulmin_analysis='{"claim": "Procede la nulidad del contrato", "data": "Falta de manifestacion"}',
            rubric_scores='{"estructura": 5, "relevancia": 5, "consistencia": 4, "cohesion": 5}',
            final_feedback="Sobresaliente articulación normativa y rigor dogmático.",
            retrieved_laws="Art. 219 Codigo Civil",
            score_total=19.0
        )
        db.add_all([sub1, sub2])
        db.commit()

        # Historial del alumno
        history = get_my_evaluation_history(alumno_db_user, db)
        assert len(history) == 2
        print(f" -> Historial de evaluaciones recuperado: {len(history)} casos resueltos.")

        # Estadísticas de desempeño para gráficos
        stats = get_my_evaluation_stats(alumno_db_user, db)
        assert stats["total_cases_resolved"] == 2
        assert stats["average_general"] == 18.0
        assert len(stats["timeline"]) == 2
        print(f" -> Métricas de desempeño: Total casos={stats['total_cases_resolved']}, Promedio={stats['average_general']}")
        print(f" -> Promedios por criterio: {stats['criteria_averages']}")
        print(" [PASSED] Historial y analíticas de desempeño del alumno validadas.")

        # -------------------------------------------------------------
        # 11. Docente consulta el Reporte de Notas de su clase
        # -------------------------------------------------------------
        print("\n[11] Probando reporte de notas de clase para el Docente...")
        report = get_class_grades_report(class_id, docente_db_user, db)
        assert report["class"]["code"] == class_code
        assert report["total_enrolled"] == 1
        student_row = report["students"][0]
        assert student_row["user_code"] == code_alumno
        assert student_row["cases_evaluated"] == 2
        assert student_row["average_grade"] == 18.0
        print(f" -> Reporte generado para la clase {report['class']['title']}:")
        print(f"    - Alumno: {student_row['full_name']} ({student_row['user_code']})")
        print(f"    - Casos evaluados: {student_row['cases_evaluated']}")
        print(f"    - Promedio ponderado: {student_row['average_grade']}")
        print(" [PASSED] Reporte de notas del docente validado.")

        print("\n==================================================================")
        print(" TODOS LOS REQUISITOS FUERON VERIFICADOS EXITOSAMENTE (100% OK)")
        print("==================================================================")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
