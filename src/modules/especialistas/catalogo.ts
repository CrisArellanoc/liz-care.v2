// M11 Especialistas · RF-11 / HU-08 / CA-16: catálogo interno de médicos locales, búsqueda por
// especialidad e idioma y alta solo para administración. El médico es un registro, no una cuenta.
import type { Especialista, Sector, Sesion } from '../../data/types'
import { normalizar } from '../../lib/format'
import { autorizar } from '../identidad/permisos'

export interface DatosEspecialista {
  nombre: string
  especialidad: string
  institucion: string
  sector: Sector
  direccion: string
  telefono: string
  /** Idiomas separados por comas, como se capturan en el formulario. */
  idiomas: string
}

export type CampoEspecialista = keyof DatosEspecialista
export type ErroresEspecialista = Partial<Record<CampoEspecialista, string>>

export const datosEspecialistaVacios: DatosEspecialista = {
  nombre: '', especialidad: '', institucion: '', sector: 'Privado', direccion: '', telefono: '', idiomas: '',
}

/** Obligatorios según el diccionario de datos; la dirección es opcional. */
export const camposRequeridosEspecialista: CampoEspecialista[] = ['nombre', 'especialidad', 'institucion', 'telefono', 'idiomas']

const espacios = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Separa por comas, quita espacios y repetidos (sin distinguir mayúsculas ni acentos). */
export function separarIdiomas(texto: string): string[] {
  const vistos = new Set<string>()
  const salida: string[] = []
  for (const parte of texto.split(',')) {
    const idioma = espacios(parte)
    const clave = normalizar(idioma)
    if (idioma && !vistos.has(clave)) { vistos.add(clave); salida.push(idioma) }
  }
  return salida
}

export function validarEspecialista(d: DatosEspecialista): ErroresEspecialista {
  const errores: ErroresEspecialista = {}
  if (d.sector !== 'Público' && d.sector !== 'Privado') errores.sector = 'Selecciona un sector válido.'
  camposRequeridosEspecialista.forEach((k) => {
    const vacio = k === 'idiomas' ? separarIdiomas(d.idiomas).length === 0 : !espacios(d[k])
    if (vacio) errores[k] = 'Este campo es obligatorio.'
  })
  return errores
}

export type NuevoEspecialista = Omit<Especialista, 'id'>

export function aNuevoEspecialista(d: DatosEspecialista): NuevoEspecialista {
  return {
    nombre: espacios(d.nombre), especialidad: espacios(d.especialidad), institucion: espacios(d.institucion),
    sector: d.sector, direccion: espacios(d.direccion), telefono: espacios(d.telefono), idiomas: separarIdiomas(d.idiomas),
  }
}

export type ResultadoEspecialista =
  | { ok: true; especialista: Especialista }
  | { ok: false; motivo: 'sin-permiso' }
  | { ok: false; motivo: 'datos-invalidos'; errores: ErroresEspecialista }
  | { ok: false; motivo: 'error-guardado' }

export async function registrarEspecialista(
  d: DatosEspecialista,
  o: { sesion: Sesion | null; guardar: (e: NuevoEspecialista) => Promise<Especialista> | Especialista },
): Promise<ResultadoEspecialista> {
  if (!autorizar(o.sesion, 'especialista:escribir').permitido) return { ok: false, motivo: 'sin-permiso' }
  const errores = validarEspecialista(d)
  if (Object.keys(errores).length) return { ok: false, motivo: 'datos-invalidos', errores }
  try {
    return { ok: true, especialista: await o.guardar(aNuevoEspecialista(d)) }
  } catch {
    return { ok: false, motivo: 'error-guardado' }
  }
}

export interface FiltroEspecialistas {
  /** Texto libre: coincide con una parte de la especialidad. */
  especialidad?: string
  /** Idioma exacto (sin distinguir mayúsculas ni acentos). */
  idioma?: string
  /** Búsqueda adicional por nombre u hospital. */
  texto?: string
}

/**
 * CA-16: con especialidad e idioma, solo salen quienes cumplen ambos. Si nadie coincide el resultado
 * es vacío: nunca se sugiere un especialista que no cumple.
 */
export function buscarEspecialistas(catalogo: Especialista[], f: FiltroEspecialistas): Especialista[] {
  const esp = normalizar(f.especialidad ?? '')
  const idi = normalizar(f.idioma ?? '')
  const txt = normalizar(f.texto ?? '')
  return catalogo.filter((e) =>
    (!esp || normalizar(e.especialidad).includes(esp))
    && (!idi || e.idiomas.some((x) => normalizar(x) === idi))
    && (!txt || normalizar(`${e.nombre} ${e.institucion}`).includes(txt)))
}

export const especialidadesDe = (c: Especialista[]) => [...new Set(c.map((e) => e.especialidad))].sort((a, b) => a.localeCompare(b, 'es'))
export const idiomasDe = (c: Especialista[]) => [...new Set(c.flatMap((e) => e.idiomas))].sort((a, b) => a.localeCompare(b, 'es'))

