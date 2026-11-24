// M02 Pacientes · corrección de datos (CA-13): solo la administración edita; se valida igual que el alta,
// el correo no puede coincidir con otro paciente y se conservan el estado, el portal y el historial.
import type { Paciente, Sesion } from '../../data/types'
import { aNuevoPaciente, CorreoDuplicadoError, type NuevoPaciente } from './registro'
import { buscarDuplicados, validarAlta, type DatosAlta, type ErroresAlta } from './validacion'

/** Paciente guardado → campos del formulario. */
export function aDatosAlta(p: Paciente): DatosAlta {
  return {
    nombre: p.nombre, apellidoPaterno: p.apellidoPaterno, apellidoMaterno: p.apellidoMaterno ?? '',
    fechaNacimiento: p.fechaNacimiento, sexo: p.sexo, nacionalidad: p.nacionalidad, idioma: p.idioma,
    telefono: p.telefono, email: p.email, padecimientoPrincipal: p.padecimientoPrincipal,
    emNombre: p.contactoEmergencia.nombre, emParentesco: p.contactoEmergencia.parentesco, emTelefono: p.contactoEmergencia.telefono,
  }
}

/** Persistencia: recibe los datos ya validados y devuelve el paciente confirmado. */
export type ActualizarPaciente = (id: string, datos: NuevoPaciente) => Promise<Paciente> | Paciente

export interface OpcionesEdicion {
  sesion: Sesion | null
  pacientes: Paciente[]
  actualizar: ActualizarPaciente
  hoy?: Date
}

export type ResultadoEdicion =
  | { ok: true; paciente: Paciente; cambioCorreo: boolean }
  | { ok: false; motivo: 'sin-permiso' | 'no-existe' | 'error-guardado' }
  | { ok: false; motivo: 'datos-invalidos'; errores: ErroresAlta }
  | { ok: false; motivo: 'correo-duplicado'; existentes: Paciente[] }

export async function editarPaciente(id: string, d: DatosAlta, o: OpcionesEdicion): Promise<ResultadoEdicion> {
  if (o.sesion?.rol !== 'admin') return { ok: false, motivo: 'sin-permiso' }
  const actual = o.pacientes.find((p) => p.id === id)
  if (!actual) return { ok: false, motivo: 'no-existe' }

  const errores = validarAlta(d, o.hoy)
  if (Object.keys(errores).length) return { ok: false, motivo: 'datos-invalidos', errores }

  // Solo el correo bloquea: dos personas pueden llamarse igual, y este paciente ya existe.
  const { porCorreo } = buscarDuplicados(d, o.pacientes.filter((p) => p.id !== id))
  if (porCorreo.length) return { ok: false, motivo: 'correo-duplicado', existentes: porCorreo }

  const datos = aNuevoPaciente(d, false)
  try {
    const paciente = await o.actualizar(id, datos)
    return { ok: true, paciente, cambioCorreo: paciente.email !== actual.email }
  } catch (e) {
    if (e instanceof CorreoDuplicadoError) return { ok: false, motivo: 'correo-duplicado', existentes: [] }
    return { ok: false, motivo: 'error-guardado' }
  }
}
