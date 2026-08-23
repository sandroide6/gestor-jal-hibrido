@echo off
title Gestor JAL — Receptor local de documentos
cd /d "%~dp0"

:: ============================================================
::  Recibe en este PC, en tiempo real, cada documento que se
::  genere desde la app en la nube. Requiere Tailscale conectado
::  (ver docs/DESPLIEGUE_HIBRIDO.md, seccion 4).
:: ============================================================
set LOCAL_DOC_RECEIVER_TOKEN=tu_token_aqui
set LOCAL_DOC_RECEIVER_PORT=4001
set LOCAL_DOC_OUTPUT_PATH=%~dp0documentos_locales

echo.
echo  =============================================
echo   GESTOR JAL - Receptor local de documentos
echo  =============================================
echo.
echo  Guardando en: %LOCAL_DOC_OUTPUT_PATH%
echo  Puerto: %LOCAL_DOC_RECEIVER_PORT%
echo.
echo  Deja esta ventana abierta. Cada documento generado desde
echo  la app en la nube va a aparecer aqui automaticamente.
echo.

node scripts\local_doc_receiver.js
pause
