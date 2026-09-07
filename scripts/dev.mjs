import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { Client } from 'pg';

const localPort = Number(process.env.DB_TUNNEL_PORT || 15432);
const appPort = Number(process.env.DEV_PORT || 3000);
const target = process.env.DB_SSH_TARGET || 'root@62.171.152.158';
const remotePort = Number(process.env.DB_REMOTE_PORT || 15432);
if (
  ![localPort, appPort, remotePort].every(
    (p) => Number.isInteger(p) && p > 1024 && p < 65536,
  )
)
  throw Error('Los puertos deben ser números entre 1025 y 65535.');
if (!process.env.POSTGRES_PASSWORD)
  throw Error(
    'Faltan las credenciales de Contabo en .env. No generes una base local.',
  );

async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const socket = createServer();
    socket.once('error', () =>
      reject(
        Error(
          `El puerto local ${port} está ocupado. Cierra la otra sesión o cambia DB_TUNNEL_PORT / DEV_PORT.`,
        ),
      ),
    );
    socket.listen(port, '127.0.0.1', () => socket.close(resolve));
  });
}
await requireFreePort(localPort);
await requireFreePort(appPort);
console.log(
  'Aurum local usa la base compartida de Contabo. Sus cambios también se verán en producción.',
);
console.log(
  'Abriendo conexión SSH. Si se solicita, introduce la contraseña SSH en esta terminal.',
);
const ssh = spawn(
  'ssh',
  [
    '-N',
    '-T',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ServerAliveInterval=15',
    '-o',
    'ServerAliveCountMax=3',
    '-o',
    'ConnectTimeout=15',
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-L',
    `127.0.0.1:${localPort}:127.0.0.1:${remotePort}`,
    target,
  ],
  { stdio: 'inherit' },
);
let app;
let ended = false;
function stop(code = 0) {
  if (ended) return;
  ended = true;
  app?.kill();
  ssh.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
ssh.on('error', () => {
  console.error('No se pudo iniciar SSH. Verifica que OpenSSH esté instalado.');
  stop(1);
});
ssh.on('exit', (code) => {
  if (!ended) {
    console.error(
      `Se cerró el túnel SSH (${code ?? 'interrumpido'}). Vuelve a ejecutar npm run dev.`,
    );
    stop(1);
  }
});
const connection = {
  host: '127.0.0.1',
  port: localPort,
  database: 'aurum',
  user: 'aurum',
  password: process.env.POSTGRES_PASSWORD,
  connectionTimeoutMillis: 1500,
};
let ready = false;
for (let i = 0; i < 120 && !ended; i++) {
  const client = new Client(connection);
  try {
    await client.connect();
    await client.query('SELECT id FROM records LIMIT 1');
    ready = true;
  } catch {
    /* SSH may still be waiting for authentication. */
  } finally {
    await client.end().catch(() => {});
  }
  if (ready) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!ready && !ended) {
  console.error(
    'No se pudo verificar PostgreSQL a través del túnel. Revisa SSH y la contraseña de la base.',
  );
  stop(1);
}
if (ready && !ended) {
  console.log(
    `Base compartida conectada. Abriendo http://127.0.0.1:${appPort}`,
  );
  const env = {
    ...process.env,
    PGHOST: connection.host,
    PGPORT: String(localPort),
    PGDATABASE: connection.database,
    PGUSER: connection.user,
    PGPASSWORD: connection.password,
  };
  // A stale DATABASE_URL must not override the verified SSH connection.
  delete env.DATABASE_URL;
  app = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(appPort),
    ],
    { env, stdio: 'inherit' },
  );
  app.on('error', () => {
    console.error('No se pudo iniciar Next.js. Ejecuta npm ci.');
    stop(1);
  });
  app.on('exit', (code) => stop(code ?? 0));
}
