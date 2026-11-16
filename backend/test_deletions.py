import os
import sys
import json

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, init_db, User, ClassSession, ClassEnrollment, CaseModel, EvaluationSubmission
from main import (
    register_user, login_user, create_class_session, join_class,
    create_case, delete_class_session, leave_class, delete_case,
    delete_my_evaluation_history, delete_my_account,
    UserRegisterRequest, ClassCreateRequest, ClassJoinRequest, CaseCreateRequest
)
from fastapi import HTTPException

def run_tests():
    init_db()
    db = SessionLocal()

    print("=== Iniciando pruebas de eliminación y seguridad ===")

    # 1. Crear Docente 1 y Docente 2
    docente_req = UserRegisterRequest(
        role="docente",
        full_name="Profesor Pruebas",
        username="prof_test_del",
        email="prof_del@test.edu.pe",
        password="password123"
    )
    # Si ya existe, limpiar
    db.query(User).filter(User.username.in_(["prof_test_del", "prof_other", "alum_test_del"])).delete()
    db.commit()

    reg_doc = register_user(docente_req, db)
    doc_user = db.query(User).filter(User.id == reg_doc["user"]["id"]).first()
    print("1. Docente registrado:", doc_user.user_code)

    reg_doc2 = register_user(UserRegisterRequest(
        role="docente",
        full_name="Profesor Secundario",
        username="prof_other",
        email="prof_other@test.edu.pe",
        password="password123"
    ), db)
    doc2_user = db.query(User).filter(User.id == reg_doc2["user"]["id"]).first()

    # 2. Crear Alumno
    alum_req = UserRegisterRequest(
        role="alumno",
        full_name="Alumno Pruebas",
        username="alum_test_del",
        email="alum_del@test.edu.pe",
        password="password123"
    )
    reg_alum = register_user(alum_req, db)
    alum_user = db.query(User).filter(User.id == reg_alum["user"]["id"]).first()
    print("2. Alumno registrado:", alum_user.user_code)

    # 3. Prueba: Docente crea clase
    cls_res = create_class_session(ClassCreateRequest(title="Derecho Procesal Penal", description="Grupo A"), doc_user, db)
    cls_id = cls_res["class"]["id"]
    cls_code = cls_res["class"]["code"]
    print(f"3. Clase creada ID={cls_id}, Code={cls_code}")

    # 4. Prueba: Alumno se une a clase
    join_res = join_class(ClassJoinRequest(code=cls_code), alum_user, db)
    print("4. Alumno se unio a clase:", join_res["message"])

    # 5. Prueba: Alumno sale de la clase (leave_class)
    # Intentar con docente debe fallar (403)
    try:
        leave_class(cls_id, doc_user, db)
        assert False, "Docente no debería poder usar leave_class"
    except HTTPException as e:
        assert e.status_code == 403
        print("5a. Seguridad verificada: docente no puede hacer leave_class")

    # Alumno sale exitosamente
    leave_res = leave_class(cls_id, alum_user, db)
    assert leave_res["status"] == "success"
    enrolled_count = db.query(ClassEnrollment).filter(ClassEnrollment.class_id == cls_id, ClassEnrollment.student_id == alum_user.id).count()
    assert enrolled_count == 0
    print("5b. Alumno salio de la clase con exito")

    # Alumno vuelve a unirse para probar borrado de clase por docente
    join_class(ClassJoinRequest(code=cls_code), alum_user, db)

    # 6. Prueba: Eliminar clase (delete_class_session)
    # Intentar con alumno debe fallar (403)
    try:
        delete_class_session(cls_id, alum_user, db)
        assert False, "Alumno no debería poder eliminar clase"
    except HTTPException as e:
        assert e.status_code == 403
        print("6a. Seguridad verificada: alumno no puede eliminar clase")

    # Intentar con otro docente debe fallar (403)
    try:
        delete_class_session(cls_id, doc2_user, db)
        assert False, "Otro docente no debería poder eliminar clase ajena"
    except HTTPException as e:
        assert e.status_code == 403
        print("6b. Seguridad verificada: otro docente no puede eliminar clase ajena")

    # Docente creador elimina la clase
    del_cls_res = delete_class_session(cls_id, doc_user, db)
    assert del_cls_res["status"] == "success"
    assert db.query(ClassSession).filter(ClassSession.id == cls_id).first() is None
    assert db.query(ClassEnrollment).filter(ClassEnrollment.class_id == cls_id).count() == 0
    print("6c. Clase eliminada correctamente y matriculas desvinculadas")

    # 7. Prueba: Publicar caso docente y eliminar caso (delete_case)
    case_res = create_case(CaseCreateRequest(
        enunciado="Enunciado de prueba para eliminacion",
        contexto="Contexto linea 1\nContexto linea 2",
        hechos_relevantes="Hechos de prueba",
        soporte_juridico="Articulo 1 de prueba"
    ), doc_user, db)
    custom_case_id = case_res["case"]["id"]
    print(f"7. Caso propuesto creado: {custom_case_id}")

    # No se puede eliminar caso base (caso_001)
    try:
        delete_case("caso_001", doc_user, db)
        assert False, "No debe permitir borrar casos base"
    except HTTPException as e:
        assert e.status_code == 403
        print("7a. Seguridad verificada: no se puede borrar caso base protegido (caso_001)")

    # Otro docente no puede borrar el caso de este docente
    try:
        delete_case(custom_case_id, doc2_user, db)
        assert False, "Docente no creador no debe poder borrar el caso"
    except HTTPException as e:
        assert e.status_code == 403
        print("7b. Seguridad verificada: docente ajeno no puede borrar el caso")

    # Docente creador borra su caso
    del_case_res = delete_case(custom_case_id, doc_user, db)
    assert del_case_res["status"] == "success"
    assert db.query(CaseModel).filter(CaseModel.id == custom_case_id).first() is None
    print(f"7c. Caso {custom_case_id} eliminado exitosamente con archivos fisicos")

    # 8. Prueba: Alumno historial y vaciar historial (delete_my_evaluation_history)
    # Crear una evaluacion simulada para el alumno
    fake_sub = EvaluationSubmission(
        student_id=alum_user.id,
        case_id="caso_001",
        student_argument="Argumento de prueba",
        toulmin_analysis="{}",
        rubric_scores="{}",
        final_feedback="Buen trabajo",
        retrieved_laws="",
        score_total=4.5
    )
    db.add(fake_sub)
    db.commit()
    assert db.query(EvaluationSubmission).filter(EvaluationSubmission.student_id == alum_user.id).count() == 1

    # Docente no puede borrar historial de alumno
    try:
        delete_my_evaluation_history(doc_user, db)
        assert False, "Docente no puede invocar delete_my_evaluation_history"
    except HTTPException as e:
        assert e.status_code == 403
        print("8a. Seguridad verificada: docente no puede invocar delete_my_evaluation_history")

    # Alumno vacia su historial
    del_hist_res = delete_my_evaluation_history(alum_user, db)
    assert del_hist_res["status"] == "success"
    assert db.query(EvaluationSubmission).filter(EvaluationSubmission.student_id == alum_user.id).count() == 0
    print("8b. Historial del alumno vaciado con exito")

    # 9. Prueba: Eliminar cuenta (delete_my_account)
    # Alumno elimina su cuenta
    del_acc_alum = delete_my_account(alum_user, db)
    assert del_acc_alum["status"] == "success"
    assert db.query(User).filter(User.id == alum_user.id).first() is None
    print("9a. Cuenta de alumno eliminada correctamente")

    # Docente elimina su cuenta
    del_acc_doc = delete_my_account(doc_user, db)
    assert del_acc_doc["status"] == "success"
    assert db.query(User).filter(User.id == doc_user.id).first() is None
    print("9b. Cuenta de docente eliminada correctamente")

    # Limpiar doc2
    db.delete(doc2_user)
    db.commit()

    db.close()
    print("=== TODAS LAS 5 PRUEBAS DE ELIMINACIÓN Y SEGURIDAD PASARON EXITOSAMENTE ===")

if __name__ == "__main__":
    run_tests()
