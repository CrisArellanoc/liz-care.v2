// Prueba de la función crear-cuenta-paciente: solo administración, contraseña temporal, invitación, duplicados.
// Uso: SUPA_URL=... SUPA_ANON=... SUPA_SERVICE=... node tools/prueba-cuentas.mjs   (Supabase local con la función servida)
import { createClient } from '@supabase/supabase-js'
const { SUPA_URL, SUPA_ANON, SUPA_SERVICE } = process.env
const nuevo = (k) => createClient(SUPA_URL, k, { auth: { persistSession: false, autoRefreshToken: false } })
const servicio = nuevo(SUPA_SERVICE)
const PASS = 'Prueba-Liz-2026!'; const marca = Date.now(); let fallos = 0
const ok = (c, n, d = '') => { console.log(`${c ? '✓' : '✗'} ${n}${!c && d ? ` — ${d}` : ''}`); if (!c) fallos++ }
const llamar = async (cli, body) => {
  const { data: { session } } = await cli.auth.getSession()
  const r = await fetch(`${SUPA_URL}/functions/v1/crear-cuenta-paciente`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify(body) })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}
const fila = (n, correo) => ({ nombres: n, primer_apellido: 'Prueba', nacimiento: '1980-01-01', sexo: 'F', nacionalidad: 'X', pais: 'MX', idioma: 'Español', telefono: '1', correo, emergencia_nombre: 'X', emergencia_parentesco: 'Y', emergencia_telefono: '1', padecimiento_principal: 'P' })
const ids = { u: [], p: [] }
try {
  const ad = await servicio.auth.admin.createUser({ email: `ad${marca}@prueba.liz`, password: PASS, email_confirm: true }); ids.u.push(ad.data.user.id)
  await servicio.from('perfil').insert({ usuario_id: ad.data.user.id, nombre: 'Admin', rol: 'administrador' }).throwOnError()
  const admin = nuevo(SUPA_ANON); await admin.auth.signInWithPassword({ email: `ad${marca}@prueba.liz`, password: PASS })
  const p1 = (await servicio.from('paciente').insert(fila('Uno', `uno${marca}@prueba.liz`)).select().single().throwOnError()).data
  const p2 = (await servicio.from('paciente').insert(fila('Dos', `dos${marca}@prueba.liz`)).select().single().throwOnError()).data
  ids.p.push(p1.id, p2.id)

  ok((await llamar(nuevo(SUPA_ANON), { pacienteId: p1.id, modo: 'temporal' })).status === 401, 'sin sesión: 401')
  // un paciente con sesión no puede crear cuentas
  const pu = await servicio.auth.admin.createUser({ email: `pac${marca}@prueba.liz`, password: PASS, email_confirm: true }); ids.u.push(pu.data.user.id)
  await servicio.from('perfil').insert({ usuario_id: pu.data.user.id, nombre: 'Pac', rol: 'paciente' }).throwOnError()
  const pac = nuevo(SUPA_ANON); await pac.auth.signInWithPassword({ email: `pac${marca}@prueba.liz`, password: PASS })
  ok((await llamar(pac, { pacienteId: p1.id, modo: 'temporal' })).status === 403, 'paciente: 403 (solo administración)')

  const t = await llamar(admin, { pacienteId: p1.id, modo: 'temporal' })
  ok(t.status === 200 && t.json.ok && t.json.passwordTemporal?.length >= 12, 'admin: crea cuenta con contraseña temporal', JSON.stringify(t))
  if (t.json.ok) {
    const c = nuevo(SUPA_ANON)
    const { data, error } = await c.auth.signInWithPassword({ email: `uno${marca}@prueba.liz`, password: t.json.passwordTemporal })
    ok(!error && data.user, 'el paciente inicia sesión con la contraseña temporal', error?.message)
    ids.u.push(data.user.id)
    const mio = await c.from('paciente').select('id, portal'); ok(mio.data?.length === 1 && mio.data[0].id === p1.id && mio.data[0].portal === 'activo', 'queda vinculado a su expediente y portal activo')
    const pf = await c.from('perfil').select('rol'); ok(pf.data?.[0]?.rol === 'paciente', 'su perfil tiene rol paciente')
  }
  ok((await llamar(admin, { pacienteId: p1.id, modo: 'temporal' })).status === 409, 'segunda cuenta para el mismo paciente: 409')
  ok((await llamar(admin, { pacienteId: crypto.randomUUID(), modo: 'temporal' })).status === 404, 'paciente inexistente: 404')
  ok((await llamar(admin, { pacienteId: p2.id, modo: 'otro' })).status === 400, 'modo inválido: 400')
  const inv = await llamar(admin, { pacienteId: p2.id, modo: 'invitar', redirectTo: 'http://127.0.0.1:3000/nueva-contrasena' })
  ok(inv.status === 200 && inv.json.ok, 'admin: invita por correo', JSON.stringify(inv))
  const d2 = await servicio.from('paciente').select('portal, usuario_id').eq('id', p2.id).single()
  ok(d2.data?.portal === 'invitado' && !!d2.data?.usuario_id, 'paciente invitado queda con portal «invitado»')
  if (d2.data?.usuario_id) ids.u.push(d2.data.usuario_id)
} finally {
  for (const p of ids.p) await servicio.from('paciente').delete().eq('id', p)
  for (const u of ids.u) { await servicio.from('perfil').delete().eq('usuario_id', u); await servicio.auth.admin.deleteUser(u) }
}
console.log(fallos ? `\n${fallos} fallaron` : '\nTodas pasaron'); process.exit(fallos ? 1 : 0)
