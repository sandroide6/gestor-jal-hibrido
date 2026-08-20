"""Inicia todos los servicios de Gestor JAL en Windows."""

import os
import sys
import time
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.utils import (
    ok, info, warn, error, title,
    load_env, is_port_open,
    load_pids, save_pids,
    ROOT, BACKEND_DIR, FRONTEND_DIR, LOGS_DIR,
)

_CREACION_FLAGS = subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0


def _abrir_log(nombre: str):
    LOGS_DIR.mkdir(exist_ok=True)
    return open(LOGS_DIR / f'{nombre}.log', 'a', encoding='utf-8')


def ejecutar_migraciones(env_vars: dict) -> bool:
    """Corre db:migrate (idempotente — solo aplica las migraciones pendientes)."""
    info("Verificando migraciones de base de datos...")
    r = subprocess.run(
        'npm run db:migrate',
        cwd=str(BACKEND_DIR),
        shell=True,
        env={**os.environ, **env_vars},
    )
    if r.returncode != 0:
        error("Las migraciones fallaron — revisa la conexión a PostgreSQL")
        return False
    ok("Migraciones al día")
    return True


def iniciar_backend(env_vars: dict) -> int | None:
    """Lanza el servidor Express en el puerto 3001."""
    if is_port_open('localhost', 3001):
        warn("Backend ya está corriendo en el puerto 3001")
        return None

    info("Iniciando backend (Node.js / Express)...")
    proc = subprocess.Popen(
        'node src/index.js',
        cwd=str(BACKEND_DIR),
        env={**os.environ, **env_vars},
        shell=True,
        stdout=_abrir_log('backend'),
        stderr=subprocess.STDOUT,
        creationflags=_CREACION_FLAGS,
    )

    for _ in range(20):
        time.sleep(1)
        if is_port_open('localhost', 3001):
            ok(f"Backend iniciado  → http://localhost:3001  (PID {proc.pid})")
            return proc.pid

    warn("El backend tardó en responder — revisa logs/backend.log")
    return proc.pid


def iniciar_frontend() -> int | None:
    """Lanza el servidor de desarrollo Vite en el puerto 5173."""
    if is_port_open('localhost', 5173):
        warn("Frontend ya está corriendo en el puerto 5173")
        return None

    info("Iniciando frontend (Vite dev server)...")
    proc = subprocess.Popen(
        'npm run dev',
        cwd=str(FRONTEND_DIR),
        shell=True,
        stdout=_abrir_log('frontend'),
        stderr=subprocess.STDOUT,
        creationflags=_CREACION_FLAGS,
    )

    for _ in range(25):
        time.sleep(1)
        if is_port_open('localhost', 5173):
            ok(f"Frontend iniciado → http://localhost:5173  (PID {proc.pid})")
            return proc.pid

    warn("El frontend tardó en responder — revisa logs/frontend.log")
    return proc.pid


def iniciar_ngrok(env_vars: dict) -> tuple[str | None, int | None]:
    """Lanza ngrok_daemon.py como proceso independiente y devuelve (url, pid)."""
    authtoken = env_vars.get('NGROK_AUTHTOKEN', '').strip()
    if not authtoken:
        return None, None

    info("Iniciando túnel ngrok...")

    daemon_script = ROOT / 'scripts' / 'ngrok_daemon.py'
    try:
        proc = subprocess.Popen(
            [sys.executable, str(daemon_script)],
            env={**os.environ, **env_vars},
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            creationflags=_CREACION_FLAGS,
        )
    except Exception as exc:
        warn(f"No se pudo lanzar ngrok_daemon.py: {exc}")
        return None, None

    # Esperar a que el daemon imprima la URL (máx 30 s)
    url = None
    for _ in range(30):
        line = proc.stdout.readline()
        if line.startswith('TUNNEL_ACTIVO:'):
            url = line.split(':', 1)[1].strip()
            break
        if proc.poll() is not None:
            break
        time.sleep(1)

    if url:
        ok(f"Túnel ngrok activo → {url}")
        return url, proc.pid
    else:
        warn("ngrok tardó en responder — revisa logs/ngrok.log")
        return None, proc.pid if proc.poll() is None else None


def start_services():
    title("GESTOR JAL — Iniciando Servicios")

    # Cargar entorno
    env_vars = load_env()
    if not env_vars.get('DATABASE_URL'):
        error("backend/.env no encontrado o le falta DATABASE_URL")
        print("  Ejecuta primero: python gestor.py setup")
        sys.exit(1)

    # Verificar PostgreSQL
    info("Verificando PostgreSQL...")
    if not is_port_open('localhost', 5432):
        error("PostgreSQL no está corriendo en el puerto 5432")
        print()
        print("  Inicia el servicio de Windows:")
        print("  → Abre 'Servicios' (services.msc)")
        print("  → Busca 'postgresql-x64-16' y haz clic en Iniciar")
        print("  → O desde PowerShell (admin): net start postgresql-x64-16")
        sys.exit(1)
    ok("PostgreSQL conectado")

    # Crear directorio de logs
    LOGS_DIR.mkdir(exist_ok=True)

    # Migraciones
    ejecutar_migraciones(env_vars)

    # Iniciar servicios
    pids = load_pids()

    backend_pid = iniciar_backend(env_vars)
    if backend_pid:
        pids['backend'] = backend_pid

    frontend_pid = iniciar_frontend()
    if frontend_pid:
        pids['frontend'] = frontend_pid

    # Túnel ngrok (opcional) — se lanza como proceso independiente
    ngrok_url, ngrok_pid = iniciar_ngrok(env_vars)
    if ngrok_pid:
        pids['ngrok'] = ngrok_pid

    save_pids(pids)

    # Resumen final
    print()
    print(f"  {'='*50}")
    print("    Gestor JAL — Servicios Activos")
    print(f"  {'='*50}")
    print(f"  Frontend  → http://localhost:5173")
    print(f"  Backend   → http://localhost:3001")
    print(f"  API Docs  → http://localhost:3001/api-docs")
    if ngrok_url:
        print(f"  Remoto    → {ngrok_url}")
    print(f"  Logs      → {LOGS_DIR}")
    print(f"  {'='*50}")
    print("  Para detener: python gestor.py stop")
    print(f"  {'='*50}")
    print()
