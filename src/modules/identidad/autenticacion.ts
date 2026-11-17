// M01 Identidad y permisos · RF-04 / HU-04.1 / CA-10: inicio de sesión del prototipo en memoria.
// Con Supabase Auth la verificación de credenciales se mueve al servidor; las reglas de aquí se conservan.
import type { Administrador, Paciente, Rol, Sesion } from '../../data/types'

/** CA-10: el mensaje no indica cuál dato falló (correo, contraseña o campo vacío). */
export const MENSAJE_ACCESO_NEGADO = 'Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.'

/** La sesión expira a las 8 horas (diseño modular: «la sesión debe poder expirar y cerrarse»). */
export const DURACION_SESION_MS = 8 * 60 * 60 * 1000

export type ResultadoAcceso =
  | { ok: true; sesion: Sesion }
  | { ok: false; motivo: 'campos-vacios' | 'credenciales' }

export interface OpcionesAcceso {
  email: string
  password: string
  rol: Rol
  administradores: Administrador[]
  pacientes: Paciente[]
  /** Contraseñas de demostración por rol; se retiran al activar Supabase Auth. */
  passwordDemo: { admin: string; paciente: string }
  ahora?: Date
}

export function iniciarSesionEnMemoria(o: OpcionesAcceso): ResultadoAcceso {
  const email = o.email.trim().toLowerCase()
  if (!email || !o.password) return { ok: false, motivo: 'campos-vacios' }
  const iniciadaEl = (o.ahora ?? new Date()).toISOString()

  if (o.rol === 'admin') {
    const a = o.administradores.find((x) => x.email.toLowerCase() === email)
    if (a && o.password === o.passwordDemo.admin) return { ok: true, sesion: { rol: 'admin', nombre: a.nombre, email, iniciadaEl } }
    return { ok: false, motivo: 'credenciales' }
  }

  // Solo entra un paciente con servicio activo y acceso al portal habilitado.
  const p = o.pacientes.find((x) => x.email.toLowerCase() === email && x.activo && x.portal === 'activo')
  if (p && o.password === o.passwordDemo.paciente) {
    return { ok: true, sesion: { rol: 'paciente', nombre: `${p.nombre} ${p.apellidoPaterno}`, email, pacienteId: p.id, iniciadaEl } }
  }
  return { ok: false, motivo: 'credenciales' }
}

export function sesionVigente(sesion: Sesion | null | undefined, ahora = new Date()): boolean {
  if (!sesion || !['admin', 'paciente'].includes(sesion.rol)) return false
  if (typeof sesion.nombre !== 'string' || typeof sesion.email !== 'string') return false
  if (sesion.rol === 'paciente' && !sesion.pacienteId) return false
  if (typeof sesion.iniciadaEl !== 'string') return false
  const t = Date.parse(sesion.iniciadaEl)
  const edad = ahora.getTime() - t
  return Number.isFinite(t) && edad >= 0 && edad < DURACION_SESION_MS
}

