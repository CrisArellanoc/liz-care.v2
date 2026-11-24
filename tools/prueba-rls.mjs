// Prueba de permisos en el servidor (RLS + Storage) con administradora, dos pacientes y un usuario sin sesión.
// Uso: SUPA_URL=... SUPA_ANON=... SUPA_SERVICE=... node tools/prueba-rls.mjs
// Crea datos de prueba con correos @prueba.liz y los borra al terminar. Pensado para el Supabase local.
import { createClient } from '@supabase/supabase-js'

const { SUPA_URL, SUPA_ANON, SUPA_SERVICE } = process.env
if (!SUPA_URL || !SUPA_ANON || !SUPA_SERVICE) { console.error('Faltan SUPA_URL, SUPA_ANON y SUPA_SERVICE'); process.exit(2) }

const nuevo = (llave) => createClient(SUPA_URL, llave, { auth: { persistSession: false, autoRefreshToken: false } })
const servicio = nuevo(SUPA_SERVICE)
const PASS = 'Prueba-Liz-2026!'
const marca = Date.now()
let fallos = 0
const ok = (cond, nombre, detalle = '') => { console.log(`${cond ? '✓' : '✗'} ${nombre}${!cond && detalle ? ` — ${detalle}` : ''}`); if (!cond) fallos++ }

async function cuenta(correo, nombre, rol) {
  const { data, error } = await servicio.auth.admin.createUser({ email: correo, password: PASS, email_confirm: true })
  if (error) throw error
  await servicio.from('perfil').insert({ usuario_id: data.user.id, nombre, rol }).throwOnError()
  const cliente = nuevo(SUPA_ANON)
  const { error: e2 } = await cliente.auth.signInWithPassword({ email: correo, password: PASS })
  if (e2) throw e2
  return { id: data.user.id, cliente }
}

const filaPaciente = (n, correo, usuario_id) => ({
  usuario_id, nombres: n, primer_apellido: 'Prueba', nacimiento: '1980-01-01', sexo: 'F', nacionalidad: 'Canadiense', pais: 'CA',
  idioma: 'Inglés', telefono: '+1 555 0100', correo, emergencia_nombre: 'X', emergencia_parentesco: 'Hijo', emergencia_telefono: '+1 555 0101',
  padecimiento_principal: 'Prueba', portal: 'activo',
})

const creados = { usuarios: [], pacientes: [], especialistas: [], archivos: [] }
try {
  const admin = await cuenta(`admin${marca}@prueba.liz`, 'Admin Prueba', 'administrador')
  const a = await cuenta(`a${marca}@prueba.liz`, 'Paciente A', 'paciente')
  const b = await cuenta(`b${marca}@prueba.liz`, 'Paciente B', 'paciente')
  creados.usuarios.push(admin.id, a.id, b.id)
  const { data: pa } = await servicio.from('paciente').insert(filaPaciente('Ana', `a${marca}@prueba.liz`, a.id)).select().single().throwOnError()
  const { data: pb } = await servicio.from('paciente').insert(filaPaciente('Beto', `b${marca}@prueba.liz`, b.id)).select().single().throwOnError()
  creados.pacientes.push(pa.id, pb.id)
  const anon = nuevo(SUPA_ANON)

  // Administradora crea catálogo y atenciones (también prueba que puede escribir).
  const { data: esp, error: eesp } = await admin.cliente.from('especialista').insert({ nombre: 'Dra. Prueba', especialidad: 'Cardiología', institucion: 'Hospital', sector: 'Privado', telefono: '1', idiomas: ['Español'] }).select().single()
  ok(!eesp, 'admin: crea especialista', eesp?.message)
  creados.especialistas.push(esp.id)
  const mk = async (p, nota) => {
    const { data, error } = await admin.cliente.from('atencion').insert({ paciente_id: p.id, especialista_id: esp.id, fecha: '2026-11-01T10:00:00Z', motivo: 'Control', overview: 'Resumen', estado: 'completada' }).select().single()
    if (error) throw error
    await admin.cliente.from('atencion_nota_interna').insert({ atencion_id: data.id, nota: nota }).throwOnError()
    await admin.cliente.from('medicamento_prescrito').insert({ atencion_id: data.id, nombre: 'Med', horarios: ['mañana'] }).throwOnError()
    const ruta = `${p.id}/${data.id}/receta.png`
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const up = await admin.cliente.storage.from('recetas').upload(ruta, png, { contentType: 'image/png' })
    if (up.error) throw up.error
    creados.archivos.push(ruta)
    await admin.cliente.from('archivo_receta').insert({ atencion_id: data.id, ruta, nombre_original: 'receta.png', tipo_mime: 'image/png', tamano_bytes: 8 }).throwOnError()
    return { ...data, ruta }
  }
  const atA = await mk(pa, 'NOTA INTERNA A')
  const atB = await mk(pb, 'NOTA INTERNA B')

  // ── Administradora ve todo
  const todosP = await admin.cliente.from('paciente').select('id').in('id', [pa.id, pb.id])
  ok(todosP.data?.length === 2, 'admin: ve a los dos pacientes')
  const notas = await admin.cliente.from('atencion_nota_interna').select('nota')
  ok(notas.data?.length >= 2, 'admin: lee notas internas')

  // ── Usuario sin sesión: nada
  for (const t of ['perfil', 'paciente', 'especialista', 'atencion', 'atencion_nota_interna', 'medicamento_prescrito', 'archivo_receta', 'historial_medico']) {
    const r = await anon.from(t).select('*')
    ok(!!r.error || (r.data ?? []).length === 0, `sin sesión: ${t} vacío o denegado`)
  }
  const ins = await anon.from('paciente').insert(filaPaciente('X', `x${marca}@prueba.liz`, null))
  ok(!!ins.error, 'sin sesión: no puede registrar pacientes')
  const sinFirma = await anon.storage.from('recetas').createSignedUrl(atA.ruta, 60)
  ok(!!sinFirma.error, 'sin sesión: no obtiene enlace de receta')

  // ── Paciente A
  const mios = await a.cliente.from('paciente').select('id')
  ok(mios.data?.length === 1 && mios.data[0].id === pa.id, 'paciente A: solo ve su expediente')
  const misAt = await a.cliente.from('atencion').select('id, paciente_id, atencion_nota_interna(nota), medicamento_prescrito(nombre), archivo_receta(ruta)')
  ok(misAt.data?.length === 1 && misAt.data[0].id === atA.id, 'paciente A: solo ve su atención')
  ok(misAt.data?.[0]?.atencion_nota_interna == null, 'paciente A: NO recibe la nota interna (ni embebida)')
  ok(misAt.data?.[0]?.medicamento_prescrito?.length === 1 && misAt.data?.[0]?.archivo_receta?.ruta === atA.ruta, 'paciente A: ve sus medicamentos y receta')
  const nt = await a.cliente.from('atencion_nota_interna').select('*')
  ok((nt.data ?? []).length === 0, 'paciente A: tabla de notas internas vacía')
  const ajeno = await a.cliente.from('atencion').select('id').eq('id', atB.id)
  ok((ajeno.data ?? []).length === 0, 'paciente A: no ve la atención de B')
  const esps = await a.cliente.from('especialista').select('id')
  ok(esps.data?.length >= 1, 'paciente A: consulta el catálogo de especialistas')
  const crea = await a.cliente.from('atencion').insert({ paciente_id: pa.id, especialista_id: esp.id, fecha: '2026-12-01T10:00:00Z', motivo: 'x', estado: 'programada' })
  ok(!!crea.error, 'paciente A: no puede crear atenciones')
  const edita = await a.cliente.from('paciente').update({ padecimiento_principal: 'hack' }).eq('id', pa.id).select()
  ok(!edita.error && (edita.data ?? []).length === 0, 'paciente A: no puede editar su expediente')
  const hAjeno = await a.cliente.from('historial_medico').insert({ paciente_id: pb.id, padecimientos: ['x'], alergias: [], sin_alergias: true, tratamientos: [], sin_tratamientos: true })
  ok(!!hAjeno.error, 'paciente A: no puede enviar el historial de B')
  const h1 = await a.cliente.from('historial_medico').insert({ paciente_id: pa.id, padecimientos: [], sin_padecimientos: true, alergias: ['Penicilina'], tratamientos: [], sin_tratamientos: true })
  ok(!h1.error, 'paciente A: envía su historial', h1.error?.message)
  const h2 = await a.cliente.from('historial_medico').insert({ paciente_id: pa.id, padecimientos: [], sin_padecimientos: true, alergias: ['x'], tratamientos: [], sin_tratamientos: true })
  ok(h2.error?.code === '23505', 'paciente A: segundo envío rechazado (solo una vez)', h2.error?.message)
  const hMal = await b.cliente.from('historial_medico').insert({ paciente_id: pb.id, padecimientos: [], sin_padecimientos: false, alergias: [], sin_alergias: true, tratamientos: [], sin_tratamientos: true })
  ok(!!hMal.error, 'paciente B: «ninguno» sin marca explícita rechazado (CA-08)')
  const firmaOk = await a.cliente.storage.from('recetas').createSignedUrl(atA.ruta, 60)
  ok(!firmaOk.error && !!firmaOk.data?.signedUrl, 'paciente A: obtiene enlace temporal de su receta', firmaOk.error?.message)
  if (firmaOk.data?.signedUrl) {
    const r = await fetch(firmaOk.data.signedUrl)
    ok(r.ok, 'el enlace temporal descarga la imagen')
  }
  const firmaAjena = await a.cliente.storage.from('recetas').createSignedUrl(atB.ruta, 60)
  ok(!!firmaAjena.error, 'paciente A: NO obtiene enlace de la receta de B')
  const subida = await a.cliente.storage.from('recetas').upload(`${pa.id}/mia.png`, new Uint8Array([1]), { contentType: 'image/png' })
  ok(!!subida.error, 'paciente A: no puede subir archivos')
  const pub = await fetch(`${SUPA_URL}/storage/v1/object/public/recetas/${atA.ruta}`)
  ok(!pub.ok, 'el bucket no es público (URL pública devuelve error)')

  // ── Servidor exige tipo de archivo
  const pdf = await admin.cliente.storage.from('recetas').upload(`${pa.id}/malo.pdf`, new Uint8Array([1, 2]), { contentType: 'application/pdf' })
  ok(!!pdf.error, 'admin: el servidor rechaza un PDF')
  const grande = await admin.cliente.storage.from('recetas').upload(`${pa.id}/grande.png`, new Uint8Array(10 * 1024 * 1024 + 1), { contentType: 'image/png' })
  ok(!!grande.error, 'admin: el servidor rechaza más de 10 MB')

  // ── Paciente B no ve lo de A
  const bAt = await b.cliente.from('atencion').select('id')
  ok(bAt.data?.length === 1 && bAt.data[0].id === atB.id, 'paciente B: solo ve su atención')
  const bHist = await b.cliente.from('historial_medico').select('paciente_id')
  ok((bHist.data ?? []).length === 0, 'paciente B: no ve el historial de A')
  const bFirma = await b.cliente.storage.from('recetas').createSignedUrl(atA.ruta, 60)
  ok(!!bFirma.error, 'paciente B: NO obtiene enlace de la receta de A')

  // ── Un paciente no puede volverse administrador ni leer perfiles ajenos
  const per = await a.cliente.from('perfil').select('usuario_id')
  ok(per.data?.length === 1, 'paciente A: solo ve su propio perfil')
  const esc = await a.cliente.from('perfil').update({ rol: 'administrador' }).eq('usuario_id', a.id).select()
  ok((esc.data ?? []).length === 0, 'paciente A: no puede cambiar su rol a administrador')
  const activar = await a.cliente.rpc('activar_portal')
  ok(!activar.error, 'paciente A: activar_portal funciona')

  // ── Solicitudes del sitio público (solicitud_contacto)
  const sol = (sufijo, extra = {}) => ({
    tipo: 'cita', nombres: 'Sol', primer_apellido: 'Visitante', telefono: '+1 555 0199', correo: `Sol${sufijo}${marca}@Prueba.liz`, idioma: 'Inglés',
    mensaje: 'Dolor de rodilla', nacimiento: '1975-05-05', sexo: 'F', nacionalidad: 'Estadounidense', pais: 'US',
    emergencia_nombre: 'Contacto', emergencia_parentesco: 'Hermano', emergencia_telefono: '+1 555 0198', ...extra,
  })
  const mkSol = async (sufijo, extra) => {
    const { data, error } = await servicio.from('solicitud_contacto').insert(sol(sufijo, extra)).select().single()
    if (error) throw error
    return data
  }
  const estadoSol = async (id) => (await servicio.from('solicitud_contacto').select('estado, paciente_id, resuelta_el').eq('id', id).single()).data

  // (a) envío público completo, sin .select()
  const envio = await anon.from('solicitud_contacto').insert(sol('a'))
  ok(!envio.error, 'sin sesión: puede enviar una solicitud de cita completa', envio.error?.message)
  const { data: solA } = await servicio.from('solicitud_contacto').select('*').ilike('correo', `sola${marca}@prueba.liz`).single()
  ok(solA?.estado === 'nueva' && solA?.paciente_id === null && solA?.tipo === 'cita', 'la solicitud pública queda «nueva» y sin paciente')
  // (b) no puede leer
  const leeSol = await anon.from('solicitud_contacto').select('*')
  ok(!!leeSol.error || (leeSol.data ?? []).length === 0, 'sin sesión: no puede leer solicitudes')
  // (c) no puede forzar estado ni paciente_id
  const fuerzaEstado = await anon.from('solicitud_contacto').insert({ ...sol('c1'), estado: 'aceptada' })
  ok(!!fuerzaEstado.error, 'sin sesión: no puede insertar con estado «aceptada»')
  const fuerzaPac = await anon.from('solicitud_contacto').insert({ ...sol('c2'), paciente_id: pa.id })
  ok(!!fuerzaPac.error, 'sin sesión: no puede insertar con paciente_id')
  // (d) cita sin emergencia
  const sinEmerg = await anon.from('solicitud_contacto').insert(sol('d', { emergencia_nombre: null, emergencia_parentesco: null, emergencia_telefono: null }))
  ok(!!sinEmerg.error, 'una cita sin datos de emergencia es rechazada', sinEmerg.error?.message)
  // (e) correo inválido
  const malCorreo = await anon.from('solicitud_contacto').insert(sol('e', { correo: 'no-es-correo' }))
  ok(!!malCorreo.error, 'un correo inválido es rechazado')
  // (f) paciente con sesión
  const pSol = await a.cliente.from('solicitud_contacto').select('id')
  ok((pSol.data ?? []).length === 0, 'paciente A: no ve solicitudes')
  const pAcep = await a.cliente.rpc('aceptar_solicitud', { p_id: solA.id })
  ok(pAcep.error?.code === '42501', 'paciente A: aceptar_solicitud denegado (42501)', pAcep.error?.message)
  const pRech = await a.cliente.rpc('rechazar_solicitud', { p_id: solA.id })
  ok(pRech.error?.code === '42501', 'paciente A: rechazar_solicitud denegado (42501)', pRech.error?.message)
  const pEdit = await a.cliente.from('solicitud_contacto').update({ estado: 'aceptada' }).eq('id', solA.id).select()
  ok((pEdit.data ?? []).length === 0, 'paciente A: no puede editar solicitudes')
  // (g) anon no ejecuta los rpc
  const gAcep = await anon.rpc('aceptar_solicitud', { p_id: solA.id })
  ok(!!gAcep.error, 'sin sesión: aceptar_solicitud denegado', gAcep.error?.message)
  const gRech = await anon.rpc('rechazar_solicitud', { p_id: solA.id })
  ok(!!gRech.error, 'sin sesión: rechazar_solicitud denegado', gRech.error?.message)
  ok((await estadoSol(solA.id)).estado === 'nueva', 'tras los intentos denegados la solicitud sigue «nueva»')
  // (h) la administradora acepta
  const adSol = await admin.cliente.from('solicitud_contacto').select('id').eq('id', solA.id)
  ok(adSol.data?.length === 1, 'admin: ve la solicitud')
  const acep = await admin.cliente.rpc('aceptar_solicitud', { p_id: solA.id })
  ok(!acep.error && typeof acep.data === 'string' && /^[0-9a-f-]{36}$/.test(acep.data), 'admin: aceptar_solicitud devuelve el uuid del paciente', acep.error?.message)
  if (acep.data) creados.pacientes.push(acep.data)
  const { data: pn } = await servicio.from('paciente').select('*').eq('id', acep.data ?? '00000000-0000-0000-0000-000000000000').maybeSingle()
  ok(!!pn && pn.correo === `sola${marca}@prueba.liz` && pn.padecimiento_principal === 'Dolor de rodilla', 'el paciente creado tiene el correo en minúsculas y padecimiento = mensaje', JSON.stringify(pn))
  ok(!!pn && pn.nombres === 'Sol' && pn.primer_apellido === 'Visitante' && pn.telefono === '+1 555 0199' && pn.nacimiento === '1975-05-05' && pn.sexo === 'F'
    && pn.nacionalidad === 'Estadounidense' && pn.pais === 'US' && pn.idioma === 'Inglés' && pn.emergencia_nombre === 'Contacto'
    && pn.emergencia_parentesco === 'Hermano' && pn.emergencia_telefono === '+1 555 0198', 'el paciente creado conserva los demás datos de la solicitud')
  ok(pn?.estado === 'activo' && pn?.portal === 'sin acceso' && pn?.usuario_id === null, 'el paciente nuevo está activo y sin acceso al portal')
  const stA = await estadoSol(solA.id)
  ok(stA.estado === 'aceptada' && stA.paciente_id === acep.data && !!stA.resuelta_el, 'la solicitud queda «aceptada» con paciente_id')
  const otraVez = await admin.cliente.rpc('aceptar_solicitud', { p_id: solA.id })
  ok(!!otraVez.error && /ya-resuelta/.test(otraVez.error.message), 'aceptar de nuevo falla (ya-resuelta)', otraVez.error?.message)
  const rechAcept = await admin.cliente.rpc('rechazar_solicitud', { p_id: solA.id })
  ok(!!rechAcept.error && /ya-resuelta/.test(rechAcept.error.message), 'rechazar una ya aceptada falla (ya-resuelta)', rechAcept.error?.message)
  const noExiste = await admin.cliente.rpc('aceptar_solicitud', { p_id: crypto.randomUUID() })
  ok(noExiste.error?.code === 'P0002', 'aceptar una solicitud inexistente falla (P0002)', noExiste.error?.message)
  // (i) mismo correo que un paciente existente
  const solDup = await mkSol('a')
  const dup = await admin.cliente.rpc('aceptar_solicitud', { p_id: solDup.id })
  ok(dup.error?.code === '23505', 'aceptar con un correo ya registrado falla (23505)', dup.error?.message)
  const stDup = await estadoSol(solDup.id)
  ok(stDup.estado === 'nueva' && stDup.paciente_id === null && stDup.resuelta_el === null, 'la solicitud con correo duplicado queda «nueva» sin cambios')
  const cuenta1 = await servicio.from('paciente').select('id').ilike('correo', `sola${marca}@prueba.liz`)
  ok(cuenta1.data?.length === 1, 'no se creó un segundo paciente con ese correo')
  // (j) rechazar
  const solR = await mkSol('r')
  const rech = await admin.cliente.rpc('rechazar_solicitud', { p_id: solR.id })
  ok(!rech.error, 'admin: rechazar_solicitud funciona', rech.error?.message)
  const stR = await estadoSol(solR.id)
  ok(stR.estado === 'rechazada' && stR.paciente_id === null && !!stR.resuelta_el, 'la solicitud queda «rechazada» sin paciente')
  const pR = await servicio.from('paciente').select('id').ilike('correo', `solr${marca}@prueba.liz`)
  ok((pR.data ?? []).length === 0, 'rechazar no crea paciente')
  const aceptaRech = await admin.cliente.rpc('aceptar_solicitud', { p_id: solR.id })
  ok(!!aceptaRech.error && /ya-resuelta/.test(aceptaRech.error.message), 'aceptar una rechazada falla (ya-resuelta)')
  // (k) informes (solo contacto)
  const envInf = await anon.from('solicitud_contacto').insert({ tipo: 'informes', nombres: 'Info', primer_apellido: 'Curioso', telefono: '+1 555 0177', correo: `solinf${marca}@prueba.liz` })
  ok(!envInf.error, 'sin sesión: puede enviar una solicitud de informes (solo contacto)', envInf.error?.message)
  const { data: solI } = await servicio.from('solicitud_contacto').select('id').ilike('correo', `solinf${marca}@prueba.liz`).single()
  const acepI = await admin.cliente.rpc('aceptar_solicitud', { p_id: solI.id })
  ok(!acepI.error && acepI.data === null, 'aceptar una solicitud de informes devuelve null', acepI.error?.message)
  const stI = await estadoSol(solI.id)
  ok(stI.estado === 'aceptada' && stI.paciente_id === null, 'la de informes queda «aceptada» sin paciente')
  const pI = await servicio.from('paciente').select('id').ilike('correo', `solinf${marca}@prueba.liz`)
  ok((pI.data ?? []).length === 0, 'una solicitud de informes no crea paciente')
} finally {
  await servicio.from('solicitud_contacto').delete().ilike('correo', `%${marca}@prueba.liz`)
  for (const r of creados.archivos) await servicio.storage.from('recetas').remove([r])
  for (const p of creados.pacientes) { await servicio.from('atencion').delete().eq('paciente_id', p); await servicio.from('historial_medico').delete().eq('paciente_id', p); await servicio.from('paciente').delete().eq('id', p) }
  for (const e of creados.especialistas) await servicio.from('especialista').delete().eq('id', e)
  for (const u of creados.usuarios) await servicio.auth.admin.deleteUser(u)
}
console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodas las comprobaciones pasaron')
process.exit(fallos ? 1 : 0)
