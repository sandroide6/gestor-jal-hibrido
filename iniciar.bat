@echo off
title Gestor JAL - Iniciando
cd /d "%~dp0"

echo.
echo  =============================================
echo   GESTOR JAL - Sistema de Gestion Documental
echo  =============================================
echo.

if not exist venv (
    echo  [!!] El entorno virtual no existe. Ejecuta primero configurar.bat
    pause
    exit /b 1
)

venv\Scripts\python gestor.py start

pause
