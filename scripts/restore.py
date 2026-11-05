"""Restaura una copia de seguridad de Gestor JAL."""

import os
import sys
import shutil
import subprocess
import tempfile
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.utils import ok, info, warn, error, title, load_env, BACKEND_DIR


def run_restore(archivo: str | None = None):
    title("GESTOR JAL — Restaurando Backup")

    if not archivo:
        error("Debes especificar el archivo de backup")
        print("  Uso: python gestor.py restore backups/backup_20260521_120000.zip")
        return

    ruta = Path(archivo)
    if not ruta.exists():
        error(f"Archivo no encontrado: {ruta}")
        return

    env_vars = load_env()
    db_url = env_vars.get('DATABASE_URL', '')
    if not db_url:
        error("DATABASE_URL no configurado en backend/.env")
        return

    print(f"  Archivo: {ruta.name}")
    print()
    respuesta = input(
        "  ADVERTENCIA: Esto sobreescribirá la base de datos actual.\n"
        "  ¿Estás seguro? (escribe 'si' para confirmar): "
    ).strip().lower()
    if respuesta != 'si':
        info("Restauración cancelada")
        return

    with tempfile.TemporaryDirectory() as tmp:
        info("Extrayendo backup...")
        shutil.unpack_archive(str(ruta), tmp)

        # ── Base de datos ────────────────────────────────────────
        dump = Path(tmp) / 'database.sql'
        if dump.exists():
            info("Restaurando base de datos...")
            parsed = urllib.parse.urlparse(db_url)
            pg_env = {**os.environ, 'PGPASSWORD': parsed.password or ''}
            r = subprocess.run(
                [
                    'psql',
                    '-h', parsed.hostname or 'localhost',
                    '-p', str(parsed.port or 5432),
                    '-U', parsed.username or 'postgres',
                    '-d', parsed.path.lstrip('/'),
                    '-f', str(dump),
                    '--no-password',
                    # Todo o nada: ante el primer error se deshace la restauración completa.
                    # Antes psql seguía tras cada error y terminaba con código 0, así que el
                    # script decía "restaurada" aunque las tablas existentes no se tocaran.
                    '-v', 'ON_ERROR_STOP=1', '--single-transaction', '--quiet',
                ],
                env=pg_env,
            )
            if r.returncode == 0:
                ok("Base de datos restaurada")
            else:
                error("Error restaurando la base de datos: no se aplicó ningún cambio")
                warn("Si el backup es anterior a esta versión (sin --clean), restáuralo en una base vacía:")
                warn("crea una base nueva, apunta DATABASE_URL a ella y repite la restauración")
                return
        else:
            warn("No se encontró database.sql en el backup")

        # ── Documentos ────────────────────────────────────────────
        docs_src = Path(tmp) / 'documentos'
        if docs_src.exists():
            storage = Path(env_vars.get('STORAGE_PATH', str(BACKEND_DIR / 'data' / 'output')))
            storage.mkdir(parents=True, exist_ok=True)
            info("Restaurando documentos generados...")
            shutil.copytree(str(docs_src), str(storage), dirs_exist_ok=True)
            ok("Documentos restaurados")

    ok("Restauración completada")
    print()
    print("  Reinicia los servicios: python gestor.py stop && python gestor.py start")
    print()
