export type Sector = 'Público' | 'Privado'

export interface Especialista {
  id: string
  nombre: string
  especialidad: string
  foto?: string
  institucion: string
  sector: Sector
  direccion: string
  telefono: string
  idiomas: string[]
}

export interface Administrador {
  id: string
  nombre: string
  email: string
}

export interface ContactoEmergencia {
  nombre: string
  parentesco: string
  telefono: string
}

/**
 * RF-10 / CA-08: cada apartado se responde con elementos o con un «no tengo» explícito.
 * Una lista vacía sin la marca «no tengo» nunca equivale a ninguno.
 */
export interface HistorialInicial {
  completadoEl: string
  padecimientos: string[]
  sinPadecimientos: boolean
  alergias: string[]
  sinAlergias: boolean
  tratamientos: string[]
  sinTratamientos: boolean
  cirugias?: string
  notas?: string
}

export interface Paciente {
  id: string
  nombre: string
  apellidoPaterno: string
  apellidoMaterno?: string
  fechaNacimiento: string
  sexo: 'F' | 'M' | 'X'
  nacionalidad: string
  pais: string
  idioma: string
  telefono: string
  email: string
  padecimientoPrincipal: string
  contactoEmergencia: ContactoEmergencia
  altaEl: string
  activo: boolean
  portal: 'activo' | 'invitado' | 'sin acceso'
  historialInicial?: HistorialInicial
  color: string
}

export interface Medicamento {
  nombre: string
  dosis: string
  frecuencia: string
  duracion: string
  indicaciones: string
  horarios: ('mañana' | 'tarde' | 'noche')[]
}

export interface Tratamiento {
  medicamentos: Medicamento[]
  /** RF-08 / CA-05: la ausencia de medicamentos se indica expresamente; no se deduce de una lista vacía. */
  sinMedicamentos?: boolean
  indicacionesGenerales: string
}

/** Metadatos de la foto de receta (tabla archivo_receta). `url` es una referencia de visualización, no un enlace público. */
export interface ArchivoReceta {
  url: string
  nombreOriginal: string
  tipoMime: string
  tamanoBytes: number
  /** Ruta en el bucket privado «recetas»; solo existe cuando la receta ya está guardada en Supabase. */
  ruta?: string
  /** Archivo elegido en el navegador, pendiente de subir. No se guarda ni se serializa. */
  archivo?: File
}

/** v4: una atención es una cita programada o una consulta realizada. */
export type EstadoConsulta = 'programada' | 'completada'

export interface Consulta {
  id: string
  pacienteId: string
  especialistaId: string
  fecha: string
  motivo: string
  overview: string
  notaVisible?: string
  notaInterna?: string
  estado: EstadoConsulta
  tratamiento?: Tratamiento
  receta?: ArchivoReceta
  acompanamiento: boolean
  traduccion: boolean
}

export type Rol = 'admin' | 'paciente'

export interface Sesion {
  rol: Rol
  nombre: string
  email: string
  pacienteId?: string
  /** Momento de inicio; la sesión expira pasado el límite de M01. */
  iniciadaEl?: string
}

export type EstadoSolicitud = 'nueva' | 'aceptada' | 'rechazada'

/** Solicitud enviada desde el sitio público. Una solicitud «cita» trae los datos del alta; «informes» solo contacto. */
export interface Solicitud {
  id: string
  creadaEl: string
  tipo: 'cita' | 'informes'
  nombre: string
  apellidoPaterno: string
  apellidoMaterno?: string
  telefono: string
  email: string
  especialidad?: string
  idioma?: string
  mensaje?: string
  fechaNacimiento?: string
  sexo?: 'F' | 'M' | 'X'
  nacionalidad?: string
  pais?: string
  contactoEmergencia?: ContactoEmergencia
  estado: EstadoSolicitud
  pacienteId?: string
  resueltaEl?: string
}
