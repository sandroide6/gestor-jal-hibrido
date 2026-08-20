@echo off
title Gestor JAL — Deteniendo servicios
cd /d "%~dp0"

echo.
echo  =============================================
echo   GESTOR JAL — Deteniendo Servicios
echo  =============================================
echo.

if not exist venv (
    echo  [!!] El entorno virtual no existe. Ejecuta primero configurar.bat
    pause
    exit /b 1
)

venv\Scripts\python gestor.py stop

pause
