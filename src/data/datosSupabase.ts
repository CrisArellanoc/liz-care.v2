// Persistencia en Supabase de especialistas, atenciones (con medicamentos, nota interna y receta), historial inicial y
// cuentas de pacientes. Traduce entre filas y los tipos de la app. Los permisos los decide la base (RLS), no el navegador:
// el paciente nunca recibe la nota interna porque su tabla solo la lee la administración.
import type { SupabaseClient } from '@supabase/supabase-js'
import { HistorialYaEnviadoError } from '../modules/historial-inicial/historial'
import { CorreoDuplicadoError, type NuevoPaciente } from '../modules/pacientes/registro'
import type { ArchivoReceta, Consulta, Especialista, HistorialInicial, Medicamento, Paciente, Sector, Solicitud } from './types'
import { aPaciente, type FilaPaciente } from './pacientesSupabase'

const BUCKET = 'recetas'

const falla = (e: { message: string } | null) => { if (e) throw new Error(e.message) }

// ── Especialistas ───────────────────────────────────────────────────────────────────────────

interface FilaEspecialista {
  id: string; nombre: string; especialidad: string; foto: string | null; institucion: string
  sector: Sector; direccion: string; telefono: string; idiomas: string[]
}

const aEspecialista = (f: FilaEspecialista): Especialista => ({
  id: f.id, nombre: f.nombre, especialidad: f.especialidad, foto: f.foto ?? undefined, institucion: f.institucion,
  sector: f.sector, direccion: f.direccion, telefono: f.telefono, idiomas: f.idiomas,
})

export async function insertarEspecialista(db: SupabaseClient, e: Omit<Especialista, 'id'>): Promise<Especialista> {
  const { data, error } = await db.from('especialista').insert({
    nombre: e.nombre, especialidad: e.especialidad, foto: e.foto ?? null, institucion: e.institucion,
    sector: e.sector, direccion: e.direccion, telefono: e.telefono, idiomas: e.idiomas,
  }).select().single<FilaEspecialista>()
  if (error) throw new Error(error.message)
  return aEspecialista(data)
}

// ── Lectura ─────────────────────────────────────────────────────────────────────────────────

interface FilaAtencion {
  id: string; paciente_id: string; especialista_id: string; fecha: string; motivo: string; overview: string
  nota_visible: string | null; estado: 'programada' | 'completada'; acompanamiento: boolean; traduccion: boolean
  indicaciones_generales: string; sin_medicamentos: boolean
  // Relaciones uno a uno: la API devuelve un objeto o null (null también cuando RLS no deja verla).
  atencion_nota_interna: { nota: string } | null
  archivo_receta: { ruta: string; nombre_original: string; tipo_mime: ArchivoReceta['tipoMime']; tamano_bytes: number } | null
  medicamento_prescrito: (Omit<Medicamento, 'horarios'> & { orden: number; horarios: Medicamento['horarios'] })[]
}

const SELECT_ATENCION = '*, atencion_nota_interna(nota), archivo_receta(ruta, nombre_original, tipo_mime, tamano_bytes), medicamento_prescrito(*)'

async function aConsultas(filas: FilaAtencion[]): Promise<Consulta[]> {
  // La foto nunca tiene una URL pública: no se firma aquí, se firma al mostrarla (src/lib/useEnlaceReceta.ts).
  return filas.map((f) => {
    const meds = [...f.medicamento_prescrito].sort((a, b) => a.orden - b.orden)
    const completada = f.estado === 'completada'
    return {
      id: f.id, pacienteId: f.paciente_id, especialistaId: f.especialista_id, fecha: f.fecha, motivo: f.motivo,
      overview: f.overview, notaVisible: f.nota_visible ?? undefined, notaInterna: f.atencion_nota_interna?.nota,
      estado: f.estado, acompanamiento: f.acompanamiento, traduccion: f.traduccion,
      tratamiento: completada
        ? {
            medicamentos: meds.map((m) => ({ nombre: m.nombre, dosis: m.dosis, frecuencia: m.frecuencia, duracion: m.duracion, indicaciones: m.indicaciones, horarios: m.horarios })),
            sinMedicamentos: f.sin_medicamentos || undefined,
            indicacionesGenerales: f.indicaciones_generales,
          }
        : undefined,
      receta: f.archivo_receta
        ? { url: '', nombreOriginal: f.archivo_receta.nombre_original, tipoMime: f.archivo_receta.tipo_mime, tamanoBytes: f.archivo_receta.tamano_bytes, ruta: f.archivo_receta.ruta }
        : undefined,
    }
  })
}

interface FilaHistorial {
  paciente_id: string; completado_el: string; padecimientos: string[]; sin_padecimientos: boolean
  alergias: string[]; sin_alergias: boolean; tratamientos: string[]; sin_tratamientos: boolean
  cirugias: string | null; notas: string | null
}

const aHistorialInicial = (f: FilaHistorial): HistorialInicial => ({
  completadoEl: f.completado_el, padecimientos: f.padecimientos, sinPadecimientos: f.sin_padecimientos,
  alergias: f.alergias, sinAlergias: f.sin_alergias, tratamientos: f.tratamientos, sinTratamientos: f.sin_tratamientos,
  cirugias: f.cirugias ?? undefined, notas: f.notas ?? undefined,
})

export interface DatosRemotos { pacientes: Paciente[]; especialistas: Especialista[]; consultas: Consulta[]; solicitudes: Solicitud[] }

/** Lee todo lo que la sesión puede ver: la administradora, todo; el paciente, solo lo suyo (lo decide RLS). */
export async function cargarDatos(db: SupabaseClient): Promise<DatosRemotos> {
  const [p, e, a, h, so] = await Promise.all([
    db.from('paciente').select('*').order('fecha_alta', { ascending: false }),
    db.from('especialista').select('*').order('nombre'),
    db.from('atencion').select(SELECT_ATENCION).order('fecha', { ascending: true }),
    db.from('historial_medico').select('*'),
    db.from('solicitud_contacto').select('*').order('creada_el', { ascending: false }), // solo la administración recibe filas (RLS)
  ])
  falla(p.error); falla(e.error); falla(a.error); falla(h.error); falla(so.error)
  const historiales = new Map((h.data as FilaHistorial[]).map((x) => [x.paciente_id, aHistorialInicial(x)]))
  return {
    pacientes: (p.data as FilaPaciente[]).map((f) => ({ ...aPaciente(f), historialInicial: historiales.get(f.id) })),
    especialistas: (e.data as FilaEspecialista[]).map(aEspecialista),
    consultas: await aConsultas(a.data as unknown as FilaAtencion[]),
    solicitudes: (so.data as FilaSolicitud[]).map(aSolicitud),
  }
}

/** Enlace temporal a una receta del bucket privado; solo lo obtiene quien tiene permiso (RLS de Storage). */
export async function firmarReceta(db: SupabaseClient, ruta: string, segundos: number): Promise<string | undefined> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(ruta, segundos)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

// ── Escritura de atenciones ─────────────────────────────────────────────────────────────────

const extensionDe = (mime: string, nombre: string) =>
  mime === 'image/png' ? 'png' : mime === 'image/heic' ? 'heic' : mime === 'image/jpeg' ? 'jpg' : (nombre.split('.').pop() ?? 'bin').toLowerCase()

/** Sube la foto al bucket privado y devuelve sus metadatos con la ruta definitiva. */
async function subirReceta(db: SupabaseClient, pacienteId: string, atencionId: string, r: ArchivoReceta): Promise<ArchivoReceta & { ruta: string }> {
  let archivo = r.archivo
  if (!archivo) {
    // «Receta de ejemplo» u otra imagen servida por la propia app.
    const resp = await fetch(r.url)
    if (!resp.ok) throw new Error('No se pudo leer la imagen de la receta.')
    archivo = new File([await resp.blob()], r.nombreOriginal, { type: r.tipoMime })
  }
  const ruta = `${pacienteId}/${atencionId}/${crypto.randomUUID()}.${extensionDe(r.tipoMime, r.nombreOriginal)}`
  const { error } = await db.storage.from(BUCKET).upload(ruta, archivo, { contentType: r.tipoMime })
  if (error) throw new Error(error.message)
  return { ...r, ruta }
}

type EntradaConsulta = Omit<Consulta, 'id'>

/** Guarda una atención nueva o actualiza `existente`; medicamentos, nota interna y receta van en sus tablas. */
export async function guardarAtencionRemota(db: SupabaseClient, c: EntradaConsulta, existente?: Consulta): Promise<Consulta> {
  const fila = {
    especialista_id: c.especialistaId, fecha: c.fecha, motivo: c.motivo, overview: c.overview,
    nota_visible: c.notaVisible ?? null, estado: c.estado, acompanamiento: c.acompanamiento, traduccion: c.traduccion,
    indicaciones_generales: c.tratamiento?.indicacionesGenerales ?? '', sin_medicamentos: c.tratamiento?.sinMedicamentos ?? false,
  }
  let id: string
  if (existente) {
    id = existente.id
    const { error } = await db.from('atencion').update(fila).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await db.from('atencion').insert({ ...fila, paciente_id: c.pacienteId }).select('id').single<{ id: string }>()
    if (error) throw new Error(error.message)
    id = data.id
  }

  try {
    // Nota interna: solo existe si se escribió una.
    if (c.notaInterna) falla((await db.from('atencion_nota_interna').upsert({ atencion_id: id, nota: c.notaInterna })).error)
    else if (existente?.notaInterna) falla((await db.from('atencion_nota_interna').delete().eq('atencion_id', id)).error)

    // Medicamentos: se reemplaza la lista completa.
    if (existente) falla((await db.from('medicamento_prescrito').delete().eq('atencion_id', id)).error)
    const meds = c.tratamiento?.medicamentos ?? []
    if (meds.length) {
      falla((await db.from('medicamento_prescrito').insert(meds.map((m, orden) => ({ atencion_id: id, orden, nombre: m.nombre, dosis: m.dosis, frecuencia: m.frecuencia, duracion: m.duracion, indicaciones: m.indicaciones, horarios: m.horarios })))).error)
    }

    // Receta: nueva foto, sin cambios (ya tiene ruta) o retirada.
    let receta = c.receta
    if (c.receta && !c.receta.ruta) {
      const subida = await subirReceta(db, c.pacienteId, id, c.receta)
      falla((await db.from('archivo_receta').upsert({ atencion_id: id, ruta: subida.ruta, nombre_original: subida.nombreOriginal, tipo_mime: subida.tipoMime, tamano_bytes: subida.tamanoBytes }, { onConflict: 'atencion_id' })).error)
      if (existente?.receta?.ruta) await db.storage.from(BUCKET).remove([existente.receta.ruta])
      receta = { ...subida, archivo: undefined, url: '' } // se firma al mostrarla
    } else if (!c.receta && existente?.receta?.ruta) {
      falla((await db.from('archivo_receta').delete().eq('atencion_id', id)).error)
      await db.storage.from(BUCKET).remove([existente.receta.ruta])
    }
    return { ...c, id, receta }
  } catch (e) {
    // Una atención nueva no debe quedar a medias; una existente conserva su cabecera ya actualizada.
    if (!existente) await db.from('atencion').delete().eq('id', id)
    throw e
  }
}

// ── Historial inicial ───────────────────────────────────────────────────────────────────────

export async function insertarHistorial(db: SupabaseClient, pacienteId: string, h: HistorialInicial): Promise<void> {
  const { error } = await db.from('historial_medico').insert({
    paciente_id: pacienteId, completado_el: h.completadoEl,
    padecimientos: h.padecimientos, sin_padecimientos: h.sinPadecimientos,
    alergias: h.alergias, sin_alergias: h.sinAlergias,
    tratamientos: h.tratamientos, sin_tratamientos: h.sinTratamientos,
    cirugias: h.cirugias ?? null, notas: h.notas ?? null,
  })
  // La llave primaria impide un segundo envío: 23505 = ya existe.
  if (error) throw error.code === '23505' ? new HistorialYaEnviadoError() : new Error(error.message)
}

// ── Cuentas de pacientes ────────────────────────────────────────────────────────────────────

export type ModoCuenta = 'invitar' | 'temporal'
export type ResultadoCuenta =
  | { ok: true; modo: ModoCuenta; correo: string; passwordTemporal?: string }
  | { ok: false; error: 'sin-sesion' | 'solo-administracion' | 'ya-tiene-cuenta' | 'paciente-no-existe' | 'correo-en-uso' | 'limite-correos' | 'error' }

/** Pide a la función del servidor crear la cuenta (la llave secreta no sale del servidor). */
export async function crearCuentaPaciente(db: SupabaseClient, pacienteId: string, modo: ModoCuenta): Promise<ResultadoCuenta> {
  const { data, error } = await db.functions.invoke('crear-cuenta-paciente', {
    body: { pacienteId, modo, redirectTo: `${window.location.origin}/nueva-contrasena` },
  })
  if (!error && data?.ok) return data as ResultadoCuenta
  let cuerpo: { error?: string } | undefined
  try { cuerpo = await (error as { context?: Response } | null)?.context?.json() } catch { /* sin cuerpo */ }
  const codigo = cuerpo?.error ?? data?.error
  if (codigo === 'sin-sesion' || codigo === 'solo-administracion' || codigo === 'ya-tiene-cuenta' || codigo === 'paciente-no-existe' || codigo === 'correo-en-uso') return { ok: false, error: codigo }
  if ((error as { context?: Response } | null)?.context?.status === 429) return { ok: false, error: 'limite-correos' }
  return { ok: false, error: 'error' }
}

// ── Solicitudes del sitio público ───────────────────────────────────────────────────────────

interface FilaSolicitud {
  id: string; creada_el: string; tipo: 'cita' | 'informes'; nombres: string; primer_apellido: string; segundo_apellido: string | null
  telefono: string; correo: string; especialidad: string | null; idioma: string | null; mensaje: string | null
  nacimiento: string | null; sexo: 'F' | 'M' | 'X' | null; nacionalidad: string | null; pais: string | null
  emergencia_nombre: string | null; emergencia_parentesco: string | null; emergencia_telefono: string | null
  estado: Solicitud['estado']; paciente_id: string | null; resuelta_el: string | null
}

const aSolicitud = (f: FilaSolicitud): Solicitud => ({
  id: f.id, creadaEl: f.creada_el, tipo: f.tipo, nombre: f.nombres, apellidoPaterno: f.primer_apellido,
  apellidoMaterno: f.segundo_apellido ?? undefined, telefono: f.telefono, email: f.correo,
  especialidad: f.especialidad ?? undefined, idioma: f.idioma ?? undefined, mensaje: f.mensaje ?? undefined,
  fechaNacimiento: f.nacimiento ?? undefined, sexo: f.sexo ?? undefined, nacionalidad: f.nacionalidad ?? undefined, pais: f.pais ?? undefined,
  contactoEmergencia: f.emergencia_nombre ? { nombre: f.emergencia_nombre, parentesco: f.emergencia_parentesco ?? '', telefono: f.emergencia_telefono ?? '' } : undefined,
  estado: f.estado, pacienteId: f.paciente_id ?? undefined, resueltaEl: f.resuelta_el ?? undefined,
})

export type EntradaSolicitud = Omit<Solicitud, 'id' | 'creadaEl' | 'estado' | 'pacienteId' | 'resueltaEl'>

/** Envío público (sin sesión): solo inserta; el visitante nunca puede leer solicitudes. */
export async function insertarSolicitud(db: SupabaseClient, s: EntradaSolicitud): Promise<void> {
  const { error } = await db.from('solicitud_contacto').insert({
    tipo: s.tipo, nombres: s.nombre, primer_apellido: s.apellidoPaterno, segundo_apellido: s.apellidoMaterno ?? null,
    telefono: s.telefono, correo: s.email.trim().toLowerCase(), especialidad: s.especialidad ?? null, idioma: s.idioma ?? null, mensaje: s.mensaje ?? null,
    nacimiento: s.fechaNacimiento ?? null, sexo: s.sexo ?? null, nacionalidad: s.nacionalidad ?? null, pais: s.pais ?? null,
    emergencia_nombre: s.contactoEmergencia?.nombre ?? null, emergencia_parentesco: s.contactoEmergencia?.parentesco ?? null, emergencia_telefono: s.contactoEmergencia?.telefono ?? null,
  })
  if (error) throw new Error(error.message)
}

export type ResultadoResolucion =
  | { ok: true; paciente?: Paciente }
  | { ok: false; error: 'correo-duplicado' | 'ya-resuelta' | 'sin-datos' | 'error' }

/** ✓ Aceptar: la base crea el paciente y marca la solicitud en una sola operación. */
export async function aceptarSolicitudRemota(db: SupabaseClient, id: string): Promise<ResultadoResolucion> {
  const { data, error } = await db.rpc('aceptar_solicitud', { p_id: id })
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'correo-duplicado' }
    if (error.message.includes('ya-resuelta')) return { ok: false, error: 'ya-resuelta' }
    if (error.message.includes('sin-datos')) return { ok: false, error: 'sin-datos' }
    return { ok: false, error: 'error' }
  }
  if (!data) return { ok: true } // solicitud de informes: marcada atendida, sin paciente
  const { data: fila, error: e2 } = await db.from('paciente').select('*').eq('id', data as string).single<FilaPaciente>()
  if (e2) return { ok: false, error: 'error' }
  return { ok: true, paciente: aPaciente(fila) }
}

/** ✗ Rechazar: no se integra como paciente. */
export async function rechazarSolicitudRemota(db: SupabaseClient, id: string): Promise<ResultadoResolucion> {
  const { error } = await db.rpc('rechazar_solicitud', { p_id: id })
  if (error) return { ok: false, error: error.message.includes('ya-resuelta') ? 'ya-resuelta' : 'error' }
  return { ok: true }
}

// ── Edición de pacientes ────────────────────────────────────────────────────────────────────

/**
 * Corrige los datos de un paciente. Si cambia el correo, la función del servidor lo cambia también en su cuenta de acceso
 * (si la tiene), para que el expediente y el inicio de sesión siempre cuadren. El estado, el portal y el historial no se tocan.
 */
export async function actualizarPacienteRemoto(db: SupabaseClient, id: string, p: NuevoPaciente, correoAnterior: string): Promise<Paciente> {
  if (p.email.toLowerCase() !== correoAnterior.toLowerCase()) {
    const { data, error } = await db.functions.invoke('cambiar-correo-paciente', { body: { pacienteId: id, correo: p.email } })
    if (error || !data?.ok) {
      let cuerpo: { error?: string } | undefined
      try { cuerpo = await (error as { context?: Response } | null)?.context?.json() } catch { /* sin cuerpo */ }
      const codigo = cuerpo?.error ?? data?.error
      throw codigo === 'correo-duplicado' || codigo === 'correo-en-uso' ? new CorreoDuplicadoError() : new Error(codigo ?? 'no-se-pudo-cambiar-correo')
    }
  }
  const { data, error } = await db.from('paciente').update({
    nombres: p.nombre, primer_apellido: p.apellidoPaterno, segundo_apellido: p.apellidoMaterno ?? null,
    nacimiento: p.fechaNacimiento, sexo: p.sexo, nacionalidad: p.nacionalidad, pais: p.pais, idioma: p.idioma, telefono: p.telefono,
    emergencia_nombre: p.contactoEmergencia.nombre, emergencia_parentesco: p.contactoEmergencia.parentesco, emergencia_telefono: p.contactoEmergencia.telefono,
    padecimiento_principal: p.padecimientoPrincipal,
  }).eq('id', id).select().single<FilaPaciente>()
  if (error) throw new Error(error.message)
  return aPaciente(data)
}
