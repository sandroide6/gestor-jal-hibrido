@echo off
title Gestor JAL — Estado del sistema
cd /d "%~dp0"

if not exist venv (
    echo  [!!] El entorno virtual no existe. Ejecuta primero configurar.bat
    pause
    exit /b 1
)

venv\Scripts\python gestor.py status

pause
