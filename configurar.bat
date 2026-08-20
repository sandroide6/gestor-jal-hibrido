@echo off
title Gestor JAL — Configuracion inicial
cd /d "%~dp0"

echo.
echo  =============================================
echo   GESTOR JAL — Configuracion Inicial
echo  =============================================
echo.

:: Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ER] Python no encontrado.
    echo       Descarga Python 3.10+ desde: https://www.python.org/downloads/
    echo       Marca "Add Python to PATH" durante la instalacion
    pause
    exit /b 1
)

:: Crear entorno virtual si no existe
if not exist venv (
    echo  [..] Creando entorno virtual Python...
    python -m venv venv
    echo  [..] Instalando dependencias Python...
    venv\Scripts\pip install -r scripts\requirements.txt --quiet
    echo  [OK] Entorno virtual listo
)

:: Ejecutar configuracion
venv\Scripts\python gestor.py setup

pause
