#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Restringe los permisos del directorio de la aplicación en Windows.
    Solo administradores pueden modificar archivos; usuarios estándar solo leen.

.DESCRIPTION
    Aplica ACLs con icacls para proteger la instalación de Gestor JAL en entornos
    donde el PC es compartido o accedido por usuarios no técnicos.
    Ejecutar DESPUÉS de instalar la aplicación, como Administrador.

.PARAMETER AppPath
    Ruta al directorio raíz de la aplicación. Por defecto: directorio padre de este script.

.PARAMETER ServiceUser
    Usuario o cuenta de servicio que ejecuta Node.js / PM2.
    Por defecto: usuario actual (para PM2 corriendo en sesión interactiva).

.EXAMPLE
    .\permisos-windows.ps1
    .\permisos-windows.ps1 -AppPath "C:\GestorJAL" -ServiceUser "DOMINIO\gestor-svc"
#>
param(
    [string]$AppPath    = (Split-Path $PSScriptRoot -Parent),
    [string]$ServiceUser = $env:USERNAME
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Host "  [>] $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "  [!!] $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  ================================================" -ForegroundColor White
Write-Host "   Gestor JAL — Configuracion de Permisos Windows" -ForegroundColor White
Write-Host "  ================================================" -ForegroundColor White
Write-Host ""
Write-Host "  Directorio de la app : $AppPath"
Write-Host "  Usuario de servicio  : $ServiceUser"
Write-Host ""

if (-not (Test-Path $AppPath)) {
    Write-Error "No se encontró el directorio: $AppPath"
    exit 1
}

# ── 1. Quitar herencia de permisos del directorio raíz ────────────────────────
Write-Step "Desactivando herencia de permisos en $AppPath ..."
icacls $AppPath /inheritance:d /T /Q
Write-Ok "Herencia desactivada"

# ── 2. Eliminar permisos existentes y aplicar desde cero ─────────────────────
Write-Step "Aplicando permisos: Administradores=Control Total, SYSTEM=Control Total..."
icacls $AppPath /grant "Administradores:(OI)(CI)F" /T /Q
icacls $AppPath /grant "SYSTEM:(OI)(CI)F"          /T /Q
Write-Ok "Permisos de administrador aplicados"

# ── 3. Permiso de lectura/ejecución para el usuario del servicio ──────────────
Write-Step "Aplicando permiso de lectura+ejecucion para usuario de servicio: $ServiceUser ..."
icacls $AppPath /grant "${ServiceUser}:(OI)(CI)RX" /T /Q
Write-Ok "Permiso de servicio aplicado"

# ── 4. Escritura en directorios de datos que el proceso necesita modificar ────
$WritableDirs = @(
    (Join-Path $AppPath "logs"),
    (Join-Path $AppPath "backend\data"),
    (Join-Path $AppPath "backend\data\output"),
    (Join-Path $AppPath "backend\data\backups"),
    (Join-Path $AppPath "backend\plantillas")
)
foreach ($dir in $WritableDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    icacls $dir /grant "${ServiceUser}:(OI)(CI)M" /T /Q
    Write-Ok "Escritura habilitada en $dir"
}

# ── 5. Proteger el archivo .env: solo Administradores pueden leerlo ───────────
$EnvFile = Join-Path $AppPath "deploy\.env"
if (Test-Path $EnvFile) {
    Write-Step "Protegiendo $EnvFile ..."
    icacls $EnvFile /inheritance:d /Q
    icacls $EnvFile /remove "Usuarios"       /Q
    icacls $EnvFile /remove $ServiceUser     /Q
    icacls $EnvFile /grant "Administradores:F" /Q
    icacls $EnvFile /grant "SYSTEM:F"          /Q
    Write-Ok ".env protegido (solo Administradores)"
} else {
    Write-Warn "deploy\.env no encontrado — crealo desde deploy\.env.example antes de ejecutar este script de nuevo"
}

# ── 6. Denegar escritura a grupo Usuarios estándar en toda la app ─────────────
Write-Step "Bloqueando escritura para grupo 'Usuarios' estandar..."
icacls $AppPath /deny "Usuarios:(OI)(CI)W" /T /Q
Write-Ok "Escritura denegada a usuarios estandar"

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Green
Write-Host "   Permisos configurados correctamente." -ForegroundColor Green
Write-Host "   Para verificar: icacls `"$AppPath`"" -ForegroundColor Green
Write-Host "  ================================================" -ForegroundColor Green
Write-Host ""
