"""Crea una copia de seguridad de la base de datos y los documentos generados."""

import os
import sys
import shutil
import subprocess
import urllib.parse
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.utils import ok, info, warn, error, title, load_env, ROOT, BACKEND_DIR

BACKUP_DIR = ROOT / 'backups'


def run_backup():
    title("GESTOR JAL — Creando Backup")

    env_vars = load_env()
    db_url = env_vars.get('DATABASE_URL', '')
    if not db_url:
        error("DATABASE_URL no configurado en backend/.env")
        return

    BACKUP_DIR.mkdir(exist_ok=True)
    marca = datetime.now().strftime('%Y%m%d_%H%M%S')
    carpeta_tmp = BACKUP_DIR / f"tmp_{marca}"
    carpeta_tmp.mkdir()

    # ── Base de datos ────────────────────────────────────────────
    info("Haciendo dump de PostgreSQL...")
    parsed = urllib.parse.urlparse(db_url)
    dump_file = carpeta_tmp / 'database.sql'

    pg_env = {**os.environ, 'PGPASSWORD': parsed.password or ''}
    r = subprocess.run(
        [
            'pg_dump',
            '-h', parsed.hostname or 'localhost',
            '-p', str(parsed.port or 5432),
            '-U', parsed.username or 'postgres',
            '-d', parsed.path.lstrip('/'),
            '-f', str(dump_file),
            '--no-password',
        ],
        env=pg_env,
        capture_output=True,
        text=True,
    )
    if r.returncode == 0:
        ok(f"Base de datos exportada ({dump_file.stat().st_size // 1024} KB)")
    else:
        error(f"pg_dump falló: {r.stderr.strip()}")
        warn("Asegúrate de que pg_dump esté en el PATH (viene con la instalación de PostgreSQL)")
        warn("Verifica que: C:\\Program Files\\PostgreSQL\\16\\bin  esté en tu variable PATH")

    # ── Documentos generados ─────────────────────────────────────
    storage = Path(env_vars.get('STORAGE_PATH', str(BACKEND_DIR / 'data' / 'output')))
    if storage.exists() and any(storage.iterdir()):
        info("Copiando documentos generados...")
        shutil.copytree(str(storage), str(carpeta_tmp / 'documentos'), dirs_exist_ok=True)
        ok("Documentos copiados")
    else:
        info("No hay documentos generados para respaldar")

    # ── Comprimir ────────────────────────────────────────────────
    info("Comprimiendo backup...")
    zip_base = BACKUP_DIR / f"backup_{marca}"
    shutil.make_archive(str(zip_base), 'zip', str(carpeta_tmp))
    shutil.rmtree(carpeta_tmp)

    zip_file = zip_base.with_suffix('.zip')
    tamanio_mb = zip_file.stat().st_size / 1024 / 1024
    ok(f"Backup creado: {zip_file.name}  ({tamanio_mb:.1f} MB)")
    print()
    print(f"  Ruta completa: {zip_file}")
    print()
    print("  Para restaurar: python gestor.py restore <ruta_del_backup.zip>")
    print()
