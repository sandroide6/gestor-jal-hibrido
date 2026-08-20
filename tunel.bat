@echo off
title Gestor JAL — Tunel ngrok
cd /d "%~dp0"

:: ============================================================
::  CONFIGURACION DEL TUNEL
:: ============================================================
set NGROK_AUTHTOKEN=tu_token_aqui
set NGROK_DOMAIN=tu-dominio.ngrok-free.dev
set BACKEND_PORT=3001
:: ============================================================

echo.
echo  =============================================
echo   GESTOR JAL - Tunel ngrok
echo  =============================================
echo.
echo  Dominio : https://%NGROK_DOMAIN%
echo  Puerto  : %BACKEND_PORT%
echo.

:: Verificar Python / venv
if not exist venv (
    echo  [ER] Entorno virtual no encontrado.
    echo       Ejecuta configurar.bat primero.
    pause
    exit /b 1
)

:: Detener tunel anterior si existe
echo  [..] Deteniendo tunel anterior...
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":4040 " ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)
taskkill /IM ngrok.exe /F >nul 2>&1
if exist logs\ngrok.pid (
    set /p OLD_PID=<logs\ngrok.pid
    taskkill /PID %OLD_PID% /F >nul 2>&1
)

:: Escribir token y dominio al .env del backend
echo  [..] Aplicando configuracion...
powershell -Command "(Get-Content backend\.env) -replace 'NGROK_AUTHTOKEN=.*', 'NGROK_AUTHTOKEN=%NGROK_AUTHTOKEN%' -replace 'NGROK_DOMAIN=.*', 'NGROK_DOMAIN=%NGROK_DOMAIN%' | Set-Content backend\.env"

:: Arrancar daemon ngrok
echo  [..] Iniciando tunel...
if not exist logs mkdir logs

powershell -Command "$env:NGROK_AUTHTOKEN='%NGROK_AUTHTOKEN%'; $env:NGROK_DOMAIN='%NGROK_DOMAIN%'; $env:BACKEND_PORT='%BACKEND_PORT%'; $proc = Start-Process -FilePath 'venv\Scripts\python.exe' -ArgumentList 'scripts\ngrok_daemon.py' -WorkingDirectory '%~dp0' -PassThru -WindowStyle Hidden; $proc.Id | Out-File 'logs\ngrok.pid' -Encoding utf8; Write-Host $proc.Id"

:: Esperar a que el tunel arranque
echo  [..] Esperando URL del tunel...
set ATTEMPTS=0
:WAIT_LOOP
timeout /t 2 /nobreak >nul
set /a ATTEMPTS+=1
if exist logs\ngrok_url.txt (
    set /p TUNNEL_URL=<logs\ngrok_url.txt
    goto TUNNEL_READY
)
if %ATTEMPTS% LSS 10 goto WAIT_LOOP

echo  [ER] El tunel no respondio a tiempo.
echo       Revisa que ngrok este instalado y el token sea valido.
pause
exit /b 1

:TUNNEL_READY
echo.
echo  =============================================
echo   TUNEL ACTIVO
echo  =============================================
echo.
echo   URL: %TUNNEL_URL%
echo.
echo   Comparte esta direccion para acceso remoto.
echo   Cierra esta ventana para detener el tunel.
echo  =============================================
echo.
pause
