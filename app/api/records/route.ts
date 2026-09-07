import { db } from '@/lib/storage';
import { validateStrategy } from '@/lib/engine';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const result = await db().query<{
      id: string;
      kind: string;
      payload: string;
    }>('SELECT id, kind, payload FROM records ORDER BY updated DESC LIMIT 150');
    return Response.json(
      result.rows.map((x) => ({
        id: x.id,
        kind: x.kind,
        data: JSON.parse(x.payload),
      })),
    );
  } catch {
    return Response.json(
      { error: 'No se pudieron cargar los datos guardados.' },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > 2000000)
      return Response.json(
        { error: 'Resultado demasiado grande para guardar.' },
        { status: 413 },
      );
    const { id, kind, data } = JSON.parse(raw);
    if (
      typeof id !== 'string' ||
      id.length > 80 ||
      !['strategy', 'run'].includes(kind)
    )
      throw Error('Registro inválido');
    if (kind === 'strategy') {
      validateStrategy(data);
      if (data.id !== id) throw Error('Identificador inválido');
    } else if (
      !data ||
      !Array.isArray(data.results) ||
      data.results.length > 30
    )
      throw Error('Prueba inválida');
    await db().query(
      'INSERT INTO records (id,kind,payload,updated) VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated WHERE records.kind=excluded.kind',
      [id, kind, JSON.stringify(data), new Date().toISOString()],
    );
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'No se pudo guardar.' },
      { status: 400 },
    );
  }
}
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id)
    return Response.json({ error: 'Falta el identificador' }, { status: 400 });
  try {
    await db().query('DELETE FROM records WHERE id=$1', [id]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'No se pudo eliminar.' }, { status: 503 });
  }
}
