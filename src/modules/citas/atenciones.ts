// M04 Citas y consultas · RF-02 / RF-05 / HU-02.1 / HU-02.2 / CA-02 / CA-11.
// Una atención es una cita programada o una consulta realizada. M04 es dueño de la fecha y el estado;
// el tratamiento (M05) y la receta (M06) se validan con sus propios módulos.
import type { ArchivoReceta, Consulta, Especialista, EstadoConsulta, Paciente, Sesion } from '../../data/types'
import { diaEnLeon } from '../../lib/tiempo'
import { autorizar } from '../identidad/permisos'
import { validarArchivoReceta } from '../recetas/archivo'
import { validarTratamiento, type EntradaTratamiento, type ErroresTratamiento } from '../tratamientos/tratamiento'

export interface DatosAtencion {
  pacienteId: string
  especialistaId: string
  /** Instante en ISO 8601. */
  fecha: string
  motivo: string
  estado: EstadoConsulta
  /** Resumen de la consulta realizada (obligatorio) o indicaciones previas de una cita (opcional). */
  overview: string
  acompanamiento: boolean
  traduccion: boolean
  notaVisible?: string
  notaInterna?: string
  /** Solo consultas realizadas. */
  tratamiento?: EntradaTratamiento
  receta?: ArchivoReceta
}

export interface ErroresAtencion {
  paciente?: string
  especialista?: string
  fecha?: string
  motivo?: string
  overview?: string
  estado?: string
  tratamiento?: ErroresTratamiento
  receta?: string
}

export interface ContextoAtencion {
  pacientes: Paciente[]
  especialistas: Especialista[]
  existente?: Consulta
  ahora?: Date
}

export function validarAtencion(d: DatosAtencion, c: ContextoAtencion): ErroresAtencion {
  const ahora = c.ahora ?? new Date()
  const e: ErroresAtencion = {}
  const completada = d.estado === 'completada'
  if (d.estado !== 'programada' && d.estado !== 'completada') e.estado = 'Selecciona un estado válido.'
  if (c.existente && (d.pacienteId !== c.existente.pacienteId)) e.paciente = 'No se puede cambiar el paciente de una atención existente.'

  if (!d.pacienteId) e.paciente = 'Selecciona un paciente.'
  else if (!c.pacientes.some((p) => p.id === d.pacienteId)) e.paciente = 'El paciente no existe.'

  if (!d.especialistaId) e.especialista = 'Selecciona al especialista.'
  else if (!c.especialistas.some((x) => x.id === d.especialistaId)) e.especialista = 'El especialista no está en el catálogo.'

  const t = Date.parse(d.fecha)
  if (!d.fecha || Number.isNaN(t)) e.fecha = 'Indica la fecha y la hora.'
  else if (completada && t > ahora.getTime()) e.fecha = 'Una consulta realizada no puede tener fecha futura.'

  if (!d.motivo.trim()) e.motivo = 'Describe el motivo de la consulta.'
  // CA-02: la consulta realizada exige resumen; la cita futura no.
  if (completada && !d.overview.trim()) e.overview = 'Escribe un resumen general de la consulta.'

  if (c.existente?.estado === 'completada' && !completada) e.estado = 'Una consulta realizada no puede volver a ser cita.'

  if (completada) {
    if (!d.tratamiento) e.tratamiento = { general: 'Agrega los medicamentos o marca «Sin medicamentos».', medicamentos: {} }
    else {
      const r = validarTratamiento(d.tratamiento)
      if (!r.ok) e.tratamiento = r.errores
    }
    // Una receta ya guardada no se vuelve a validar; una nueva debe cumplir tipo y tamaño (M06).
    if (d.receta && d.receta !== c.existente?.receta) {
      const r = validarArchivoReceta({ nombre: d.receta.nombreOriginal, tipo: d.receta.tipoMime, tamano: d.receta.tamanoBytes })
      if (!r.ok) e.receta = r.mensaje
    }
  } else {
    if (d.tratamiento) e.tratamiento = { general: 'Una cita futura no puede tener tratamiento.', medicamentos: {} }
    if (d.receta) e.receta = 'Una cita futura no puede tener receta.'
  }
  return e
}

export type NuevaConsulta = Omit<Consulta, 'id'>

export type ResultadoAtencion =
  | { ok: true; consulta: Consulta }
  | { ok: false; motivo: 'sin-permiso' }
  | { ok: false; motivo: 'datos-invalidos'; errores: ErroresAtencion }
  | { ok: false; motivo: 'error-guardado' }

export interface OpcionesAtencion extends ContextoAtencion {
  sesion: Sesion | null
  /** Persistencia: guarda la consulta nueva o, con `existente`, actualiza esa consulta. */
  guardar: (c: NuevaConsulta, existenteId?: string) => Promise<Consulta> | Consulta
}

export async function registrarAtencion(d: DatosAtencion, o: OpcionesAtencion): Promise<ResultadoAtencion> {
  if (!autorizar(o.sesion, 'atencion:escribir', { pacienteId: d.pacienteId }).permitido) return { ok: false, motivo: 'sin-permiso' }
  const errores = validarAtencion(d, o)
  if (Object.keys(errores).length) return { ok: false, motivo: 'datos-invalidos', errores }

  const completada = d.estado === 'completada'
  const tratamiento = completada && d.tratamiento ? (() => { const r = validarTratamiento(d.tratamiento); return r.ok ? r.tratamiento : undefined })() : undefined
  const nueva: NuevaConsulta = {
    pacienteId: d.pacienteId, especialistaId: d.especialistaId, fecha: new Date(d.fecha).toISOString(),
    motivo: d.motivo.trim(), overview: d.overview.trim(), estado: d.estado,
    acompanamiento: d.acompanamiento, traduccion: d.traduccion,
    notaVisible: d.notaVisible?.trim() || undefined, notaInterna: d.notaInterna?.trim() || undefined,
    tratamiento, receta: completada ? d.receta : undefined,
  }
  try {
    return { ok: true, consulta: await o.guardar(nueva, o.existente?.id) }
  } catch {
    return { ok: false, motivo: 'error-guardado' }
  }
}

// ── Consultas de lectura ─────────────────────────────────────────────────────────────────────

const instante = (c: Consulta) => Date.parse(c.fecha)

/** Orden cronológico estable: si dos fechas empatan se desempata por id. */
export function ordenCronologico(consultas: Consulta[], direccion: 'asc' | 'desc' = 'asc'): Consulta[] {
  const signo = direccion === 'asc' ? 1 : -1
  return [...consultas].sort((a, b) => signo * (instante(a) - instante(b) || a.id.localeCompare(b.id)))
}

/** RF-05 / CA-11: citas programadas de hoy y futuras (día de León), de la más cercana a la más lejana. */
export function proximasDelPaciente(consultas: Consulta[], pacienteId: string, ahora = new Date()): Consulta[] {
  const hoy = diaEnLeon(ahora)
  return ordenCronologico(
    consultas.filter((c) => c.pacienteId === pacienteId && c.estado === 'programada' && diaEnLeon(c.fecha) >= hoy),
    'asc',
  )
}

/** Consultas realizadas del paciente, de la más reciente a la más antigua. */
export function realizadasDelPaciente(consultas: Consulta[], pacienteId: string): Consulta[] {
  return ordenCronologico(consultas.filter((c) => c.pacienteId === pacienteId && c.estado === 'completada'), 'desc')
}

/** Citas programadas que ya pasaron sin registrarse como consulta (la administradora debe darles seguimiento). */
export function citasPendientesDeRegistro(consultas: Consulta[], pacienteId: string, ahora = new Date()): Consulta[] {
  const hoy = diaEnLeon(ahora)
  return ordenCronologico(consultas.filter((c) => c.pacienteId === pacienteId && c.estado === 'programada' && diaEnLeon(c.fecha) < hoy), 'desc')
}

