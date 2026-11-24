// Cambia el correo de un paciente. Si ya tiene cuenta de acceso, cambia también el correo con el que inicia sesión,
// para que el expediente y el inicio de sesión siempre cuadren. Solo la administración puede llamarla.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder({ ok: false, error: 'metodo' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return responder({ ok: false, error: 'sin-sesion' }, 401)

  const llamador = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: u, error: eu } = await llamador.auth.getUser()
  if (eu || !u.user) return responder({ ok: false, error: 'sin-sesion' }, 401)
  const { data: esAdmin } = await llamador.rpc('es_admin')
  if (esAdmin !== true) return responder({ ok: false, error: 'solo-administracion' }, 403)

  let entrada: { pacienteId?: string; correo?: string }
  try { entrada = await req.json() } catch { return responder({ ok: false, error: 'solicitud-invalida' }, 400) }
  const correo = String(entrada.correo ?? '').replace(/\s/g, '').toLowerCase()
  if (!entrada.pacienteId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return responder({ ok: false, error: 'solicitud-invalida' }, 400)

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: p } = await admin.from('paciente').select('id, correo, usuario_id').eq('id', entrada.pacienteId).maybeSingle()
  if (!p) return responder({ ok: false, error: 'paciente-no-existe' }, 404)
  if (String(p.correo).toLowerCase() === correo) return responder({ ok: true, sinCambios: true })

  // Otro paciente con ese correo (el índice único también lo impediría, pero así el mensaje es claro).
  const { data: otro } = await admin.from('paciente').select('id').ilike('correo', correo).neq('id', p.id).maybeSingle()
  if (otro) return responder({ ok: false, error: 'correo-duplicado' }, 409)

  // Primero Auth (puede fallar por correo en uso); después el expediente. Si el expediente falla, se revierte Auth.
  if (p.usuario_id) {
    const { error } = await admin.auth.admin.updateUserById(p.usuario_id, { email: correo, email_confirm: true })
    if (error) return responder({ ok: false, error: /already|registered|exists/i.test(error.message) ? 'correo-en-uso' : 'no-se-pudo-cambiar' }, 409)
  }
  const { error: e2 } = await admin.from('paciente').update({ correo }).eq('id', p.id)
  if (e2) {
    if (p.usuario_id) await admin.auth.admin.updateUserById(p.usuario_id, { email: String(p.correo).toLowerCase(), email_confirm: true })
    return responder({ ok: false, error: e2.code === '23505' ? 'correo-duplicado' : 'no-se-pudo-cambiar' }, e2.code === '23505' ? 409 : 500)
  }
  return responder({ ok: true, cuentaActualizada: Boolean(p.usuario_id) })
})
