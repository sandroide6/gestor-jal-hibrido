from pyngrok import ngrok
import time, os

authtoken = os.environ.get('NGROK_AUTHTOKEN', '').strip()
domain    = os.environ.get('NGROK_DOMAIN', '').strip()

if not authtoken:
    print('ERROR: NGROK_AUTHTOKEN no está definido en las variables de entorno.', flush=True)
    print('Configura NGROK_AUTHTOKEN en backend/.env o deploy/.env antes de usar el túnel.', flush=True)
    raise SystemExit(1)
port      = int(os.environ.get('BACKEND_PORT') or 3001)

ngrok.set_auth_token(authtoken)

connect_opts = {'hostname': domain} if domain else {}

tunnel = ngrok.connect(port, 'http', **connect_opts)
url = tunnel.public_url

os.makedirs('logs', exist_ok=True)
with open('logs/ngrok_url.txt', 'w') as f:
    f.write(url)

print(f'TUNNEL_ACTIVO: {url}', flush=True)

try:
    while True:
        time.sleep(10)
except KeyboardInterrupt:
    ngrok.kill()
