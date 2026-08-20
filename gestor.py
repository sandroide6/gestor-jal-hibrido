#!/usr/bin/env python3
"""
Gestor JAL — Punto de entrada principal para Windows.

Uso:
  python gestor.py setup     Configuración inicial (primera vez)
  python gestor.py start     Iniciar todos los servicios
  python gestor.py stop      Detener todos los servicios
  python gestor.py status    Ver estado del sistema
  python gestor.py tunnel    Iniciar túnel ngrok
  python gestor.py backup    Crear copia de seguridad
  python gestor.py restore <archivo.zip>  Restaurar backup
  python gestor.py migrar    Ejecutar migraciones de base de datos
  python gestor.py logs      Ver últimas líneas de los logs
"""

import sys
import argparse
from pathlib import Path

# Forzar UTF-8 en la salida para que los caracteres especiales se muestren bien en Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


def main():
    parser = argparse.ArgumentParser(
        prog='python gestor.py',
        description='Gestor JAL — Sistema de gestión documental para JAL de Medellín',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    sub = parser.add_subparsers(dest='comando', metavar='COMANDO')

    sub.add_parser('setup',   help='Configuración inicial (primera vez)')
    sub.add_parser('start',   help='Iniciar todos los servicios')
    sub.add_parser('stop',    help='Detener todos los servicios')
    sub.add_parser('status',  help='Ver estado del sistema')
    sub.add_parser('tunnel',  help='Iniciar túnel ngrok para acceso remoto')
    sub.add_parser('backup',  help='Crear copia de seguridad')
    sub.add_parser('migrar',  help='Ejecutar migraciones de base de datos')

    restore_p = sub.add_parser('restore', help='Restaurar desde copia de seguridad')
    restore_p.add_argument('archivo', nargs='?', help='Ruta al archivo .zip del backup')

    logs_p = sub.add_parser('logs', help='Ver últimas líneas de un log')
    logs_p.add_argument('servicio', nargs='?', default='backend',
                        choices=['backend', 'frontend'],
                        help='Servicio a consultar (default: backend)')
    logs_p.add_argument('-n', '--lineas', type=int, default=50,
                        metavar='N', help='Número de líneas a mostrar (default: 50)')

    args = parser.parse_args()

    if args.comando == 'setup':
        from scripts.setup import run_setup
        run_setup()

    elif args.comando == 'start':
        from scripts.start import start_services
        start_services()

    elif args.comando == 'stop':
        from scripts.stop import stop_services
        stop_services()

    elif args.comando == 'status':
        from scripts.status import check_status
        check_status()

    elif args.comando == 'tunnel':
        from scripts.tunnel import start_tunnel
        start_tunnel()

    elif args.comando == 'backup':
        from scripts.backup import run_backup
        run_backup()

    elif args.comando == 'restore':
        from scripts.restore import run_restore
        run_restore(getattr(args, 'archivo', None))

    elif args.comando == 'migrar':
        from scripts.start import ejecutar_migraciones
        from scripts.utils import load_env, is_port_open, error
        env_vars = load_env()
        if not is_port_open('localhost', 5432):
            error("PostgreSQL no está corriendo en el puerto 5432")
            sys.exit(1)
        ejecutar_migraciones(env_vars)

    elif args.comando == 'logs':
        _mostrar_logs(args.servicio, args.lineas)

    else:
        parser.print_help()
        print()
        print("  Ejemplos:")
        print("  python gestor.py setup        ← Primera vez")
        print("  python gestor.py start        ← Iniciar sistema")
        print("  python gestor.py status       ← Ver estado")
        print("  python gestor.py tunnel       ← Acceso remoto")
        print()


def _mostrar_logs(servicio: str, n: int):
    logs_dir = Path(__file__).parent / 'logs'
    log_file = logs_dir / f'{servicio}.log'
    if not log_file.exists():
        print(f"  No hay logs todavía para '{servicio}'")
        print(f"  Ruta esperada: {log_file}")
        return
    lineas = log_file.read_text(encoding='utf-8', errors='replace').splitlines()
    print(f"\n  ── Últimas {n} líneas de logs/{servicio}.log ──\n")
    for l in lineas[-n:]:
        print(f"  {l}")
    print()


if __name__ == '__main__':
    main()
