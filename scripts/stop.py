"""Detiene todos los servicios de Gestor JAL."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.utils import (
    ok, info, warn, title,
    load_pids, clear_pids, kill_process, is_process_running,
)


def stop_services():
    title("GESTOR JAL — Deteniendo Servicios")

    pids = load_pids()

    if not pids:
        info("No se encontraron servicios activos (archivo .pids.json ausente)")
        return

    # Detener ngrok primero
    if 'ngrok' in pids:
        try:
            from pyngrok import ngrok
            ngrok.kill()
            ok("Túnel ngrok cerrado")
        except Exception:
            kill_process(pids.get('ngrok'), 'ngrok')

    # Detener frontend
    if 'frontend' in pids:
        kill_process(pids['frontend'], 'Frontend (Vite)')

    # Detener backend
    if 'backend' in pids:
        kill_process(pids['backend'], 'Backend (Node.js)')

    clear_pids()
    info("Todos los servicios han sido detenidos")
    print()
    print("  Para iniciar de nuevo: python gestor.py start")
    print("  O doble clic en:       iniciar.bat")
    print()
