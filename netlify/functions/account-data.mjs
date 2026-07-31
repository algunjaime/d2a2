import { getConnectionString } from '@netlify/database';
import { getUser } from '@netlify/identity';
import postgres from 'postgres';

let database;
const getDatabase = () => database ||= postgres(getConnectionString(), { max: 1, idle_timeout: 20 });

export default async function handler(request) {
  const user = await getUser();
  if (!user?.id) return Response.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (request.method !== 'DELETE') return Response.json({ error: 'Método no permitido.' }, { status: 405 });
  const body = await request.json().catch(() => ({}));
  if (body.confirmation !== 'ELIMINAR') return Response.json({ error: 'Confirmación inválida.' }, { status: 400 });
  const sql = getDatabase();
  await sql`DELETE FROM d2a2_sessions WHERE owner_id = ${user.id}`;
  return Response.json({ deleted: true });
}
