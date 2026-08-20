@echo off
:: Verificar si se ejecuta como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================
echo  Gestor JAL - Evitar suspension del equipo
echo ============================================
echo.

:: Nunca suspender (enchufado y con bateria)
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0

:: Nunca apagar pantalla automaticamente
powercfg /change monitor-timeout-ac 0
powercfg /change monitor-timeout-dc 0

:: Nunca apagar disco duro
powercfg /change disk-timeout-ac 0
powercfg /change disk-timeout-dc 0

:: Deshabilitar hibernacion
powercfg /change hibernate-timeout-ac 0
powercfg /change hibernate-timeout-dc 0
powercfg /hibernate off

echo [OK] El equipo nunca se suspendara automaticamente.
echo [OK] El equipo nunca hibernara automaticamente.
echo.
echo Estos cambios son permanentes hasta que los revertias manualmente.
echo.
pause
