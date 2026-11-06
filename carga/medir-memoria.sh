#!/usr/bin/env bash
# Mide cada segundo la memoria (RSS) del backend y de los procesos de LibreOffice mientras
# corre la prueba de carga, y al terminar imprime el pico. Solo para pruebas locales o en
# una máquina donde se pueda ver los procesos (en Render usar el panel Metrics).
#
# Uso: carga/medir-memoria.sh <pid_del_backend> <archivo_salida.csv> &
#      (detener con kill cuando termine k6)
set -uo pipefail  # sin -e: ps devuelve 1 cuando no hay procesos de LibreOffice
PID="${1:?pid del backend}"
OUT="${2:-memoria.csv}"
echo "segundo,backend_mb,soffice_mb,soffice_procesos,total_mb" > "$OUT"
t=0; pico=0
resumen() { echo "[memoria] pico total backend+LibreOffice: ${pico} MB (detalle en $OUT)"; exit 0; }
trap resumen TERM INT
while kill -0 "$PID" 2>/dev/null; do
  b=$(( $(ps -o rss= -p "$PID" 2>/dev/null || echo 0) / 1024 ))
  s=$(ps -C soffice.bin -o rss= 2>/dev/null | awk '{s+=$1} END {print int(s/1024)}')
  n=$( (ps -C soffice.bin -o pid= 2>/dev/null || true) | wc -l)
  tot=$(( b + ${s:-0} ))
  if (( tot > pico )); then pico=$tot; fi
  echo "$t,$b,${s:-0},$n,$tot" >> "$OUT"
  sleep 1; t=$((t+1))
done
resumen
