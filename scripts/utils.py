"""Utilidades compartidas para los scripts de gestión de Gestor JAL."""

import os
import sys
import json
import socket
import subprocess
from pathlib import Path

from colorama import Fore, Style, init as colorama_init
from dotenv import dotenv_values

colorama_init(autoreset=True)

ROOT = Path(__file__).parent.parent
BACKEND_DIR = ROOT / 'backend'
FRONTEND_DIR = ROOT / 'frontend'
LOGS_DIR = ROOT / 'logs'
PIDS_FILE = ROOT / 'scripts' / '.pids.json'


# ── Salida formateada ────────────────────────────────────────────────────────

def ok(msg):
    print(f"{Fore.GREEN}[OK]{Style.RESET_ALL} {msg}")

def info(msg):
    print(f"{Fore.CYAN}[..]{Style.RESET_ALL} {msg}")

def warn(msg):
    print(f"{Fore.YELLOW}[!!]{Style.RESET_ALL} {msg}")

def error(msg):
    print(f"{Fore.RED}[ER]{Style.RESET_ALL} {msg}")

def title(msg):
    line = '=' * 52
    print(f"\n{Fore.BLUE}{Style.BRIGHT}{line}{Style.RESET_ALL}")
    print(f"{Fore.BLUE}{Style.BRIGHT}  {msg}{Style.RESET_ALL}")
    print(f"{Fore.BLUE}{Style.BRIGHT}{line}{Style.RESET_ALL}\n")


# ── Variables de entorno ─────────────────────────────────────────────────────

def load_env():
    """Carga variables desde backend/.env."""
    env_file = BACKEND_DIR / '.env'
    if not env_file.exists():
        return {}
    return dict(dotenv_values(env_file))


# ── Red ──────────────────────────────────────────────────────────────────────

def is_port_open(host: str, port: int, timeout: float = 1.5) -> bool:
    """Devuelve True si hay algo escuchando en host:port."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (OSError, ConnectionRefusedError):
        return False


# ── Procesos ─────────────────────────────────────────────────────────────────

def is_process_running(pid: int) -> bool:
    """Verifica si un proceso con el PID dado está activo en Windows."""
    try:
        result = subprocess.run(
            ['tasklist', '/FI', f'PID eq {pid}'],
            capture_output=True, text=True,
        )
        return str(pid) in result.stdout
    except Exception:
        return False


def kill_process(pid: int, name: str = 'proceso'):
    """Termina un proceso por PID en Windows."""
    if not pid:
        return
    try:
        subprocess.run(
            ['taskkill', '/F', '/PID', str(pid), '/T'],
            capture_output=True,
        )
        ok(f"{name} detenido (PID {pid})")
    except Exception as e:
        warn(f"No se pudo detener {name} (PID {pid}): {e}")


# ── Archivo de PIDs ──────────────────────────────────────────────────────────

def load_pids() -> dict:
    if PIDS_FILE.exists():
        try:
            return json.loads(PIDS_FILE.read_text())
        except Exception:
            return {}
    return {}


def save_pids(pids: dict):
    PIDS_FILE.write_text(json.dumps(pids, indent=2))


def clear_pids():
    if PIDS_FILE.exists():
        PIDS_FILE.unlink()
