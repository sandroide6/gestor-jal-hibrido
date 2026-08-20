"""Muestra el estado actual de todos los servicios de Gestor JAL."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.utils import (
    ok, info, warn, error, title,
    is_port_open, load_pids, is_process_running,
    ROOT, LOGS_DIR,
)


def check_status():
    title("GESTOR JAL — Estado de Servicios")

    pids = load_pids()

    # ── PostgreSQL ──────────────────────────────────────────────
    if is_port_open('localhost', 5432):
        ok("PostgreSQL      → puerto 5432 activo")
    else:
        error("PostgreSQL      → no disponible (puerto 5432 cerrado)")

    # ── Backend ─────────────────────────────────────────────────
    if is_port_open('localhost', 3001):
        try:
            import requests
            r = requests.get('http://localhost:3001/health', timeout=3)
            estado = "SALUDABLE" if r.status_code == 200 else f"HTTP {r.status_code}"
            ok(f"Backend (API)   → http://localhost:3001  [{estado}]")
        except Exception:
            ok("Backend (API)   → http://localhost:3001  [puerto abierto]")
    else:
        error("Backend (API)   → no disponible (puerto 3001 cerrado)")

    # ── Frontend ─────────────────────────────────────────────────
    if is_port_open('localhost', 5173):
        ok("Frontend (Vite) → http://localhost:5173")
    elif is_port_open('localhost', 3000):
        ok("Frontend        → http://localhost:3000")
    else:
        error("Frontend        → no disponible")

    # ── Túnel ngrok ──────────────────────────────────────────────
    ngrok_pid = pids.get('ngrok')
    if ngrok_pid and is_process_running(ngrok_pid):
        ok(f"Túnel ngrok     → activo  (PID {ngrok_pid})")
    else:
        info("Túnel ngrok     → no activo")

    # ── PIDs de los procesos ─────────────────────────────────────
    if pids:
        print()
        print("  Procesos registrados:")
        for nombre, pid in pids.items():
            estado = "corriendo" if is_process_running(pid) else "detenido"
            simbolo = "✓" if estado == "corriendo" else "✗"
            print(f"    {simbolo} {nombre:<12} PID {pid}  [{estado}]")

    print()
    print(f"  Logs: {LOGS_DIR}")
    print("  Detener:  python gestor.py stop")
    print("  Iniciar:  python gestor.py start")
    print()
