"""Inicia un túnel ngrok para acceso remoto al sistema."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.utils import ok, info, warn, error, title, load_env, BACKEND_DIR


def start_tunnel():
    title("GESTOR JAL — Túnel ngrok")

    env_vars = load_env()
    authtoken = env_vars.get('NGROK_AUTHTOKEN', os.getenv('NGROK_AUTHTOKEN', '')).strip()

    if not authtoken:
        error("NGROK_AUTHTOKEN no está configurado en backend/.env")
        print()
        print("  Pasos para obtener tu token gratuito:")
        print("  1. Crea cuenta en:   https://ngrok.com")
        print("  2. Ve a:             https://dashboard.ngrok.com/get-started/your-authtoken")
        print("  3. Copia el token")
        print("  4. Agrega en backend/.env:  NGROK_AUTHTOKEN=tu_token_aqui")
        print("  5. Vuelve a ejecutar: python gestor.py tunnel")
        return

    try:
        from pyngrok import ngrok
    except ImportError:
        error("pyngrok no está instalado")
        print("  Ejecuta: pip install pyngrok")
        return

    puerto = int(env_vars.get('PORT', '3001'))
    dominio = env_vars.get('NGROK_DOMAIN', '').strip()

    ngrok.set_auth_token(authtoken)
    info(f"Conectando túnel al puerto {puerto}...")

    try:
        opciones = {'hostname': dominio} if dominio else {}
        tunel = ngrok.connect(puerto, 'http', **opciones)
        url = tunel.public_url

        ok(f"Túnel activo: {url}")
        print()
        print(f"  Acceso remoto al sistema: {url}")
        print()
        print("  El frontend en http://localhost:5173 sigue disponible localmente.")
        print("  El túnel apunta al backend (API) en el puerto 3001.")
        print()
        print("  Presiona Ctrl+C para cerrar el túnel")
        print()

        ngrok.get_ngrok_process().proc.wait()

    except KeyboardInterrupt:
        info("Cerrando túnel...")
        ngrok.kill()
        ok("Túnel cerrado")
    except Exception as exc:
        error(f"Error en ngrok: {exc}")
        print("  Verifica que el token sea válido y que tengas conexión a internet")
