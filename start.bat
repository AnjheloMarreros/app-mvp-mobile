@echo off
echo ========================================================
echo   Iniciando Evaluador de Coherencia Argumentativa
echo ========================================================

echo [1/2] Iniciando Backend FastAPI en el puerto 8000...
start "Backend FastAPI" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo [2/2] Iniciando Frontend Vite en el puerto 5173...
start "Frontend Vite" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Servidores iniciados en ventanas independientes.
echo Abre en tu navegador: http://localhost:5173/
echo ========================================================
