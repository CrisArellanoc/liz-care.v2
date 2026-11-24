// Prueba de la función cambiar-correo-paciente: solo administración, validaciones, duplicados y sincronía con la cuenta de acceso.
// Uso: SUPA_URL=... SUPA_ANON=... SUPA_SERVICE=... node tools/prueba-correo.mjs   (Supabase local con la función servida)
import { createClient } from '@supabase/supabase-js'
const { SUPA_URL, SUPA_ANON, SUPA_SERVICE } = process.env
if (!SUPA_URL || !SUPA_ANON || !SUPA_SERVICE) { console.error('Faltan SUPA_URL, SUPA_ANON y SUPA_SERVICE'); process.exit(2) }
const nuevo = (k) => createClient(SUPA_URL, k, { auth: { persistSession: false, autoRefreshToken: false } })
const servicio = nuevo(SUPA_SERVICE)
const PASS = 'Prueba-Liz-2026!'; const marca = Date.now(); let fallos = 0
const ok = (c, n, d = '') => { console.log(`${c ? '✓' : '✗'} ${n}${!c && d ? ` — ${d}` : ''}`); if (!c) fallos++ }
const llamar = async (cli, body) => {
  const { data: { session } } = await cli.auth.getSession()
  const r = await fetch(`${SUPA_URL}/functions/v1/cambiar-correo-paciente`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify(body) })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}
const fila = (n, correo, usuario_id = null) => ({ usuario_id, nombres: n, primer_apellido: 'Prueba', nacimiento: '1980-01-01', sexo: 'F', nacionalidad: 'X', pais: 'MX', idioma: 'Español', telefono: '1', correo, emergencia_nombre: 'X', emergencia_parentesco: 'Y', emergencia_telefono: '1', padecimiento_principal: 'P' })
const ids = { u: [], p: [] }
try {
  const correoAdmin = `ad${marca}@prueba.liz`
  const ad = await servicio.auth.admin.createUser({ email: correoAdmin, password: PASS, email_confirm: true }); ids.u.push(ad.data.user.id)
  await servicio.from('perfil').insert({ usuario_id: ad.data.user.id, nombre: 'Admin', rol: 'administrador' }).throwOnError()
  const admin = nuevo(SUPA_ANON); await admin.auth.signInWithPassword({ email: correoAdmin, password: PASS })

  // Paciente sin cuenta, otro paciente (para el duplicado) y un tercero con cuenta
  const sinCuenta = (await servicio.from('paciente').insert(fila('Sin', `sin${marca}@prueba.liz`)).select().single().throwOnError()).data
  const otro = (await servicio.from('paciente').insert(fila('Otro', `otro${marca}@prueba.liz`)).select().single().throwOnError()).data
  ids.p.push(sinCuenta.id, otro.id)

  // Paciente con cuenta (la que usa para probar el permiso)
  const viejo = `con${marca}@prueba.liz`; const nuevoCorreo = `Nuevo${marca}@Prueba.liz`
  const cu = await servicio.auth.admin.createUser({ email: viejo, password: PASS, email_confirm: true }); ids.u.push(cu.data.user.id)
  await servicio.from('perfil').insert({ usuario_id: cu.data.user.id, nombre: 'Con cuenta', rol: 'paciente' }).throwOnError()
  const conCuenta = (await servicio.from('paciente').insert(fila('Con', viejo, cu.data.user.id)).select().single().throwOnError()).data
  ids.p.push(conCuenta.id)
  const pac = nuevo(SUPA_ANON); await pac.auth.signInWithPassword({ email: viejo, password: PASS })

  // ── Permisos
  ok((await llamar(nuevo(SUPA_ANON), { pacienteId: sinCuenta.id, correo: `x${marca}@prueba.liz` })).status === 401, 'sin sesión: 401')
  const rp = await llamar(pac, { pacienteId: sinCuenta.id, correo: `x${marca}@prueba.liz` })
  ok(rp.status === 403, 'paciente con sesión: 403 (solo administración)', JSON.stringify(rp))
  const sc0 = await servicio.from('paciente').select('correo').eq('id', sinCuenta.id).single()
  ok(sc0.data?.correo === `sin${marca}@prueba.liz`, 'los intentos denegados no cambian el correo')

  // ── Validaciones
  ok((await llamar(admin, { pacienteId: sinCuenta.id, correo: 'no-es-correo' })).status === 400, 'correo inválido: 400')
  ok((await llamar(admin, { pacienteId: sinCuenta.id, correo: '' })).status === 400, 'correo vacío: 400')
  ok((await llamar(admin, { correo: `x${marca}@prueba.liz` })).status === 400, 'sin pacienteId: 400')
  ok((await llamar(admin, { pacienteId: crypto.randomUUID(), correo: `x${marca}@prueba.liz` })).status === 404, 'paciente inexistente: 404')
  const dup = await llamar(admin, { pacienteId: sinCuenta.id, correo: `OTRO${marca}@prueba.liz` })
  ok(dup.status === 409, 'correo ya usado por otro paciente (sin distinguir mayúsculas): 409', JSON.stringify(dup))
  const dupCuenta = await llamar(admin, { pacienteId: conCuenta.id, correo: `otro${marca}@prueba.liz` })
  ok(dupCuenta.status === 409, 'paciente con cuenta: correo de otro paciente: 409', JSON.stringify(dupCuenta))
  const aun = await servicio.auth.admin.getUserById(cu.data.user.id)
  ok(aun.data.user.email === viejo, 'tras el 409 la cuenta conserva su correo')

  // ── Paciente sin cuenta
  const nuevoSin = `sin-nuevo${marca}@prueba.liz`
  const r1 = await llamar(admin, { pacienteId: sinCuenta.id, correo: `  ${nuevoSin.toUpperCase()} ` })
  ok(r1.status === 200 && r1.json.ok === true && !r1.json.cuentaActualizada, 'admin: cambia el correo de un paciente sin cuenta (200)', JSON.stringify(r1))
  const sc1 = await servicio.from('paciente').select('correo, usuario_id').eq('id', sinCuenta.id).single()
  ok(sc1.data?.correo === nuevoSin && sc1.data?.usuario_id === null, 'paciente sin cuenta: correo actualizado (minúsculas, sin espacios) y sigue sin cuenta', JSON.stringify(sc1.data))

  // ── Mismo correo
  const same = await llamar(admin, { pacienteId: sinCuenta.id, correo: nuevoSin })
  ok(same.status === 200 && same.json.sinCambios === true, 'mismo correo: 200 sinCambios', JSON.stringify(same))
  const same2 = await llamar(admin, { pacienteId: sinCuenta.id, correo: nuevoSin.toUpperCase() })
  ok(same2.status === 200 && same2.json.sinCambios === true, 'mismo correo en otras mayúsculas: 200 sinCambios', JSON.stringify(same2))

  // ── Paciente con cuenta
  const r2 = await llamar(admin, { pacienteId: conCuenta.id, correo: nuevoCorreo })
  ok(r2.status === 200 && r2.json.ok === true && r2.json.cuentaActualizada === true, 'admin: cambia el correo de un paciente con cuenta (200, cuentaActualizada)', JSON.stringify(r2))
  const minus = nuevoCorreo.toLowerCase()
  const cc = await servicio.from('paciente').select('correo, usuario_id').eq('id', conCuenta.id).single()
  const au = await servicio.auth.admin.getUserById(cu.data.user.id)
  ok(cc.data?.correo === minus && cc.data?.usuario_id === cu.data.user.id, 'paciente con cuenta: correo del expediente actualizado y sigue vinculado', JSON.stringify(cc.data))
  ok(au.data.user.email === minus && cc.data?.correo === au.data.user.email, 'el correo del expediente coincide con el de Auth', au.data.user.email)
  const nuevoLogin = nuevo(SUPA_ANON)
  const l1 = await nuevoLogin.auth.signInWithPassword({ email: minus, password: PASS })
  ok(!l1.error && l1.data.user?.id === cu.data.user.id, 'el paciente inicia sesión con el correo NUEVO', l1.error?.message)
  const mio = await nuevoLogin.from('paciente').select('id, correo')
  ok(mio.data?.length === 1 && mio.data[0].id === conCuenta.id && mio.data[0].correo === minus, 'con el correo nuevo sigue viendo su expediente')
  const l2 = await nuevo(SUPA_ANON).auth.signInWithPassword({ email: viejo, password: PASS })
  ok(!!l2.error && !l2.data.user, 'ya NO inicia sesión con el correo viejo')
  const volver = await llamar(admin, { pacienteId: conCuenta.id, correo: minus })
  ok(volver.status === 200 && volver.json.sinCambios === true, 'repetir el correo nuevo: 200 sinCambios')
  // El correo viejo queda libre: se puede asignar a otro paciente
  const libre = await llamar(admin, { pacienteId: otro.id, correo: viejo })
  ok(libre.status === 200 && libre.json.ok === true, 'el correo viejo queda libre para otro paciente (200)', JSON.stringify(libre))
} finally {
  for (const p of ids.p) await servicio.from('paciente').delete().eq('id', p)
  for (const u of ids.u) { await servicio.from('perfil').delete().eq('usuario_id', u); await servicio.auth.admin.deleteUser(u) }
}
console.log(fallos ? `\n${fallos} fallaron` : '\nTodas pasaron'); process.exit(fallos ? 1 : 0)
