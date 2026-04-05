@echo off
echo ===================================================
echo     Starting CardioSense AI - Full Stack System
echo ===================================================

echo [1/2] Starting Python AI Backend (Flask on Port 5000)...
start "CardioSense Backend" cmd /k "cd backend && call venv\Scripts\activate.bat && python app.py"

echo [2/2] Starting React Web Frontend (Vite on Port 5173/5174)...
start "CardioSense Frontend" cmd /k "cd frontend && npm run dev"

echo ===================================================
echo   System is booting! Two command windows open.
echo   You can go to your web browser up to localhost:5173
echo ===================================================
pause
