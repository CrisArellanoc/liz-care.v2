// Crea la cuenta de acceso (Supabase Auth) de un paciente ya registrado. Solo la administración puede llamarla.
// La llave service_role vive únicamente aquí, en el servidor; el navegador nunca la ve.
//   modo "invitar":  se envía un correo con enlace para que el paciente cree su contraseña.
//   modo "temporal": se crea la cuenta con una contraseña temporal que se muestra una sola vez a la administradora.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Sin caracteres ambiguos (0/O, 1/l/I) para dictarla sin errores.
function contrasenaTemporal(): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('') + '#7'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder({ ok: false, error: 'metodo' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return responder({ ok: false, error: 'sin-sesion' }, 401)

  // 1) ¿Quién llama? Se valida con su propio token y la regla es_admin() de la base.
  const llamador = createClient(url, anon, { global: { headers: { Authorization: auth } } })
  const { data: u, error: eu } = await llamador.auth.getUser()
  if (eu || !u.user) return responder({ ok: false, error: 'sin-sesion' }, 401)
  const { data: esAdmin } = await llamador.rpc('es_admin')
  if (esAdmin !== true) return responder({ ok: false, error: 'solo-administracion' }, 403)

  let entrada: { pacienteId?: string; modo?: string; redirectTo?: string }
  try { entrada = await req.json() } catch { return responder({ ok: false, error: 'solicitud-invalida' }, 400) }
  const { pacienteId, modo, redirectTo } = entrada
  if (!pacienteId || (modo !== 'invitar' && modo !== 'temporal')) return responder({ ok: false, error: 'solicitud-invalida' }, 400)

  const admin = createClient(url, servicio, { auth: { persistSession: false, autoRefreshToken: false } })

  // 2) El paciente debe existir y no tener cuenta todavía.
  const { data: p, error: ep } = await admin.from('paciente')
    .select('id, nombres, primer_apellido, segundo_apellido, correo, usuario_id').eq('id', pacienteId).maybeSingle()
  if (ep || !p) return responder({ ok: false, error: 'paciente-no-existe' }, 404)
  if (p.usuario_id) return responder({ ok: false, error: 'ya-tiene-cuenta' }, 409)

  const nombre = [p.nombres, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ')
  const correo = String(p.correo).trim().toLowerCase()

  // 3) Crear la cuenta de Auth.
  let usuarioId: string
  let password: string | undefined
  if (modo === 'invitar') {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(correo, { redirectTo, data: { nombre } })
    if (error || !data.user) return responder({ ok: false, error: /already|registered|exists/i.test(error?.message ?? '') ? 'correo-en-uso' : 'no-se-pudo-invitar', detalle: error?.message }, error?.status === 429 ? 429 : 409)
    usuarioId = data.user.id
  } else {
    password = contrasenaTemporal()
    const { data, error } = await admin.auth.admin.createUser({ email: correo, password, email_confirm: true, user_metadata: { nombre } })
    if (error || !data.user) return responder({ ok: false, error: /already|registered|exists/i.test(error?.message ?? '') ? 'correo-en-uso' : 'no-se-pudo-crear', detalle: error?.message }, 409)
    usuarioId = data.user.id
  }

  // 4) Perfil y vínculo con el expediente; si algo falla se deshace la cuenta para no dejar huérfanos.
  const deshacer = async () => { await admin.auth.admin.deleteUser(usuarioId) }
  const { error: e1 } = await admin.from('perfil').insert({ usuario_id: usuarioId, nombre, rol: 'paciente' })
  if (e1) { await deshacer(); return responder({ ok: false, error: 'no-se-pudo-crear-perfil' }, 500) }
  const { error: e2 } = await admin.from('paciente')
    .update({ usuario_id: usuarioId, portal: modo === 'temporal' ? 'activo' : 'invitado' }).eq('id', pacienteId).is('usuario_id', null)
  if (e2) { await admin.from('perfil').delete().eq('usuario_id', usuarioId); await deshacer(); return responder({ ok: false, error: 'no-se-pudo-vincular' }, 500) }

  return responder({ ok: true, modo, correo, ...(password ? { passwordTemporal: password } : {}) })
})
