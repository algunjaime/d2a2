import { getConnectionString } from '@netlify/database';
import { getUser } from '@netlify/identity';
import postgres from 'postgres';

const MAX_BODY_BYTES = 900_000;
let database;

function sqlClient() {
  if (!database) database = postgres(getConnectionString(), { max: 1, idle_timeout: 20 });
  return database;
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function readBody(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) throw Object.assign(new Error('La sesión supera el tamaño permitido.'), { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw Object.assign(new Error('La sesión supera el tamaño permitido.'), { status: 413 });
  try { return JSON.parse(text || '{}'); }
  catch { throw Object.assign(new Error('El contenido enviado no es válido.'), { status: 400 }); }
}

function validateSession(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('La sesión no es válida.'), { status: 400 });
  if (typeof value.id !== 'string' || value.id.length < 6 || value.id.length > 140) throw Object.assign(new Error('El identificador de la sesión no es válido.'), { status: 400 });
  if (value.meta != null && (typeof value.meta !== 'object' || Array.isArray(value.meta))) throw Object.assign(new Error('Los datos generales no son válidos.'), { status: 400 });
  return value;
}

export default async function handler(request) {
  try {
    const user = await getUser();
    if (!user?.id) return json({ error: 'Debes iniciar sesión.' }, 401);
    const sql = sqlClient();

    if (request.method === 'GET') {
      const rows = await sql`
        SELECT payload, version
        FROM d2a2_sessions
        WHERE owner_id = ${user.id} AND deleted_at IS NULL
        ORDER BY updated_at DESC
        LIMIT 500
      `;
      return json({
        sessions: rows.map(row => ({ ...row.payload, syncVersion: Number(row.version) || 0 })),
      });
    }

    if (request.method === 'POST') {
      const body = await readBody(request);
      const session = validateSession(body.session);
      const expectedVersion = Math.max(0, Number(body.expectedVersion) || 0);
      const payload = JSON.parse(JSON.stringify(session));
      delete payload.syncVersion;
      const status = session.status === 'finished' ? 'finished' : 'draft';
      const duplaName = String(session.meta?.name || '').slice(0, 240);
      const sessionDate = /^\d{4}-\d{2}-\d{2}$/.test(String(session.meta?.date || '')) ? session.meta.date : null;
      let rows;

      if (expectedVersion === 0) {
        rows = await sql`
          INSERT INTO d2a2_sessions (owner_id, session_id, status, dupla_name, session_date, payload, version, updated_at)
          VALUES (${user.id}, ${session.id}, ${status}, ${duplaName}, ${sessionDate}, ${sql.json(payload)}, 1, NOW())
          ON CONFLICT (owner_id, session_id) DO NOTHING
          RETURNING version
        `;
      } else {
        rows = await sql`
          UPDATE d2a2_sessions
          SET status = ${status}, dupla_name = ${duplaName}, session_date = ${sessionDate},
              payload = ${sql.json(payload)}, version = version + 1, updated_at = NOW()
          WHERE owner_id = ${user.id} AND session_id = ${session.id}
            AND version = ${expectedVersion} AND deleted_at IS NULL
          RETURNING version
        `;
      }

      if (!rows.length) {
        const current = await sql`
          SELECT payload, version FROM d2a2_sessions
          WHERE owner_id = ${user.id} AND session_id = ${session.id} AND deleted_at IS NULL
          LIMIT 1
        `;
        return json({
          error: 'La sesión cambió en otro dispositivo.',
          session: current[0] ? { ...current[0].payload, syncVersion: Number(current[0].version) } : null,
        }, 409);
      }

      return json({ id: session.id, version: Number(rows[0].version) });
    }

    if (request.method === 'DELETE') {
      const body = await readBody(request);
      const id = String(body.id || '');
      if (!id || id.length > 140) return json({ error: 'Identificador no válido.' }, 400);
      await sql`DELETE FROM d2a2_sessions WHERE owner_id = ${user.id} AND session_id = ${id}`;
      return json({ deleted: true });
    }

    return json({ error: 'Método no permitido.' }, 405);
  } catch (error) {
    console.error('D2A2 sessions error', error?.message || error);
    return json({ error: error?.message || 'No fue posible procesar la solicitud.' }, Number(error?.status) || 500);
  }
}
