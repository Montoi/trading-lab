import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://localhost:3002';
if (!process.env.APP_PASSWORD) throw Error('Carga APP_PASSWORD desde .env');
const id = 'smoke-' + crypto.randomUUID();
const headers = {
  Authorization:
    'Basic ' +
    Buffer.from(
      `${process.env.APP_USERNAME || 'carlos'}:${process.env.APP_PASSWORD}`,
    ).toString('base64'),
  'Content-Type': 'application/json',
};
assert.equal(
  (await fetch(base + '/api/records')).status,
  401,
  'La API debe requerir autenticación',
);
assert.equal(
  (await fetch(base + '/api/health')).status,
  200,
  'La app y la base deben estar disponibles',
);
const strategy = {
  id,
  name: 'Verificación temporal',
  timeframe: 'H1',
  direction: 'both',
  rules: [{ kind: 'ema', period: 20, slow: 50, level: 30 }],
  stop: 0.6,
  rr: 2,
  risk: 1,
  version: 1,
};
const save = () =>
  fetch(base + '/api/records', {
    method: 'POST',
    headers: { ...headers, Origin: base },
    body: JSON.stringify({ id, kind: 'strategy', data: strategy }),
  });
try {
  assert.equal((await save()).status, 200, 'Guardar estrategia');
  strategy.version = 2;
  strategy.name = 'Verificación actualizada';
  assert.equal((await save()).status, 200, 'Actualizar estrategia');
  const records = await (
    await fetch(base + '/api/records', { headers })
  ).json();
  assert.equal(
    records.find((x) => x.id === id)?.data.version,
    2,
    'Leer versión persistida',
  );
  const forbidden = await fetch(base + '/api/records', {
    method: 'POST',
    headers: { ...headers, Origin: 'https://unrelated.invalid' },
    body: '{}',
  });
  assert.equal(forbidden.status, 403, 'Bloquear escrituras desde otro origen');
  console.log(
    'OK: autenticación, salud, guardado, actualización y protección de origen.',
  );
} finally {
  const removed = await fetch(base + '/api/records?id=' + id, {
    method: 'DELETE',
    headers,
  });
  assert.equal(removed.status, 200, 'Eliminar solamente el registro de prueba');
}
