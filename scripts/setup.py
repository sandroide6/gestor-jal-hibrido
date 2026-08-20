"""Asistente de configuración inicial para Gestor JAL en Windows."""

import os
import sys
import secrets
import string
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.utils import ok, info, warn, error, title, is_port_open, ROOT, BACKEND_DIR, FRONTEND_DIR


def _generar_secreto(longitud: int = 48) -> str:
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(longitud))


def verificar_requisitos() -> bool:
    """Verifica que Node.js, npm y PostgreSQL estén disponibles."""
    title("Verificando Requisitos")
    todo_ok = True

    # Node.js
    try:
        r = subprocess.run('node --version', capture_output=True, text=True, shell=True)
        if r.returncode == 0:
            ok(f"Node.js {r.stdout.strip()}")
        else:
            raise RuntimeError
    except Exception:
        error("Node.js no encontrado")
        print("  → Descarga: https://nodejs.org/en/download/  (versión 20 LTS)")
        todo_ok = False

    # npm
    try:
        r = subprocess.run('npm --version', capture_output=True, text=True, shell=True)
        if r.returncode == 0:
            ok(f"npm {r.stdout.strip()}")
        else:
            raise RuntimeError
    except Exception:
        error("npm no encontrado (debería venir con Node.js)")
        todo_ok = False

    # PostgreSQL
    if is_port_open('localhost', 5432):
        ok("PostgreSQL corriendo en puerto 5432")
    else:
        warn("PostgreSQL no está corriendo en el puerto 5432")
        print("  → Instala: https://www.postgresql.org/download/windows/")
        print("  → Luego inicia el servicio en: Servicios de Windows")
        print("  → Puedes continuar la configuración ahora e iniciar PostgreSQL después")

    return todo_ok


def configurar_env():
    """Crea o actualiza backend/.env con los valores del usuario."""
    title("Configuración de Variables de Entorno")

    env_file = BACKEND_DIR / '.env'

    # Cargar valores existentes si ya hay un .env
    existente = {}
    if env_file.exists():
        from dotenv import dotenv_values
        existente = dict(dotenv_values(env_file))
        resp = input("  Ya existe backend/.env. ¿Reconfigurarlo? (s/N): ").strip().lower()
        if resp != 's':
            ok("Manteniendo backend/.env existente")
            return

    print()
    print("  Responde las preguntas (Enter = valor por defecto entre corchetes)")
    print()

    def preguntar(pregunta, defecto):
        valor = input(f"  {pregunta} [{defecto}]: ").strip()
        return valor if valor else defecto

    # Datos de la JAL
    jal_nombre = preguntar(
        "Nombre completo de la JAL",
        existente.get('JAL_NOMBRE', 'JAL Comuna 12 - La América - Medellín'),
    )
    jal_corto = preguntar(
        "Nombre corto (máx 12 chars, para ícono PWA)",
        existente.get('JAL_NOMBRE_CORTO', 'JAL C12'),
    )

    # Conexión PostgreSQL
    print()
    print("  ── Conexión a PostgreSQL ─────────────────────────")
    db_host = preguntar("Host", existente.get('DB_HOST', 'localhost'))
    db_port = preguntar("Puerto", existente.get('DB_PORT', '5432'))
    db_name = preguntar("Nombre de la base de datos", existente.get('DB_NAME', 'gestor_jal'))
    db_user = preguntar("Usuario de PostgreSQL", existente.get('DB_USER', 'postgres'))

    db_password_actual = existente.get('DB_PASSWORD', '')
    print(f"  Contraseña de PostgreSQL [{('(existente)' if db_password_actual else 'vacío → se generará')}]: ", end='')
    db_password = input().strip()
    if not db_password:
        db_password = db_password_actual or _generar_secreto(24)
        if not db_password_actual:
            info(f"Contraseña generada: {db_password}  ← GUARDA ESTO")

    # JWT
    jwt_secret = existente.get('JWT_SECRET', _generar_secreto(64))

    # ngrok
    print()
    print("  ── Acceso remoto con ngrok (opcional) ────────────")
    print("  Crea cuenta gratuita en https://ngrok.com y obtén tu authtoken")
    ngrok_token = preguntar(
        "Token de ngrok (dejar vacío para omitir)",
        existente.get('NGROK_AUTHTOKEN', ''),
    )
    ngrok_domain = preguntar(
        "Dominio fijo ngrok (solo plan pago, dejar vacío si no tienes)",
        existente.get('NGROK_DOMAIN', ''),
    )

    # Construir DATABASE_URL
    database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    contenido = f"""# Gestor JAL — Variables de Entorno
# Generado por: python gestor.py setup
# NUNCA subir este archivo a git

# ── Base de datos ─────────────────────────────────────────
DATABASE_URL={database_url}
DB_HOST={db_host}
DB_PORT={db_port}
DB_NAME={db_name}
DB_USER={db_user}
DB_PASSWORD={db_password}

# ── JWT ───────────────────────────────────────────────────
# Para generar uno nuevo: node -e "require('crypto').randomBytes(64).toString('hex')"
JWT_SECRET={jwt_secret}

# ── Servidor ──────────────────────────────────────────────
PORT=3001
NODE_ENV=production

# ── CORS ──────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# ── Almacenamiento ────────────────────────────────────────
STORAGE_PATH=./data/output
TEMPLATES_PATH=./plantillas
MAX_FILE_SIZE_MB=20

# ── Configuración JAL ─────────────────────────────────────
JAL_NOMBRE={jal_nombre}
JAL_NOMBRE_CORTO={jal_corto}

# ── ngrok (acceso remoto) ─────────────────────────────────
# Obtén tu token en: https://dashboard.ngrok.com/get-started/your-authtoken
NGROK_AUTHTOKEN={ngrok_token}
# Dominio fijo (solo plan pago de ngrok, dejar vacío si no tienes)
NGROK_DOMAIN={ngrok_domain}
"""

    env_file.write_text(contenido, encoding='utf-8')
    ok(f"Archivo backend/.env creado")
    print(f"  → Ruta: {env_file}")


def instalar_dependencias() -> bool:
    """Ejecuta npm install en backend y frontend."""
    title("Instalando Dependencias Node.js")

    info("Instalando dependencias del backend...")
    r = subprocess.run('npm install', cwd=str(BACKEND_DIR), shell=True)
    if r.returncode != 0:
        error("Error instalando dependencias del backend")
        return False
    ok("Backend: dependencias instaladas")

    info("Instalando dependencias del frontend...")
    r = subprocess.run('npm install', cwd=str(FRONTEND_DIR), shell=True)
    if r.returncode != 0:
        error("Error instalando dependencias del frontend")
        return False
    ok("Frontend: dependencias instaladas")

    return True


def configurar_base_de_datos() -> bool:
    """Ejecuta migraciones y seeders de Sequelize."""
    title("Configurando Base de Datos")

    if not is_port_open('localhost', 5432):
        warn("PostgreSQL no está corriendo — omitiendo configuración de BD")
        print("  Cuando PostgreSQL esté activo, ejecuta:")
        print("  → python gestor.py migrar")
        return False

    from dotenv import dotenv_values
    env_vars = dict(dotenv_values(BACKEND_DIR / '.env'))
    full_env = {**os.environ, **env_vars}

    info("Ejecutando migraciones Sequelize...")
    r = subprocess.run('npm run db:migrate', cwd=str(BACKEND_DIR), shell=True, env=full_env)
    if r.returncode != 0:
        error("Las migraciones fallaron")
        print("  Verifica que DATABASE_URL en backend/.env sea correcto")
        print("  y que el usuario de PostgreSQL tenga permisos para crear tablas")
        return False
    ok("Migraciones aplicadas")

    info("Cargando datos iniciales (seeders)...")
    r = subprocess.run('npm run db:seed', cwd=str(BACKEND_DIR), shell=True, env=full_env)
    if r.returncode != 0:
        warn("Seeders no aplicados (puede que ya estén cargados)")
    else:
        ok("Datos iniciales cargados")

    return True


def construir_frontend():
    """Genera el build de producción del frontend React."""
    title("Construyendo Frontend")

    info("Ejecutando npm run build...")
    r = subprocess.run('npm run build', cwd=str(FRONTEND_DIR), shell=True)
    if r.returncode == 0:
        ok("Frontend construido en frontend/dist/")
    else:
        warn("El build falló — puedes construir después con: npm run build --prefix frontend")


def run_setup():
    title("GESTOR JAL — Configuración Inicial Windows")

    print("  Este asistente configura Gestor JAL para correr nativamente en Windows.")
    print()
    print("  Requisitos previos:")
    print("  ✓ Python 3.10+      → https://www.python.org/downloads/")
    print("  ✓ Node.js 20 LTS    → https://nodejs.org/en/download/")
    print("  ✓ PostgreSQL 16     → https://www.postgresql.org/download/windows/")
    print("  ✓ ngrok (opcional)  → https://ngrok.com  (acceso remoto gratuito)")
    print()
    input("  Presiona Enter para comenzar...")

    verificar_requisitos()

    print()
    input("  Presiona Enter para configurar las variables de entorno...")

    configurar_env()
    instalar_dependencias()
    configurar_base_de_datos()
    construir_frontend()

    # Crear directorio de logs
    (ROOT / 'logs').mkdir(exist_ok=True)

    print()
    print(f"{'='*52}")
    print("  ¡Configuración completada!")
    print(f"{'='*52}")
    print()
    print("  Para iniciar el sistema:")
    print("  → python gestor.py start")
    print("  → O doble clic en:  iniciar.bat")
    print()
    print("  Comandos disponibles:")
    print("  → python gestor.py start    Iniciar todos los servicios")
    print("  → python gestor.py stop     Detener todos los servicios")
    print("  → python gestor.py status   Ver estado del sistema")
    print("  → python gestor.py tunnel   Iniciar túnel ngrok")
    print("  → python gestor.py backup   Crear copia de seguridad")
    print()
