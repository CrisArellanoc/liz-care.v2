// M06 Recetas y archivos · RF-07 / HU-05.2 / CA-05 / CA-09: validación de la foto de receta y entrega autorizada.
import type { ArchivoReceta, Consulta, Sesion } from '../../data/types'
import { autorizar, type MotivoDenegado } from '../identidad/permisos'

/** v4: JPG, PNG y HEIC. */
export const TIPOS_RECETA = ['image/jpeg', 'image/png', 'image/heic'] as const
export const EXTENSIONES_RECETA = ['jpg', 'jpeg', 'png', 'heic'] as const
/** Exactamente 10 MB se acepta (CA-05 límite); un byte más se rechaza. */
export const LIMITE_BYTES = 10 * 1024 * 1024

export interface DatosArchivo { nombre: string; tipo: string; tamano: number }

export type ResultadoArchivo =
  | { ok: true; tipoMime: string }
  | { ok: false; motivo: 'tipo' | 'tamano' | 'vacio'; mensaje: string }

const MENSAJE_TIPO = 'Solo se permiten imágenes JPG, PNG o HEIC.'

function tipoDe(a: DatosArchivo): string | null {
  const mime = a.tipo.trim().toLowerCase()
  const ext = a.nombre.toLowerCase().split('.').pop() ?? ''
  if (mime === 'image/jpg') return 'image/jpeg'
  if ((TIPOS_RECETA as readonly string[]).includes(mime)) return mime
  // Algunos navegadores no informan el tipo de un .heic: se acepta por extensión solo si el tipo viene vacío.
  if (!mime || mime === 'application/octet-stream') {
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
    if (ext === 'png') return 'image/png'
    if (ext === 'heic') return 'image/heic'
  }
  return null
}

export function validarArchivoReceta(a: DatosArchivo): ResultadoArchivo {
  const tipoMime = tipoDe(a)
  if (!tipoMime) return { ok: false, motivo: 'tipo', mensaje: MENSAJE_TIPO }
  if (!Number.isSafeInteger(a.tamano) || a.tamano <= 0) return { ok: false, motivo: 'vacio', mensaje: 'El archivo está vacío.' }
  if (a.tamano > LIMITE_BYTES) return { ok: false, motivo: 'tamano', mensaje: 'La imagen supera el límite de 10 MB.' }
  return { ok: true, tipoMime }
}

/** Metadatos listos para guardar (tabla archivo_receta); `url` es la referencia con la que se muestra. */
export function aArchivoReceta(a: DatosArchivo, url: string): ArchivoReceta | null {
  const r = validarArchivoReceta(a)
  return r.ok ? { url, nombreOriginal: a.nombre, tipoMime: r.tipoMime, tamanoBytes: a.tamano } : null
}

export type EntregaReceta =
  | { ok: true; receta: ArchivoReceta }
  | { ok: false; motivo: MotivoDenegado | 'sin-receta' }

/** CA-09: la receta solo se entrega a la administradora o al paciente dueño de la consulta. */
export function entregarReceta(sesion: Sesion | null | undefined, consulta: Consulta | undefined): EntregaReceta {
  if (!consulta) return { ok: false, motivo: 'sin-receta' }
  const d = autorizar(sesion, 'receta:leer', { pacienteId: consulta.pacienteId })
  if (!d.permitido) return { ok: false, motivo: d.motivo }
  return consulta.receta ? { ok: true, receta: consulta.receta } : { ok: false, motivo: 'sin-receta' }
}

